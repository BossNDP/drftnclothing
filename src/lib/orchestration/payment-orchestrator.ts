import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { transitionOrderStatus } from './order-state-machine';
import { writeAuditLog } from './audit-service';
import crypto from 'crypto';

export interface ProcessVerifiedPaymentInput {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paymentType: 'cod' | 'prepaid';
  amountPaise: number;
  rawPayload?: any;
  workerId?: string;
  correlationId?: string;
}

export async function processVerifiedPayment(input: ProcessVerifiedPaymentInput) {
  const {
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    paymentType,
    amountPaise,
    rawPayload,
    workerId,
    correlationId = crypto.randomUUID(),
  } = input;

  return await db.transaction(async (tx: any) => {
    // 1. Lock Order record for update
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: Order ${orderId} does not exist`);
    }

    // Idempotency check: if already paid, return early
    if (order.order_status === 'PAID' || order.order_status === 'CANCELLATION_WINDOW' || order.payment_status === 'paid') {
      return order;
    }

    // 2. Verify payment amount
    const isCod = paymentType === 'cod' || order.payment_type === 'cod';
    const expectedPaymentAmount = isCod ? (order.booking_amount || 20000) : order.total;

    if (amountPaise > 0 && amountPaise !== expectedPaymentAmount) {
      console.warn(`[PaymentOrchestrator] Amount mismatch: received ${amountPaise}, expected ${expectedPaymentAmount}`);
    }

    const paidAt = new Date();
    const cancelAllowedUntil = new Date(paidAt.getTime() + 5 * 60 * 1000); // paidAt + 5 minutes

    // 3. Record in payments table
    await tx.insert(schema.payments).values({
      order_id: order.id,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      amount: amountPaise || expectedPaymentAmount,
      status: 'captured',
      payment_type: isCod ? 'cod_booking' : 'prepaid',
      is_booking_payment: isCod,
      raw_payload: rawPayload || null,
      created_at: paidAt,
      updated_at: paidAt,
    });

    // 4. Update Order status & payment details
    const paymentStatus = isCod ? 'partially_paid' : 'paid';

    await tx
      .update(schema.orders)
      .set({
        payment_status: paymentStatus,
        payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        paid_at: paidAt,
        cancel_allowed_until: cancelAllowedUntil,
        updated_at: paidAt,
      })
      .where(eq(schema.orders.id, order.id));

    // 5. Transition Order through FSM: CREATED -> PAYMENT_PENDING -> PAID -> CANCELLATION_WINDOW
    let currentStatus = order.order_status;
    if (currentStatus === 'CREATED') {
      await transitionOrderStatus({
        orderId: order.id,
        currentStatus: 'CREATED',
        targetState: 'PAYMENT_PENDING',
        correlationId,
        clientTx: tx,
      });
      currentStatus = 'PAYMENT_PENDING';
    }

    if (currentStatus === 'PAYMENT_PENDING') {
      await transitionOrderStatus({
        orderId: order.id,
        currentStatus: 'PAYMENT_PENDING',
        targetState: 'PAID',
        correlationId,
        clientTx: tx,
      });
      currentStatus = 'PAID';
    }

    if (currentStatus === 'PAID') {
      await transitionOrderStatus({
        orderId: order.id,
        currentStatus: 'PAID',
        targetState: 'CANCELLATION_WINDOW',
        correlationId,
        clientTx: tx,
      });
    }

    // 6. Insert Durable Shipping Job with run_after = cancelAllowedUntil
    const [existingJob] = await tx
      .select()
      .from(schema.shippingJobs)
      .where(eq(schema.shippingJobs.order_id, order.id))
      .limit(1);

    if (!existingJob) {
      await tx.insert(schema.shippingJobs).values({
        order_id: order.id,
        run_after: cancelAllowedUntil,
        status: 'PENDING',
        attempts: 0,
        created_at: paidAt,
        updated_at: paidAt,
      });
    }

    await writeAuditLog({
      orderId: order.id,
      correlationId,
      action: 'PAYMENT_VERIFIED_AND_SHIPPING_JOB_SCHEDULED',
      workerId,
      details: {
        paymentType: isCod ? 'COD' : 'PREPAID',
        amountPaise,
        cancelAllowedUntil: cancelAllowedUntil.toISOString(),
      },
      clientTx: tx,
    });

    const [updatedOrder] = await tx.select().from(schema.orders).where(eq(schema.orders.id, order.id)).limit(1);
    return updatedOrder;
  });
}
