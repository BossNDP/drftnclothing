import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@drftn.in';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('VAPID keys not configured, push notifications will not work.');
}

/**
 * Sends a web push notification to a subscriber, automatically formatting URLs to the production domain
 * and attaching the official DRFTN logo assets.
 */
export async function sendPushNotification(subscription: any, rawPayload: any) {
  const baseUrl = 'https://www.drftnclothing.in';
  
  // Resolve relative URLs to the production domain
  const rawUrl = rawPayload.url || '/';
  const url = rawUrl.startsWith('http') ? rawUrl : `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  
  const payload = {
    ...rawPayload,
    url,
    // Add absolute production logo paths for visual delivery in notifications
    icon: 'https://www.drftnclothing.in/logo.png?v=3',
    badge: 'https://www.drftnclothing.in/logo-cropped.png',
  };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    );
  } catch (error: any) {
    // If the subscription is expired or unsubscribed, remove it from the DB
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.log('Subscription expired or invalid, deleting from DB:', subscription.endpoint);
      try {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      } catch (dbError) {
        console.error('Failed to delete expired subscription:', dbError);
      }
    } else {
      console.error('Failed to send push notification:', error);
    }
  }
}

/**
 * Fires a push notification to all admin (general) subscribers whenever a new order is created.
 * This is fire-and-forget — callers should NOT await the returned Promise in a way that
 * blocks or delays the checkout response to the customer.
 *
 * Admin subscriptions are identified by product_id IS NULL (the same "general drop" audience
 * that opted in via the Subscribe This Browser button on the admin notifications page).
 *
 * Pre-order detection: uses payment_type === 'cod_with_deposit' as the COD indicator since
 * no separate isPreOrder field exists in the schema.
 */
export async function notifyAdminOfNewOrder(order: {
  id: string;
  order_number: string;
  customer_name: string;
  items: Array<{ name: string; quantity: number }>;
  total: number; // in paise
  payment_type?: string | null;
}): Promise<void> {
  try {
    const { isNull } = await import('drizzle-orm');

    // Fetch all admin (general) subscriptions — same query as announce-drop
    const adminSubs = await db
      .select()
      .from(pushSubscriptions)
      .where(isNull(pushSubscriptions.product_id));

    if (adminSubs.length === 0) return;

    // Build a concise body: "Ravi Kumar · Stitch Hoodie (2) · ₹2,598"
    const firstItem = order.items[0];
    const itemSummary = firstItem
      ? `${firstItem.name}${order.items.length > 1 ? ` +${order.items.length - 1} more` : ''} · Qty ${firstItem.quantity}`
      : 'Items details unavailable';
    const totalRupees = (order.total / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });

    const isPreOrder = order.payment_type === 'cod_with_deposit';

    const payload = {
      title: isPreOrder ? '🕒 New Pre-Order — DRFTN' : '🛒 New Order — DRFTN',
      body: `${order.customer_name} · ${itemSummary} · ${totalRupees}`,
      url: `/admin/orders/${order.id}`,
      type: 'order', // distinguisher for the service worker
    };

    // Send to each admin subscription — catch per-subscription so one failure doesn't stop the rest
    for (const sub of adminSubs) {
      try {
        await sendPushNotification(sub, payload);
      } catch (subErr) {
        // sendPushNotification already handles 410/404 deletion and logs errors internally
        console.error(`[notifyAdminOfNewOrder] Unexpected error for endpoint ${sub.endpoint}:`, subErr);
      }
    }
  } catch (err) {
    // Never throw — this must not surface to the checkout caller
    console.error('[notifyAdminOfNewOrder] Failed to send order notification:', err);
  }
}
