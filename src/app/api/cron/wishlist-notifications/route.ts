import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, inArray, asc } from 'drizzle-orm';
import { sendWishlistReminderEmail } from '@/lib/email';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { WishlistEmailItem } from '@/components/WishlistReminderEmail';

export const dynamic = 'force-dynamic';

/**
 * Daily Cron Endpoint: Dispatch Wishlist Reminders via Email
 * Endpoint: GET /api/cron/wishlist-notifications
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secretParam !== cronSecret) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
      }
    }

    const wishlistRows = await db
      .select({
        wishlistId: schema.wishlist.id,
        userId: schema.wishlist.user_id,
        product: schema.products,
      })
      .from(schema.wishlist)
      .innerJoin(schema.products, eq(schema.wishlist.product_id, schema.products.id));

    if (wishlistRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wishlisted items found',
        sentCount: 0,
      });
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

    const uIds = Array.from(new Set(wishlistRows.map((r: any) => r.userId))) as string[];
    const dbUsers: any[] = uIds.length > 0
      ? await db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, uIds))
      : [];

    const dbUserMap = new Map(dbUsers.map((u: any) => [u.id, u]));

    const userMap = new Map<
      string,
      {
        email: string;
        name: string;
        lastSentAt: Date | null;
        items: WishlistEmailItem[];
      }
    >();

    const { clerkClient } = await import('@clerk/nextjs/server');

    for (const row of wishlistRows) {
      if (!userMap.has(row.userId)) {
        let email: string | null = null;
        let name = 'Valued Customer';
        let lastSentAt: Date | null = null;

        const dbU: any = dbUserMap.get(row.userId);
        if (dbU && dbU.email) {
          email = dbU.email;
          name = dbU.name || 'Valued Customer';
          lastSentAt = dbU.last_wishlist_email_sent_at || null;
        } else {
          try {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(row.userId);
            if (clerkUser) {
              const primary = clerkUser.emailAddresses.find(
                (e) => e.id === clerkUser.primaryEmailAddressId
              ) || clerkUser.emailAddresses[0];
              email = primary?.emailAddress || null;
              name = clerkUser.firstName || clerkUser.username || 'Valued Customer';
            }
          } catch (cErr) {
            console.warn(`[Wishlist Cron] Failed to fetch Clerk user ${row.userId}:`, cErr);
          }
        }

        if (!email) continue;

        userMap.set(row.userId, {
          email,
          name,
          lastSentAt,
          items: [],
        });
      }

      const userData = userMap.get(row.userId)!;
      const prodImages = imagesByProductId[row.product.id];
      const variantImages = variantsByProductId[row.product.id]?.[0]?.images;

      let rawImage =
        (prodImages && prodImages.length > 0 ? prodImages[0] : null) ||
        (variantImages && variantImages.length > 0 ? variantImages[0] : null) ||
        (row.product.images && row.product.images.length > 0 ? row.product.images[0] : null) ||
        'https://www.drftnclothing.in/og-default.jpg';

      if (!rawImage.startsWith('http://') && !rawImage.startsWith('https://')) {
        rawImage = `https://www.drftnclothing.in${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
      }

      const imageUrl = getOptimizedImageUrl(rawImage, 800);

      if (!userData.items.some((item) => item.id === row.product.id)) {
        userData.items.push({
          id: row.product.id,
          name: row.product.name,
          price: row.product.price,
          compare_price: row.product.compare_price || null,
          image: imageUrl,
          category: row.product.category || 'Streetwear',
          slug: row.product.slug,
        });
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );

    let sentCount = 0;
    let skipped = 0;

    for (const [userId, userData] of Array.from(userMap.entries())) {
      if (userData.items.length === 0) {
        skipped++;
        continue;
      }

      if (userData.lastSentAt) {
        const lastSentDayStr = userData.lastSentAt.toISOString().slice(0, 10);
        if (lastSentDayStr === todayStr) {
          skipped++;
          continue;
        }
      }

      const count = userData.items.length;
      const firstItemName = userData.items[0].name;
      const isMulti = count > 1;

      const subjectTemplates = [
        isMulti
          ? `Your DRFTN wishlist has ${count} items ready to go`
          : `${firstItemName} is still available — don't miss it`,
        isMulti
          ? `Still thinking about it? ${count} items waiting in your wishlist`
          : `Still thinking about it? Your ${firstItemName} is waiting`,
        `${firstItemName}${isMulti ? ` and ${count - 1} more items are` : ' is'} ready for checkout | DRFTN`,
      ];

      const chosenSubject = subjectTemplates[dayOfYear % subjectTemplates.length];

      try {
        await sendWishlistReminderEmail({
          customerEmail: userData.email,
          customerName: userData.name,
          items: userData.items,
          customSubject: chosenSubject,
        });

        await db
          .update(schema.users)
          .set({ last_wishlist_email_sent_at: new Date() })
          .where(eq(schema.users.id, userId));

        sentCount++;
      } catch (sendErr) {
        console.error(`[Wishlist Cron] Failed sending email to ${userData.email}:`, sendErr);
      }
    }

    return NextResponse.json({
      success: true,
      sentCount,
      skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Wishlist Cron] Error executing cron job:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
