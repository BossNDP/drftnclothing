import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc, inArray, asc } from 'drizzle-orm';
import { dbService } from '@/lib/db';
import { getOptimizedImageUrl } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await dbService.ensureWishlistTableExists();

    const wishlistRows = await db
      .select({
        id: schema.wishlist.id,
        userId: schema.wishlist.user_id,
        productId: schema.wishlist.product_id,
        createdAt: schema.wishlist.created_at,
        lastReminderSentAt: schema.wishlist.last_reminder_sent_at,
        reminderCount: schema.wishlist.reminder_count,
        product: schema.products,
      })
      .from(schema.wishlist)
      .innerJoin(schema.products, eq(schema.wishlist.product_id, schema.products.id))
      .orderBy(desc(schema.wishlist.created_at));

    if (wishlistRows.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const pIds = Array.from(new Set(wishlistRows.map((r: any) => r.product.id))) as string[];
    const [allProductImages, allProductVariants] = pIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(schema.productImages)
            .where(inArray(schema.productImages.product_id, pIds))
            .orderBy(asc(schema.productImages.sort_order)),
          db
            .select()
            .from(schema.productVariants)
            .where(inArray(schema.productVariants.product_id, pIds))
            .orderBy(asc(schema.productVariants.created_at)),
        ])
      : [[], []];

    const imagesByProductId: Record<string, string[]> = {};
    for (const img of allProductImages) {
      if (img.sort_order !== 99 && img.image_url) {
        if (!imagesByProductId[img.product_id]) imagesByProductId[img.product_id] = [];
        imagesByProductId[img.product_id].push(img.image_url);
      }
    }

    const variantsByProductId: Record<string, any[]> = {};
    for (const v of allProductVariants) {
      if (!variantsByProductId[v.product_id]) variantsByProductId[v.product_id] = [];
      variantsByProductId[v.product_id].push(v);
    }

    const getPrimaryImage = (prod: typeof schema.products.$inferSelect): string => {
      const prodImages = imagesByProductId[prod.id];
      const variantImages = variantsByProductId[prod.id]?.[0]?.images;
      let rawImage =
        (prodImages && prodImages.length > 0 ? prodImages[0] : null) ||
        (variantImages && variantImages.length > 0 ? variantImages[0] : null) ||
        (prod.images && prod.images.length > 0 ? prod.images[0] : null) ||
        'https://www.drftnclothing.in/og-default.jpg';

      if (!rawImage.startsWith('http://') && !rawImage.startsWith('https://')) {
        rawImage = `https://www.drftnclothing.in${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
      }
      return getOptimizedImageUrl(rawImage, 800);
    };

    const userIds = Array.from(new Set(wishlistRows.map((r: any) => r.userId))) as string[];
    const dbUsers: any[] = userIds.length > 0
      ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds))
      : [];

    const userMap = new Map(dbUsers.map((u: any) => [u.id, u]));

    const { clerkClient } = await import('@clerk/nextjs/server');
    for (const uId of userIds) {
      if (!userMap.has(uId)) {
        try {
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(uId);
          if (clerkUser) {
            const primaryEmail = clerkUser.emailAddresses.find(
              (e: any) => e.id === clerkUser.primaryEmailAddressId
            ) || clerkUser.emailAddresses[0];
            const primaryPhone = clerkUser.phoneNumbers.find(
              (p: any) => p.id === clerkUser.primaryPhoneNumberId
            ) || clerkUser.phoneNumbers[0];

            userMap.set(uId, {
              id: clerkUser.id,
              name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || clerkUser.username || 'Customer',
              email: primaryEmail?.emailAddress || null,
              phone: primaryPhone?.phoneNumber || null,
              createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt) : new Date(),
            } as any);
          }
        } catch (cErr) {
          console.warn(`[Admin Wishlist] Could not resolve Clerk user ${uId}:`, cErr);
        }
      }
    }

    const allOrders = await db.select().from(schema.orders);
    const userPurchasedProducts = new Map<string, Set<string>>();
    const userOrderStats = new Map<string, { totalOrders: number; totalSpentPaise: number }>();

    for (const order of allOrders) {
      const uId = order.user_id;
      if (!uId) continue;

      if (!userPurchasedProducts.has(uId)) {
        userPurchasedProducts.set(uId, new Set());
      }
      const pSet = userPurchasedProducts.get(uId)!;
      for (const item of order.items) {
        if (item.product_id) pSet.add(item.product_id);
      }

      const currentStats = userOrderStats.get(uId) || { totalOrders: 0, totalSpentPaise: 0 };
      userOrderStats.set(uId, {
        totalOrders: currentStats.totalOrders + 1,
        totalSpentPaise: currentStats.totalSpentPaise + order.total_amount,
      });
    }

    const userWishlistMap = new Map<string, Array<{ name: string; image: string; price: number; slug: string }>>();
    for (const row of wishlistRows) {
      const existing = userWishlistMap.get(row.userId) || [];
      existing.push({
        name: row.product.name,
        image: getPrimaryImage(row.product),
        price: row.product.price,
        slug: row.product.slug,
      });
      userWishlistMap.set(row.userId, existing);
    }

    const enrichedItems = wishlistRows.map((row: any) => {
      const user: any = userMap.get(row.userId);
      const customerName = user?.name || 'Registered Customer';
      const customerEmail = user?.email || `${row.userId.slice(0, 12)}@clerk.user`;

      const totalStock = row.product.sizes.reduce(
        (acc: number, s: string) => acc + (row.product.stock_quantity[s] || 0),
        0
      );
      const isPurchased = userPurchasedProducts.get(row.userId)?.has(row.productId) || false;

      let status: 'waiting' | 'purchased' | 'low_stock' | 'out_of_stock' = 'waiting';
      if (isPurchased) {
        status = 'purchased';
      } else if (totalStock === 0) {
        status = 'out_of_stock';
      } else if (totalStock <= 5) {
        status = 'low_stock';
      }

      const custStats = userOrderStats.get(row.userId) || { totalOrders: 0, totalSpentPaise: 0 };
      const savedProducts = userWishlistMap.get(row.userId) || [];

      return {
        id: row.id,
        userId: row.userId,
        customerName,
        customerEmail,
        product: {
          id: row.product.id,
          name: row.product.name,
          slug: row.product.slug,
          price: row.product.price,
          comparePrice: row.product.compare_price,
          image: getPrimaryImage(row.product),
          category: row.product.category,
          stockCount: totalStock,
        },
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        status,
        lastReminderSentAt: row.lastReminderSentAt ? new Date(row.lastReminderSentAt).toISOString() : null,
        reminderCount: row.reminderCount || 0,
        customerDetail: {
          name: customerName,
          email: customerEmail,
          joinedAt: user?.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
          totalOrders: custStats.totalOrders,
          totalSpentPaise: custStats.totalSpentPaise,
          wishlistCount: savedProducts.length,
          wishlistItems: savedProducts,
        },
      };
    });

    return NextResponse.json({ items: enrichedItems });
  } catch (error: any) {
    console.error('[Admin Wishlist API] GET exception:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch wishlist admin data' },
      { status: 500 }
    );
  }
}
