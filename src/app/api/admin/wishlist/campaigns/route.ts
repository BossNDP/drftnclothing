import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { dbService } from '@/lib/db';
import { sendWishlistReminderEmail } from '@/lib/email';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { WishlistEmailItem } from '@/components/WishlistReminderEmail';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/wishlist/campaigns
 * Executes targeted Wishlist Email Campaigns from the Admin Dashboard,
 * sends Resend HTML emails, updates wishlist reminder metadata,
 * and logs campaign history in Neon PostgreSQL.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      campaignName,
      emailType = 'wishlist_reminder',
      audienceType = 'all',
      recipientIds = [],
      customSubject,
    } = body;

    if (!campaignName) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    await dbService.ensureWishlistTableExists();

    // 1. Fetch raw wishlist data joined with products
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
      .innerJoin(schema.products, eq(schema.wishlist.product_id, schema.products.id));

    if (wishlistRows.length === 0) {
      return NextResponse.json({ error: 'No wishlisted items found in store database' }, { status: 400 });
    }

    // 2. Fetch past orders to exclude purchased items & calculate LTV
    const orders = await db.select().from(schema.orders);

    const userPurchasedProducts = new Map<string, Set<string>>();
    const userLtvMap = new Map<string, number>();

    for (const order of orders) {
      if (!order.user_id || order.order_status === 'cancelled') continue;

      const ltv = userLtvMap.get(order.user_id) || 0;
      userLtvMap.set(order.user_id, ltv + (order.total_amount || 0));

      const boughtSet = userPurchasedProducts.get(order.user_id) || new Set<string>();
      if (Array.isArray(order.items)) {
        for (const item of order.items as any[]) {
          if (item.id) boughtSet.add(item.id);
        }
      }
      userPurchasedProducts.set(order.user_id, boughtSet);
    }

    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    // 3. Filter candidates based on audienceType
    const candidateRows = wishlistRows.filter((row: any) => {
      // Exclude bought items
      const isPurchased = userPurchasedProducts.get(row.userId)?.has(row.productId);
      if (isPurchased) return false;

      // Specific recipient check
      if (recipientIds.length > 0 && !recipientIds.includes(row.userId)) {
        return false;
      }

      const totalStock = row.product.sizes.reduce((acc: number, s: string) => acc + (row.product.stock_quantity[s] || 0), 0);
      const ageMs = now - (row.createdAt ? new Date(row.createdAt).getTime() : now);
      const userLtv = userLtvMap.get(row.userId) || 0;

      if (audienceType === 'idle_24h') {
        return ageMs >= TWENTY_FOUR_HOURS_MS;
      }
      if (audienceType === 'low_stock') {
        return totalStock > 0 && totalStock <= 5;
      }
      if (audienceType === 'price_drop') {
        return Boolean(row.product.compare_price && row.product.compare_price > row.product.price);
      }
      if (audienceType === 'vip') {
        return userLtv >= 500000;
      }

      return true;
    });

    if (candidateRows.length === 0) {
      return NextResponse.json({ error: 'No customers match the selected campaign audience' }, { status: 400 });
    }

    // 4. Group candidate items per user
    const userMap = new Map<string, Array<{ wishlistId: string; product: typeof schema.products.$inferSelect }>>();
    for (const row of candidateRows) {
      const existing = userMap.get(row.userId) || [];
      existing.push({ wishlistId: row.id, product: row.product });
      userMap.set(row.userId, existing);
    }

    let recipientCount = 0;
    const processedWishlistIds: string[] = [];

    const { clerkClient } = await import('@clerk/nextjs/server');
    const localUsers = await db.select().from(schema.users);
    const localUserMap = new Map(localUsers.map((u: any) => [u.id, u]));

    for (const [userId, itemsList] of Array.from(userMap.entries())) {
      try {
        let userEmail: string | null = null;
        let userName = 'Valued Customer';

        const localUser: any = localUserMap.get(userId);
        if (localUser && localUser.email) {
          userEmail = localUser.email;
          userName = localUser.name || 'Valued Customer';
        } else {
          try {
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(userId);
            if (clerkUser) {
              const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) || clerkUser.emailAddresses[0];
              userEmail = primary?.emailAddress || null;
              userName = clerkUser.firstName || clerkUser.username || 'Valued Customer';
            }
          } catch (e) {
            console.warn(`[Campaign] Clerk user lookup notice for ${userId}:`, e);
          }
        }

        if (!userEmail) continue;

        const emailItems: WishlistEmailItem[] = itemsList.map(({ product: prod }) => ({
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          price: prod.price,
          compare_price: prod.compare_price,
          image: getOptimizedImageUrl(prod.images[0] || 'https://drftnclothing.in/og-default.jpg', 800),
          category: prod.category,
          stockCount: prod.sizes.reduce((acc, s) => acc + (prod.stock_quantity[s] || 0), 0),
        }));

        await sendWishlistReminderEmail({
          customerEmail: userEmail,
          customerName: userName,
          items: emailItems,
        });

        recipientCount++;
        for (const item of itemsList) {
          processedWishlistIds.push(item.wishlistId);
        }
      } catch (err) {
        console.error(`[Campaign] Failed dispatching email for user ${userId}:`, err);
      }
    }

    // 5. Update Neon Database Wishlist Metadata
    if (processedWishlistIds.length > 0) {
      await db
        .update(schema.wishlist)
        .set({
          last_reminder_sent_at: new Date(),
          reminder_count: sql`${schema.wishlist.reminder_count} + 1`,
        })
        .where(inArray(schema.wishlist.id, processedWishlistIds));
    }

    // 6. Log Campaign Record into `wishlist_campaigns`
    const [insertedCampaign] = await db
      .insert(schema.wishlistCampaigns)
      .values({
        campaign_name: campaignName,
        email_type: emailType,
        recipient_count: recipientCount,
        subject: customSubject || `${campaignName} — Wishlist Reminder`,
        sent_at: new Date(),
        created_by: 'Admin Panel',
      })
      .returning();

    return NextResponse.json({
      success: true,
      campaign: insertedCampaign,
      recipientCount,
      updatedWishlistRows: processedWishlistIds.length,
    });
  } catch (err: any) {
    console.error('[Admin Wishlist Campaign API] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to dispatch campaign' }, { status: 500 });
  }
}
