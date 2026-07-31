import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, inArray, asc } from 'drizzle-orm';
import { dbService } from '@/lib/db';
import { sendWishlistReminderEmail } from '@/lib/email';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { WishlistEmailItem } from '@/components/WishlistReminderEmail';

export const dynamic = 'force-dynamic';

/**
 * DRFTN Automated Wishlist Email Marketing Cron Endpoint
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get('secret');
    const forceRun = searchParams.get('force') === 'true';
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secretParam !== cronSecret) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
      }
    }

    await dbService.ensureWishlistTableExists();

    const rawCandidates = await db
      .select({
        wishlistId: schema.wishlist.id,
        userId: schema.wishlist.user_id,
        productId: schema.wishlist.product_id,
        createdAt: schema.wishlist.created_at,
        lastReminderSentAt: schema.wishlist.last_reminder_sent_at,
        reminderCount: schema.wishlist.reminder_count,
        product: schema.products,
      })
      .from(schema.wishlist)
      .innerJoin(schema.products, eq(schema.wishlist.product_id, schema.products.id));

    if (rawCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wishlisted items found in database',
        emailsSent: 0,
      });
    }

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

    const eligibleRows = rawCandidates.filter((row: any) => {
      if (forceRun) return true;
      if (row.reminderCount >= 2) return false;

      const itemAgeMs = now - (row.createdAt ? new Date(row.createdAt).getTime() : now);

      if (row.reminderCount === 0) {
        return itemAgeMs >= TWENTY_FOUR_HOURS_MS;
      }

      if (row.reminderCount === 1 && row.lastReminderSentAt) {
        const timeSinceLastReminderMs = now - new Date(row.lastReminderSentAt).getTime();
        return timeSinceLastReminderMs >= FORTY_EIGHT_HOURS_MS;
      }

      return false;
    });

    if (eligibleRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wishlist items meet reminder criteria at this time',
        totalWishlistItemsChecked: rawCandidates.length,
        emailsSent: 0,
      });
    }

    // Enrich products with true primary images from product_images & product_variants
    const pIds = Array.from(new Set(eligibleRows.map((r: any) => r.product.id))) as string[];

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

    const userItemMap = new Map<
      string,
      Array<{ wishlistId: string; product: typeof schema.products.$inferSelect }>
    >();

    for (const row of eligibleRows) {
      const existing = userItemMap.get(row.userId) || [];
      existing.push({ wishlistId: row.wishlistId, product: row.product });
      userItemMap.set(row.userId, existing);
    }

    let emailsSent = 0;
    const updateWishlistIds: string[] = [];
    const executionDetails: Array<{ userId: string; email: string; itemCount: number }> = [];

    const { clerkClient } = await import('@clerk/nextjs/server');

    for (const [userId, userCandidates] of Array.from(userItemMap.entries())) {
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
            console.warn(`[Cron Wishlist] Could not resolve Clerk user ${userId}:`, clerkErr);
          }
        }

        if (!userEmail) continue;

        const emailItems: WishlistEmailItem[] = userCandidates.map(({ product: prod }) => {
          const totalStock = prod.sizes.reduce(
            (acc, s) => acc + (prod.stock_quantity[s] || 0),
            0
          );

          const prodImages = imagesByProductId[prod.id];
          const variantImages = variantsByProductId[prod.id]?.[0]?.images;
          let firstImage =
            (prodImages && prodImages.length > 0 ? prodImages[0] : null) ||
            (variantImages && variantImages.length > 0 ? variantImages[0] : null) ||
            (prod.images && prod.images.length > 0 ? prod.images[0] : null) ||
            'https://www.drftnclothing.in/og-default.jpg';

          if (!firstImage.startsWith('http://') && !firstImage.startsWith('https://')) {
            firstImage = `https://www.drftnclothing.in${firstImage.startsWith('/') ? '' : '/'}${firstImage}`;
          }

          return {
            id: prod.id,
            name: prod.name,
            slug: prod.slug,
            price: prod.price,
            compare_price: prod.compare_price,
            image: getOptimizedImageUrl(firstImage, 800),
            category: prod.category,
            stockCount: totalStock,
          };
        });

        await sendWishlistReminderEmail({
          customerEmail: userEmail,
          customerName: userName,
          items: emailItems,
        });

        emailsSent++;
        executionDetails.push({ userId, email: userEmail, itemCount: emailItems.length });

        for (const item of userCandidates) {
          updateWishlistIds.push(item.wishlistId);
        }
      } catch (userErr) {
        console.error(`[Cron Wishlist] Failed to process user ${userId}:`, userErr);
      }
    }

    if (updateWishlistIds.length > 0) {
      await db
        .update(schema.wishlist)
        .set({
          last_reminder_sent_at: new Date(),
          reminder_count: sql`${schema.wishlist.reminder_count} + 1`,
        })
        .where(inArray(schema.wishlist.id, updateWishlistIds as string[]));
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      candidatesChecked: eligibleRows.length,
      emailsSent,
      updatedWishlistRows: updateWishlistIds.length,
      details: executionDetails,
    });
  } catch (err: any) {
    console.error('[Cron Wishlist] Execution error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error running wishlist cron' },
      { status: 500 }
    );
  }
}
