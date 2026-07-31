import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * confirmAndWriteOrder — the single source of truth for converting a
 * pending Firestore checkout into a committed Neon order.
 *
 * IDEMPOTENT: safe to call from both the browser verify-payment callback
 * and the Razorpay webhook simultaneously. Whichever arrives second will
 * find the already-committed row and return it immediately.
 *
 * TRANSACTION SAFETY: The payments insert and shippingJobs insert are
 * intentionally allowed to throw. Any failure rolls back the entire
 * transaction so order, payment, and job either ALL exist or NONE exist.
 */
export async function confirmAndWriteOrder(checkout: any, razorpayPaymentId: string) {
  const confirmedOrder = await db.transaction(async (tx: any) => {

    // ── Idempotency Guard 1: check by order UUID (same checkout called twice) ──
    const [existingByOrderId] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, checkout.id))
      .limit(1);

    if (existingByOrderId) return existingByOrderId;

    // ── Idempotency Guard 2: check by razorpay_payment_id (browser + webhook race) ──
    // payments.razorpay_payment_id has a UNIQUE constraint so only one can commit.
    // This check catches the case where the webhook and browser both pass Guard 1
    // (under concurrent execution with READ COMMITTED isolation) — the second caller
    // will find the payment row already committed and return the linked order.
    const [existingPayment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.razorpay_payment_id, razorpayPaymentId))
      .limit(1);

    if (existingPayment) {
      const [existingOrder] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, existingPayment.order_id))
        .limit(1);
      if (existingOrder) return existingOrder;
    }

    // ── Step 1: Atomically decrement stock ──
    for (const item of checkout.items) {
      if (!/^[A-Z0-9]{1,10}$/.test(item.size)) {
        throw new Error(`Invalid size value: ${item.size}`);
      }

      const result = await tx.execute(
        sql`
          UPDATE products
          SET stock = jsonb_set(
            stock,
            ${sql.raw(`'{${item.size}}'`)},
            to_jsonb(
              GREATEST(0, (COALESCE(stock->>'${sql.raw(item.size)}', '0'))::int - ${item.quantity})
            )
          )
          WHERE id = ${item.id}
            AND (COALESCE(stock->>'${sql.raw(item.size)}', '0'))::int >= ${item.quantity}
          RETURNING id
        `
      );

      const rows = (result as any).rows ?? result ?? [];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(
          `OUT_OF_STOCK: insufficient stock for product ${item.id} size ${item.size}`
        );
      }
    }

    // ── Step 2: Increment discount coupon usage count / mark drift coupon used ──
    if (checkout.discount_code) {
      const isDriftCode = checkout.discount_code === 'DRFTNMODEON20' || checkout.discount_code.startsWith('DRIFT');
      if (isDriftCode) {
        if (checkout.user_id) {
          await tx
            .update(schema.driftModeCoupons)
            .set({ used: true, used_at: new Date() })
            .where(eq(schema.driftModeCoupons.user_id, checkout.user_id));
        }
      } else {
        await tx
          .update(schema.discountCodes)
          .set({ used_count: sql`${schema.discountCodes.used_count} + 1` })
          .where(eq(schema.discountCodes.code, checkout.discount_code));
      }
    }

    // ── Step 3: Insert order row (with order_number collision retry) ──
    let newOrder: any = null;
    let orderNumberToUse = checkout.order_number;
    let retries = 5;

    const paidAt = new Date();
    const cancelAllowedUntil = new Date(paidAt.getTime() + 5 * 60 * 1000);
    const isCod = checkout.payment_type === 'cod_with_deposit' || checkout.payment_type === 'cod';

    while (retries > 0) {
      try {
        const [inserted] = await tx
          .insert(schema.orders)
          .values({
            id: checkout.id,
            user_id: checkout.user_id,
            order_number: orderNumberToUse,
            customer_name: checkout.customer_name,
            customer_email: checkout.customer_email,
            customer_phone: checkout.customer_phone,
            shipping_address: checkout.shipping_address,
            items: checkout.items,
            subtotal: checkout.subtotal,
            shipping_charge: checkout.shipping_charge,
            discount_code: checkout.discount_code,
            discount_amount: checkout.discount_amount,
            total: checkout.total,
            payment_status: isCod ? 'partially_paid' : 'paid',
            payment_id: razorpayPaymentId,
            order_status: 'CANCELLATION_WINDOW',
            fulfillment_type: checkout.fulfillment_type,
            pickup_status: checkout.pickup_status,
            pickup_code: checkout.pickup_code,
            payment_type: isCod ? 'cod' : 'prepaid',
            booking_amount: isCod ? 20000 : 0,
            remaining_amount: isCod ? (checkout.total - 20000) : 0,
            deposit_amount: checkout.deposit_amount,
            deposit_status: isCod ? 'paid' : null,
            verified_phone: checkout.verified_phone,
            courier_partner: null,
            tracking_number: null,
            shiprocket_order_id: null,
            courier_provider: checkout.courier_provider,
            zone: checkout.zone,
            invoice_number: null,
            paid_at: paidAt,
            cancel_allowed_until: cancelAllowedUntil,
            hold_expires_at: null,
            razorpay_order_id: checkout.razorpay_order_id,
            created_at: new Date(checkout.created_at || Date.now()),
            updated_at: new Date(),
          })
          .returning();

        newOrder = inserted;
        break;
      } catch (err: any) {
        // Only retry on order_number unique collision (code 23505).
        // Any other error (including duplicate order id from concurrent calls) is re-thrown
        // so the transaction rolls back cleanly.
        const isOrderNumberCollision =
          err?.code === '23505' &&
          (err?.message?.includes('orders_order_number_unique') ||
            err?.message?.includes('order_number'));

        if (isOrderNumberCollision && retries > 1) {
          retries--;
          const crypto = await import('crypto');
          const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
          const bytes = crypto.randomBytes(6);
          let randomStr = '';
          for (let i = 0; i < 6; i++) {
            randomStr += chars[bytes[i] % chars.length];
          }
          orderNumberToUse = `DRFTN-${randomStr}`;
          console.warn(
            `[confirmAndWriteOrder] order_number collision on ${checkout.order_number}. Retrying with ${orderNumberToUse}...`
          );
        } else if (err?.code === '23505' && err?.message?.includes('orders_pkey')) {
          // Duplicate primary key = concurrent call already committed — return that order
          const [alreadyInserted] = await tx
            .select()
            .from(schema.orders)
            .where(eq(schema.orders.id, checkout.id))
            .limit(1);
          if (alreadyInserted) return alreadyInserted;
          throw err;
        } else {
          throw err;
        }
      }
    }

    if (!newOrder) {
      throw new Error('Failed to insert order after all retries');
    }

    // ── Step 4: Insert payment record ──
    // NO .catch() — failure here MUST roll back the entire transaction.
    // An order without a payment record is a ghost order.
    await tx.insert(schema.payments).values({
      order_id: newOrder.id,
      razorpay_order_id: checkout.razorpay_order_id,
      razorpay_payment_id: razorpayPaymentId,
      amount: isCod ? 20000 : checkout.total,
      status: 'captured',
      payment_type: isCod ? 'cod_booking' : 'prepaid',
      is_booking_payment: isCod,
      created_at: paidAt,
      updated_at: paidAt,
    });

    // ── Step 5: Insert durable shipping job ──
    // NO .catch() — failure here MUST roll back the entire transaction.
    // An order without a shipping job will never be fulfilled.
    await tx.insert(schema.shippingJobs).values({
      order_id: newOrder.id,
      run_after: cancelAllowedUntil,
      status: 'PENDING',
      attempts: 0,
      created_at: paidAt,
      updated_at: paidAt,
    });

    return newOrder;
  });

  // ── Step 6 (POST-COMMIT): Publish delayed QStash message (+5 minutes) ──
  // Executed ONLY after the database transaction has successfully committed.
  // If the transaction rolled back, execution never reaches here.
  if (confirmedOrder && confirmedOrder.id) {
    try {
      const [job] = await db
        .select()
        .from(schema.shippingJobs)
        .where(eq(schema.shippingJobs.order_id, confirmedOrder.id))
        .limit(1);

      if (job && job.status === 'PENDING') {
        const crypto = await import('crypto');
        const correlationId = crypto.randomUUID();
        const { publishQStashShippingJobIdempotent } = await import('@/lib/orchestration/qstash-client');

        // Fire-and-forget — checkout response is NOT blocked on QStash delivery.
        // publishQStashShippingJobIdempotent handles retries internally.
        // On permanent failure it resets the sentinel so admin requeue can recover.
        publishQStashShippingJobIdempotent({
          shippingJobId: job.id,
          orderId: confirmedOrder.id,
          correlationId,
          delaySeconds: 300, // 5-minute cancellation window
        }).catch((err) =>
          console.error('[confirmAndWriteOrder] Post-commit QStash publish exception (non-fatal):', err)
        );
      }

    } catch (publishErr) {
      console.error('[confirmAndWriteOrder] Failed to schedule QStash message post-commit:', publishErr);
    }
  }

  return confirmedOrder;
}

