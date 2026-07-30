import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { sendWishlistReminderEmail } from '@/lib/email';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { WishlistEmailItem } from '@/components/WishlistReminderEmail';

export const dynamic = 'force-dynamic';

/**
 * External Cron API Endpoint: POST /api/cron/wishlist-notifications
 *
 * Designed to be triggered by cron-job.org or external scheduler.
 * Authenticates via Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
 * Sends one consolidated wishlist email per user with duplicate-prevention per day.
 */
export async function POST(request: Request) {
  return handleWishlistNotifications(request);
}

// Also accept GET requests for easy testing via browser or curl if authorized
export async function GET(request: Request) {
  return handleWishlistNotifications(request);
}

async function handleWishlistNotifications(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret');
  const authHeader = request.headers.get('Authorization');
  const headerSecret = request.headers.get('x-cron-secret');

  const providedSecret =
    querySecret ||
    headerSecret ||
    (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  // 1. Secret Protection Guard
  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  const errors: Array<{ userId?: string; email?: string; error: string }> = [];
  let emailsSent = 0;
  let skipped = 0;

  try {
    // 2. Query all wishlisted items joined with products and users
    const wishlistRows = await db
      .select({
        wishlistId: schema.wishlist.id,
        userId: schema.wishlist.user_id,
        userEmail: schema.users.email,
        userName: schema.users.name,
        userLastSentAt: schema.users.last_wishlist_email_sent_at,
        product: schema.products,
      })
      .from(schema.wishlist)
      .innerJoin(schema.products, eq(schema.wishlist.product_id, schema.products.id))
      .innerJoin(schema.users, eq(schema.wishlist.user_id, schema.users.id))
      .orderBy(desc(schema.wishlist.created_at));

    if (wishlistRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wishlisted items found with registered users',
        emailsSent: 0,
        skipped: 0,
        errors: [],
      });
    }

    // 3. Group wishlist items by User
    const userMap = new Map<
      string,
      {
        email: string;
        name: string;
        lastSentAt: Date | null;
        items: WishlistEmailItem[];
      }
    >();

    for (const row of wishlistRows) {
      if (!row.userEmail || !row.userEmail.includes('@')) {
        continue;
      }

      if (!userMap.has(row.userId)) {
        userMap.set(row.userId, {
          email: row.userEmail,
          name: row.userName || 'Valued Customer',
          lastSentAt: row.userLastSentAt ? new Date(row.userLastSentAt) : null,
          items: [],
        });
      }

      const userData = userMap.get(row.userId)!;
      const rawImage = row.product.images?.[0] || '';
      const imageUrl = rawImage
        ? getOptimizedImageUrl(rawImage, 400)
        : 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400';

      // Deduplicate products per user
      if (!userData.items.some((item) => item.id === row.product.id)) {
        userData.items.push({
          id: row.product.id,
          name: row.product.name,
          price: row.product.price / 100, // convert paise to Rupees
          compare_price: row.product.compare_price ? row.product.compare_price / 100 : null,
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

    // 4. Send consolidated email per user
    for (const [userId, userData] of Array.from(userMap.entries())) {
      if (userData.items.length === 0) {
        skipped++;
        continue;
      }

      // Duplicate prevention: skip if emailed today
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

      // Unique, varied subject line template rotation
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

        // Update user timestamp to mark email sent today
        await db
          .update(schema.users)
          .set({
            last_wishlist_email_sent_at: new Date(),
          })
          .where(eq(schema.users.id, userId));

        emailsSent++;
      } catch (sendErr: any) {
        console.error(`[WishlistCron] Failed to send email to ${userData.email}:`, sendErr);
        errors.push({
          userId,
          email: userData.email,
          error: sendErr?.message || String(sendErr),
        });
      }
    }

    return NextResponse.json({
      success: true,
      emailsSent,
      skipped,
      errors,
    });
  } catch (err: any) {
    console.error('[WishlistCron Fatal Error]:', err);
    return NextResponse.json(
      {
        error: 'Failed to process wishlist notifications',
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
