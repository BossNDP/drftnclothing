import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { transitionOrderStatus } from './order-state-machine';
import { razorpay } from '@/lib/razorpay';
import { writeAuditLog } from './audit-service';

/**
 * requestOrderCancellation
 *
 * TRANSACTION SAFETY:
 * Razorpay refund is intentionally called OUTSIDE the DB transaction.
 * An HTTP call inside a transaction holds a Neon connection open for the
 * full duration of the Razorpay round-trip (~200–2000 ms), which exhausts
 * the connection pool under load.
 *
 * Flow:
 *   Phase 1 (transaction): cancel order + shipping job, fetch payment info → COMMIT
 *   Phase 2 (post-commit):  call Razorpay refund → update payment status in DB
 */
export async function requestOrderCancellation(params: {
  orderId: string;
  userId?: string | null;
  reason?: string;
  correlationId?: string;
}) {
  const { orderId, userId, reason = 'Customer requested cancellation', correlationId } = params;

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: Database transaction — only DB operations, no external HTTP
  // ─────────────────────────────────────────────────────────────────────────
  const { order, paymentRecord, alreadyCancelled } = await db.transaction(async (tx: any) => {
    // Fetch latest order state with FOR UPDATE to prevent concurrent cancel+ship race
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) {
      throw new Error('ORDER_NOT_FOUND: Order does not exist');
    }

    if (userId && order.user_id && order.user_id !== userId) {
      throw new Error('UNAUTHORIZED: Order does not belong to user');
    }

    const now = new Date();

    // Validate 5-minute cancellation window
    if (order.cancel_allowed_until && now > new Date(order.cancel_allowed_until)) {
      throw new Error(
        'CANCELLATION_WINDOW_EXPIRED: The 5-minute cancellation window has passed. Order cannot be cancelled.'
      );
    }

    if (order.order_status === 'CANCELLED') {
      return { order, paymentRecord: null, alreadyCancelled: true };
    }

    // Transition order to CANCELLED via FSM
    await transitionOrderStatus({
      orderId: order.id,
      currentStatus: order.order_status,
      targetState: 'CANCELLED',
      reason,
      correlationId,
      clientTx: tx,
    });

    // Cancel any pending shipping job atomically
    await tx
      .update(schema.shippingJobs)
      .set({
        status: 'FAILED',
        last_error: `Order cancelled by customer: ${reason}`,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(schema.shippingJobs.order_id, order.id),
          eq(schema.shippingJobs.status, 'PENDING')
        )
      );

    // Fetch the captured payment record (needed after commit for the Razorpay call)
    const [paymentRecord] = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.order_id, order.id), eq(schema.payments.status, 'captured')))
      .limit(1);

    await writeAuditLog({
      orderId: order.id,
      correlationId,
      action: 'ORDER_CANCELLED_WITHIN_WINDOW',
      details: { reason },
      clientTx: tx,
    });

    return { order, paymentRecord, alreadyCancelled: false };
  });
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1 COMPLETE — transaction committed. Connection released.
  // ─────────────────────────────────────────────────────────────────────────

  if (alreadyCancelled) {
    return { success: true, message: 'Order is already cancelled' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: Razorpay refund — executed AFTER transaction commit
  // This ensures the Neon connection is released before the HTTP round-trip.
  // ─────────────────────────────────────────────────────────────────────────
  const razorpayPaymentId = paymentRecord?.razorpay_payment_id || order.payment_id;

  if (razorpayPaymentId && razorpay && !razorpayPaymentId.startsWith('pay_mock_')) {
    try {
      const refundAmount =
        order.payment_type === 'cod' ? (order.booking_amount || 20000) : order.total;

      await razorpay.payments.refund(razorpayPaymentId, {
        amount: refundAmount,
        notes: {
          reason: `Order ${order.order_number} cancelled within window`,
          order_id: order.id,
        },
      });

      // Update payment + order refund status after successful Razorpay response
      await db.transaction(async (tx: any) => {
        if (paymentRecord) {
          await tx
            .update(schema.payments)
            .set({ status: 'refunded', updated_at: new Date() })
            .where(eq(schema.payments.id, paymentRecord.id));
        }

        await tx
          .update(schema.orders)
          .set({ payment_status: 'refunded', updated_at: new Date() })
          .where(eq(schema.orders.id, order.id));

        await writeAuditLog({
          orderId: order.id,
          correlationId,
          action: 'ORDER_REFUND_PROCESSED',
          details: { razorpayPaymentId, refundAmount },
          clientTx: tx,
        });
      });

    } catch (refundErr: any) {
      // Refund failure is non-fatal to cancellation — order is already cancelled in DB.
      // Log prominently so support can manually process the refund.
      console.error(
        `[CancellationService] Razorpay refund FAILED for order ${order.order_number}. ` +
        `Payment ID: ${razorpayPaymentId}. Manual refund required.`,
        refundErr
      );
      await writeAuditLog({
        orderId: order.id,
        correlationId,
        action: 'ORDER_REFUND_FAILED_MANUAL_REVIEW_REQUIRED',
        details: {
          razorpayPaymentId,
          error: refundErr?.message || String(refundErr),
        },
      });
    }
  }

  return {
    success: true,
    orderNumber: order.order_number,
    message: 'Order successfully cancelled. Refund initiated if applicable.',
  };
}
