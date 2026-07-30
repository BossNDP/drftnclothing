import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { writeAuditLog } from './audit-service';

export type OrderState =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CANCELLATION_WINDOW'
  | 'READY_FOR_SHIPPING'
  | 'SHIPPING_CREATED'
  | 'PICKUP_BOOKED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';

const ALLOWED_TRANSITIONS: Record<OrderState, OrderState[]> = {
  CREATED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAID: ['CANCELLATION_WINDOW', 'READY_FOR_SHIPPING', 'CANCELLED'],
  CANCELLATION_WINDOW: ['READY_FOR_SHIPPING', 'CANCELLED'],
  READY_FOR_SHIPPING: ['SHIPPING_CREATED', 'CANCELLED'],
  SHIPPING_CREATED: ['PICKUP_BOOKED', 'CANCELLED'],
  PICKUP_BOOKED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['REFUND_REQUESTED'],
  REFUND_REQUESTED: ['REFUNDED'],
  CANCELLED: [],
  PAYMENT_FAILED: [],
  REFUNDED: [],
};

export function canTransitionOrder(currentStatus: string, targetState: OrderState): boolean {
  // Normalize legacy status strings if any exist in legacy orders
  let normalizedCurrent = currentStatus.toUpperCase() as OrderState;
  if ((currentStatus as string) === 'placed') normalizedCurrent = 'CREATED';
  if ((currentStatus as string) === 'pending_payment') normalizedCurrent = 'PAYMENT_PENDING';
  if ((currentStatus as string) === 'confirmed') normalizedCurrent = 'PAID';
  if ((currentStatus as string) === 'shipped') normalizedCurrent = 'IN_TRANSIT';

  const allowed = ALLOWED_TRANSITIONS[normalizedCurrent];
  if (!allowed) return false;
  return allowed.includes(targetState);
}

export async function transitionOrderStatus(params: {
  orderId: string;
  currentStatus: string;
  targetState: OrderState;
  reason?: string;
  workerId?: string;
  correlationId?: string;
  clientTx?: any;
}) {
  const { orderId, currentStatus, targetState, reason, workerId, correlationId, clientTx } = params;
  const dbClient = clientTx || db;

  if (!canTransitionOrder(currentStatus, targetState)) {
    throw new Error(
      `INVALID_STATE_TRANSITION: Cannot transition order ${orderId} from ${currentStatus} to ${targetState}`
    );
  }

  await dbClient
    .update(schema.orders)
    .set({
      order_status: targetState,
      updated_at: new Date(),
    })
    .where(eq(schema.orders.id, orderId));

  await writeAuditLog({
    orderId,
    correlationId,
    action: `ORDER_STATE_TRANSITION:${currentStatus}->${targetState}`,
    workerId,
    details: { currentStatus, targetState, reason },
    clientTx: dbClient,
  });

  return targetState;
}
