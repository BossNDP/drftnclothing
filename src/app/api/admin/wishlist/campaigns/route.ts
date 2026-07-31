import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { sendWishlistReminderEmail } from '@/lib/email';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { WishlistEmailItem } from '@/components/WishlistReminderEmail';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userIds, action = 'send_reminder' } = body;

    const wishlistRows = await db
      .select({
        wishlistId: schema.wishlist.id,
        userId: schema.wishlist.user_id,
        product: schema.products,
      })
      .from(schema.wishlist)
      .innerJoin(schema.products, eq(schema.wishlist.product_id, schema.products.id));

    const targetRows = userIds && Array.isArray(userIds) && userIds.length > 0
      ? wishlistRows.filter((row: any) => userIds.includes(row.userId))
      : wishlistRows;

    if (targetRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wishlisted items found for selected users',
        recipientsSent: 0,
      });
    }

    const pIds = Array.from(new Set(targetRows.map((r: any) => r.product.id))) as string[];
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

    const userMap = new Map<
      string,
      Array<{ wishlistId: string; product: typeof schema.products.$inferSelect }>
    >();

    for (const row of targetRows) {
      const existing = userMap.get(row.userId) || [];
      existing.push({ wishlistId: row.wishlistId, product: row.product });
      userMap.set(row.userId, existing);
    }

    const { clerkClient } = await import('@clerk/nextjs/server');
    let recipientCount = 0;

    for (const [userId, itemsList] of Array.from(userMap.entries())) {
      try {
        let userEmail: string | null = null;
        let userName = 'Valued Customer';

        const [localUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (localUser && localUser.email) {
          userEmail = localUser.email;
          userName = localUser.name || 'Valued Customer';
        } else {
          try {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(userId);
            if (clerkUser) {
              const primaryEmailObj = clerkUser.emailAddresses.find(
                (e) => e.id === clerkUser.primaryEmailAddressId
              ) || clerkUser.emailAddresses[0];
              userEmail = primaryEmailObj?.emailAddress || null;
              userName = clerkUser.firstName || clerkUser.username || 'Valued Customer';
            }
          } catch (clerkErr) {
            console.warn(`[Wishlist Campaign] Could not resolve Clerk user ${userId}:`, clerkErr);
          }
        }

        if (!userEmail) continue;

        const emailItems: WishlistEmailItem[] = itemsList.map(({ product: prod }) => {
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

          return {
            id: prod.id,
            name: prod.name,
            slug: prod.slug,
            price: prod.price,
            compare_price: prod.compare_price,
            image: getOptimizedImageUrl(rawImage, 800),
            category: prod.category,
            stockCount: prod.sizes.reduce((acc, s) => acc + (prod.stock_quantity[s] || 0), 0),
          };
        });

        await sendWishlistReminderEmail({
          customerEmail: userEmail,
          customerName: userName,
          items: emailItems,
        });

        recipientCount++;
      } catch (userErr) {
        console.error(`[Wishlist Campaign] Failed sending to user ${userId}:`, userErr);
      }
    }

    return NextResponse.json({
      success: true,
      recipientsSent: recipientCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Wishlist Campaign] Error dispatching wishlist emails:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send campaign emails' },
      { status: 500 }
    );
  }
}
