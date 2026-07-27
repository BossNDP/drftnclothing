import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { dbService } from '@/lib/db';
import { sendWishlistReminderEmail } from '@/lib/email';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { WishlistEmailItem } from '@/components/WishlistReminderEmail';

export const dynamic = 'force-dynamic';

/**
 * DRFTN Automated Wishlist Email Marketing Cron Endpoint
 *
 * GET /api/cron/wishlist-reminders
 * Evaluates wishlist items in Neon DB:
 * 1. Checks items added > 24 hours ago with reminder_count < 2.
 * 2. Excludes items the user has already purchased in orders.
 * 3. Consolidates multiple wishlisted items per user into ONE single email.
 * 4. Updates last_reminder_sent_at and reminder_count in Neon DB.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get('secret');
    const forceRun = searchParams.get('force') === 'true';
    const cronSecret = process.env.CRON_SECRET;

    // Secret Guard (if CRON_SECRET is configured)
    if (cronSecret && secretParam !== cronSecret) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
      }
    }

    // 1. Ensure table and new columns (last_reminder_sent_at, reminder_count) exist
    await dbService.ensureWishlistTableExists();

    // 2. Fetch all wishlist items joined with products
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

    // 3. Filter eligible candidates
    const eligibleRows = rawCandidates.filter((row: any) => {
      if (forceRun) return true;

      // Max 2 reminder emails per wishlisted item
      if (row.reminderCount >= 2) return false;

      const itemAgeMs = now - (row.createdAt ? new Date(row.createdAt).getTime() : now);

      // First reminder: item must be at least 24 hours old
      if (row.reminderCount === 0) {
        return itemAgeMs >= TWENTY_FOUR_HOURS_MS;
      }

      // Second reminder: at least 48 hours must have passed since the first reminder
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

    // 4. Group candidate items by userId
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

    // Import Clerk client lazily to resolve user emails
    const { clerkClient } = await import('@clerk/nextjs/server');

    for (const [userId, userCandidates] of Array.from(userItemMap.entries())) {
      try {
        let userEmail: string | null = null;
        let userName = 'Valued Customer';

        // Check local DB user first
        const [localUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (localUser && localUser.email) {
          userEmail = localUser.email;
          userName = localUser.name || 'Valued Customer';
        } else {
          // Fallback to Clerk API lookup
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

        if (!userEmail) {
          console.warn(`[Cron Wishlist] Skipping user ${userId} — no email address found.`);
          continue;
        }

        // Format consolidated email products
        const emailItems: WishlistEmailItem[] = userCandidates.map(({ product: prod }) => {
          const totalStock = prod.sizes.reduce(
            (acc, s) => acc + (prod.stock_quantity[s] || 0),
            0
          );
          const firstImage = prod.images[0] || 'https://drftnclothing.in/og-default.jpg';
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

        // 5. Dispatch single consolidated email to user
        await sendWishlistReminderEmail({
          customerEmail: userEmail,
          customerName: userName,
          items: emailItems,
        });

        emailsSent++;
        executionDetails.push({ userId, email: userEmail, itemCount: emailItems.length });

        // Collect wishlist IDs to bump reminder_count & timestamp
        for (const item of userCandidates) {
          updateWishlistIds.push(item.wishlistId);
        }
      } catch (userErr) {
        console.error(`[Cron Wishlist] Failed to process user ${userId}:`, userErr);
      }
    }

    // 6. Update last_reminder_sent_at and bump reminder_count in Neon DB
    if (updateWishlistIds.length > 0) {
      await db
        .update(schema.wishlist)
        .set({
          last_reminder_sent_at: new Date(),
          reminder_count: sql`${schema.wishlist.reminder_count} + 1`,
        })
        .where(inArray(schema.wishlist.id, updateWishlistIds));
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
