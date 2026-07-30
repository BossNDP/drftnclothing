import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { transitionOrderStatus } from './order-state-machine';
import { writeAuditLog } from './audit-service';
import { releaseUnitSafe } from '@/lib/stock-gate';

/**
 * requestOrderCancellation
 *
 * IDEMPOTENT & RACE-SAFE:
 * Uses Postgres FOR UPDATE row lock to safely check order_status and cancel_allowed_until.
 * Cancels pending shipping job, releases reserved stock back to PostgreSQL and Redis,
 * and flags the order with needs_manual_refund = true for admin review.
 */
export async function requestOrderCancellation(params: {
  orderId: string;
  userId?: string | null;
  reason?: string;
  correlationId?: string;
}) {
  const { orderId, userId, reason = 'Customer requested cancellation', correlationId } = params;

  const { order, alreadyCancelled } = await db.transaction(async (tx: any) => {
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
        'CANCELLATION_WINDOW_EXPIRED: The cancellation window has passed. Order cannot be cancelled.'
      );
    }

    // Validate state hasn't progressed past cancellable states
    const nonCancellableStates = ['SHIPPING_CREATED', 'PICKUP_BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    if (nonCancellableStates.includes(order.order_status)) {
      throw new Error(
        `ORDER_NOT_CANCELLABLE: Order is already in ${order.order_status} state and cannot be cancelled.`
      );
    }

    if (order.order_status === 'CANCELLED') {
      return { order, alreadyCancelled: true };
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

    // Flag for manual refund review instead of auto-refund
    await tx
      .update(schema.orders)
      .set({
        needs_manual_refund: true,
        updated_at: new Date(),
      })
      .where(eq(schema.orders.id, order.id));

    // Release reserved inventory back to catalog in PostgreSQL
    const itemsList = (order.items as any[]) || [];
    for (const item of itemsList) {
      const itemId = item.id || item.productId;
      const itemSize = item.size;
      const itemQty = Number(item.quantity || 1);

      if (itemId && itemSize) {
        await tx.execute(
          sql`
            UPDATE products
            SET stock = jsonb_set(
              stock,
              ${sql.raw(`'{${itemSize}}'`)},
              to_jsonb(
                (COALESCE(stock->>'${sql.raw(itemSize)}', '0'))::int + ${itemQty}
              )
            )
            WHERE id = ${itemId}
          `
        );

        // Also release in Redis stock gate
        await releaseUnitSafe(itemId, itemSize, itemQty);
      }
    }

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

    await writeAuditLog({
      orderId: order.id,
      correlationId,
      action: 'ORDER_CANCELLED_MANUAL_REFUND_REQUIRED',
      details: { reason, needs_manual_refund: true },
      clientTx: tx,
    });

    return { order, alreadyCancelled: false };
  });

  if (alreadyCancelled) {
    return { success: true, message: 'Order is already cancelled' };
  }

  return {
    success: true,
    orderNumber: order.order_number,
    message: 'Order successfully cancelled. Flagged for manual refund review.',
  };
}
