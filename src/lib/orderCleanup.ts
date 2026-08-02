import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { firestoreService } from '@/lib/firestore';

export async function cleanupExpiredOrders() {
  const now = new Date();
  let expiredCount = 0;
  let abandonedCount = 0;
  let hardDeletedCount = 0;
  
  try {
    // 1. Fetch checkouts from Firestore
    const rawCheckouts = await firestoreService.queryDocs('pending_checkouts', {});
    const checkouts = rawCheckouts.filter((c: any) => c.status === 'pending' || c.status === 'expired');

    // 2. Filter and process checkouts
    const { releaseUnitSafe } = await import('@/lib/stock-gate');
    const { sendAbandonedCartEmail, sendPaymentPendingReminderEmail } = await import('@/lib/email');

    for (const c of checkouts) {
      const holdExpires = c.hold_expires_at ? new Date(c.hold_expires_at) : null;
      const created = c.created_at ? new Date(c.created_at) : new Date(0);

      // A. Send Payment Pending Reminder Email after 5 minutes if still pending
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (c.status === 'pending' && created < fiveMinsAgo && !c.reminderSent) {
        const minsLeft = holdExpires ? Math.max(1, Math.round((holdExpires.getTime() - Date.now()) / 60000)) : 5;
        try {
          await sendPaymentPendingReminderEmail({
            orderNumber: c.order_number,
            customerName: c.customer_name,
            customerEmail: c.customer_email,
            items: c.items,
            totalPaise: c.total,
            minutesRemaining: minsLeft,
          });

          await firestoreService.updateDoc('pending_checkouts', c.id, {
            reminderSent: true,
            updated_at: now.toISOString(),
          });

          console.log(`[Order Cleanup] Sent payment reminder email to ${c.customer_email} for checkout ${c.order_number}`);
        } catch (emailErr) {
          console.error(`[Order Cleanup] Failed to send payment reminder email for ${c.order_number}:`, emailErr);
        }
      }

      // B. Check if the checkout hold has expired
      let isCurrentlyExpired = c.status === 'expired';
      if (c.status === 'pending' && holdExpires && holdExpires < now) {
        // Mark as expired in Firestore
        await firestoreService.updateDoc('pending_checkouts', c.id, {
          status: 'expired',
          updated_at: now.toISOString(),
        });

        // Release stocks back in Redis stock gate
        try {
          for (const item of c.items) {
            await releaseUnitSafe(item.id || item.productId, item.size, item.quantity ?? 1);
          }
          console.log(`[Order Cleanup] Released Redis stock for expired checkout ${c.order_number}`);
        } catch (redisErr) {
          console.error(`[Order Cleanup] Failed to release Redis stock for checkout ${c.order_number}:`, redisErr);
        }

        expiredCount++;
        isCurrentlyExpired = true;
      }
      
      // C. Send Abandoned Cart recovery email after 30 minutes
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      if ((isCurrentlyExpired || c.status === 'pending') && created < thirtyMinsAgo && !c.abandonedEmailSent) {
        try {
          await sendAbandonedCartEmail({
            customerName: c.customer_name,
            customerEmail: c.customer_email,
            items: c.items,
            totalPaise: c.total,
            orderNumber: c.order_number,
          });

          // Mark as sent in Firestore ONLY on successful send!
          await firestoreService.updateDoc('pending_checkouts', c.id, {
            abandonedEmailSent: true,
            updated_at: now.toISOString(),
          });

          console.log(`[Order Cleanup] Sent abandoned cart email to ${c.customer_email} for checkout ${c.order_number}`);
          abandonedCount++;
        } catch (emailErr) {
          console.error(`[Order Cleanup] Failed to send abandoned cart email for ${c.order_number}:`, emailErr);
        }
      }
    }

    // 3. Hard-delete checkouts older than 24 hours (TTL clean up to preserve space)
    // Query other states (e.g. expired/failed checkouts) to clean them up as well
    const allCheckouts = await firestoreService.queryDocs('pending_checkouts', {});
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const c of allCheckouts) {
      const created = c.created_at ? new Date(c.created_at) : new Date(0);
      if (created < oneDayAgo) {
        await firestoreService.deleteDoc('pending_checkouts', c.id);
        console.log(`[Order Cleanup] Hard-deleted old checkout doc ${c.order_number} (24h TTL)`);
        hardDeletedCount++;
      }
    }

    // 4. Reconciliation Safety Net (Heals drift between Redis and Postgres)
    try {
      const { redis } = await import('@/lib/redis');
      const allProducts = await db.select().from(schema.products);
      for (const product of allProducts) {
        const stock = product.stock_quantity || {};
        for (const [size, qty] of Object.entries(stock)) {
          const realAvailable = qty;
          const redisKey = `stock:${product.id}:${size}`;
          const redisValue = await redis.get(redisKey);
          if (redisValue === null || Number(redisValue) !== realAvailable) {
            await redis.set(redisKey, realAvailable);
            console.warn(`[Drift Reconciliation] Syncing stock gate for product ${product.name} (${product.id}) size ${size}. Postgres: ${realAvailable}, Redis: ${redisValue}`);
          }
        }
      }
    } catch (reconErr) {
      console.error('[Order Cleanup] Reconciliation safety net error:', reconErr);
    }

    return { 
      expiredCheckouts: expiredCount, 
      abandonedEmailsSent: abandonedCount, 
      hardDeletedCheckouts: hardDeletedCount 
    };

  } catch (error) {
    console.error('[Order Cleanup] Error cleaning up expired checkouts:', error);
    throw error;
  }
}
