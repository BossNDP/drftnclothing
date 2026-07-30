import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import crypto from 'crypto';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { writeAuditLog } from '@/lib/orchestration/audit-service';
import { confirmAndWriteOrder } from '@/lib/order-db-helper';
import { firestoreService } from '@/lib/firestore';

/**
 * Razorpay Webhook Handler
 *
 * PRODUCTION SAFETY:
 * - Signature verified with timing-safe compare before any DB access.
 * - Idempotent: webhook_events table prevents double-processing.
 * - Convergent: calls the same confirmAndWriteOrder() as the browser verify-payment
 *   path. If the browser already confirmed, the shared function returns the existing
 *   order. If the webhook arrives first, it creates the order from the Firestore
 *   pending_checkout. Either way, exactly one order is created.
 */
export async function POST(request: Request) {
  let eventId = '';

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!signature || !secret) {
      return NextResponse.json({ error: 'Signature verification parameters missing' }, { status: 400 });
    }

    // 1. Verify HMAC signature (timing-safe)
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const sigBuf = Buffer.from(signature, 'utf-8');

    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      console.warn('[Razorpay Webhook] Invalid signature!');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    eventId = payload.event_id || `${event}_${payload.created_at || Date.now()}`;
    const payment = payload.payload?.payment?.entity;

    if (!payment) {
      return NextResponse.json({ success: true, message: 'No payment entity in webhook payload' });
    }

    // 2. Idempotency: check if this webhook event was already processed
    const [existingEvent] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.event_id, eventId))
      .limit(1);

    if (existingEvent?.processed) {
      return NextResponse.json({ success: true, message: 'Webhook event already processed' });
    }

    // 3. Record webhook event (mark unprocessed initially)
    if (!existingEvent) {
      await db.insert(schema.webhookEvents).values({
        provider: 'razorpay',
        event_type: event,
        event_id: eventId,
        payload,
        processed: false,
      }).catch(() => {}); // Best-effort; unique constraint guards idempotency
    }

    const razorpayOrderId = payment.order_id;
    if (!razorpayOrderId) {
      return NextResponse.json({ success: true, message: 'No order ID in payment entity' });
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      // ── Fast path: order already confirmed by browser callback ──
      const [existingNeonOrder] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.razorpay_order_id, razorpayOrderId))
        .limit(1);

      if (existingNeonOrder && existingNeonOrder.payment_status !== 'pending') {
        // Order already confirmed — nothing to do
        await db
          .update(schema.webhookEvents)
          .set({ processed: true, processed_at: new Date() })
          .where(eq(schema.webhookEvents.event_id, eventId));

        await writeAuditLog({
          orderId: existingNeonOrder.id,
          action: 'WEBHOOK:RAZORPAY_ALREADY_CONFIRMED_IDEMPOTENT',
          details: { eventId, paymentId: payment.id },
        });

        return NextResponse.json({ success: true, processed: true, message: 'Already confirmed' });
      }

      // ── Fallback path: browser hasn't confirmed yet — look up Firestore pending checkout ──
      // The internal order UUID is stored in the Razorpay order's notes.order_id field,
      // which Razorpay propagates to the payment entity notes.
      let internalOrderId: string | null =
        payment.notes?.order_id ||
        payload.payload?.order?.entity?.notes?.order_id ||
        null;

      let checkout: any = null;

      if (internalOrderId) {
        // Direct lookup by UUID (fastest path)
        checkout = await firestoreService.getDoc('pending_checkouts', internalOrderId);
      }

      if (!checkout) {
        // Fallback: query Firestore by razorpay_order_id field
        const results = await firestoreService.queryDocs('pending_checkouts', {
          where: [{ field: 'razorpay_order_id', op: '==', value: razorpayOrderId }],
        });
        checkout = results[0] || null;
      }

      if (!checkout) {
        console.warn(
          `[Razorpay Webhook] No pending checkout found for Razorpay Order ID: ${razorpayOrderId}. Payment ID: ${payment.id}`
        );
        // Log and return 200 so Razorpay stops retrying — manual review needed
        await writeAuditLog({
          orderId: 'UNKNOWN',
          action: 'WEBHOOK:RAZORPAY_PENDING_CHECKOUT_NOT_FOUND',
          details: { razorpayOrderId, paymentId: payment.id, eventId },
        });
        return NextResponse.json({ success: true, message: 'Pending checkout not found; logged for review' });
      }

      // ── Confirm the order using the shared function ──
      // confirmAndWriteOrder is idempotent — if the browser just committed,
      // the function returns the existing order without inserting again.
      const confirmedOrder = await confirmAndWriteOrder(checkout, payment.id);

      if (!confirmedOrder) {
        return NextResponse.json({ error: 'Order confirmation failed' }, { status: 500 });
      }

      // Update Firestore checkout status
      await firestoreService.updateDoc('pending_checkouts', checkout.id, {
        status: 'paid',
        payment_id: payment.id,
        updated_at: new Date().toISOString(),
      }).catch(() => {}); // Non-critical

      // Mark webhook event as processed
      await db
        .update(schema.webhookEvents)
        .set({ processed: true, processed_at: new Date() })
        .where(eq(schema.webhookEvents.event_id, eventId));

      await writeAuditLog({
        orderId: confirmedOrder.id,
        action: 'WEBHOOK:RAZORPAY_PAYMENT_CAPTURED',
        details: { eventId, paymentId: payment.id, amount: payment.amount },
      });

    } else if (event === 'payment.failed') {
      // Mark payment as failed on the existing Neon order if it exists
      const [order] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.razorpay_order_id, razorpayOrderId))
        .limit(1);

      if (order) {
        await db
          .update(schema.orders)
          .set({ payment_status: 'failed', order_status: 'PAYMENT_FAILED', updated_at: new Date() })
          .where(eq(schema.orders.id, order.id));
      }

      await db
        .update(schema.webhookEvents)
        .set({ processed: true, processed_at: new Date() })
        .where(eq(schema.webhookEvents.event_id, eventId));
    }

    return NextResponse.json({ success: true, processed: true });

  } catch (err: any) {
    console.error('[Razorpay Webhook Error]:', err);
    if (eventId) {
      await db
        .update(schema.webhookEvents)
        .set({ error: err?.message || String(err) })
        .where(eq(schema.webhookEvents.event_id, eventId))
        .catch(() => {});
    }
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
