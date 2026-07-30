import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { transitionOrderStatus, OrderState } from '@/lib/orchestration/order-state-machine';
import { writeAuditLog } from '@/lib/orchestration/audit-service';

export async function POST(request: Request) {
  let eventId = '';

  try {
    const tokenHeader = request.headers.get('x-dv-auth-token') || request.headers.get('authorization');
    const expectedToken = process.env.BORZO_WEBHOOK_TOKEN || process.env.BORZO_AUTH_TOKEN;

    if (expectedToken && tokenHeader !== expectedToken && tokenHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized Borzo Webhook token' }, { status: 401 });
    }

    const payload = await request.json();
    const orderData = payload.order || payload;
    const borzoOrderId = String(orderData.order_id || orderData.id || '');
    const status = (orderData.status || payload.event_type || '').toLowerCase();

    if (!borzoOrderId) {
      return NextResponse.json({ error: 'Missing borzo order_id' }, { status: 400 });
    }

    eventId = `borzo_${borzoOrderId}_${status}_${payload.created_at || Date.now()}`;

    // Idempotency check
    const [existingEvent] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.event_id, eventId))
      .limit(1);

    if (existingEvent && existingEvent.processed) {
      return NextResponse.json({ success: true, message: 'Borzo event already processed' });
    }

    if (!existingEvent) {
      await db.insert(schema.webhookEvents).values({
        provider: 'borzo',
        event_type: status,
        event_id: eventId,
        payload,
        processed: false,
      });
    }

    // Query order from Neon DB
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(
        or(
          eq(schema.orders.borzo_order_id, borzoOrderId),
          eq(schema.orders.provider_shipment_id, borzoOrderId)
        )
      )
      .limit(1);

    if (!order) {
      console.warn(`[Borzo Webhook] Order not found for Borzo Order ID: ${borzoOrderId}`);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let targetState: OrderState | null = null;
    if (status.includes('courier_assigned') || status.includes('active') || status.includes('pickup')) {
      targetState = 'IN_TRANSIT';
    } else if (status.includes('delivering') || status.includes('courier_arrived')) {
      targetState = 'OUT_FOR_DELIVERY';
    } else if (status.includes('completed') || status.includes('delivered')) {
      targetState = 'DELIVERED';
    }

    await db.insert(schema.shipmentEvents).values({
      order_id: order.id,
      status,
      courier: 'Borzo Express',
      location: orderData.courier?.address || 'Bangalore',
      description: `Borzo status update: ${status}`,
      event_timestamp: new Date(),
      raw_data: payload,
    });

    if (targetState && order.order_status !== targetState) {
      try {
        await transitionOrderStatus({
          orderId: order.id,
          currentStatus: order.order_status,
          targetState,
          reason: `Borzo webhook update: ${status}`,
        });
      } catch (fsmErr) {
        console.warn(`[Borzo Webhook] Could not transition order ${order.order_number}:`, fsmErr);
      }
    }

    await db
      .update(schema.webhookEvents)
      .set({ processed: true, processed_at: new Date() })
      .where(eq(schema.webhookEvents.event_id, eventId));

    await writeAuditLog({
      orderId: order.id,
      action: 'WEBHOOK:BORZO_STATUS_UPDATED',
      details: { status, borzoOrderId },
    });

    return NextResponse.json({ success: true, processed: true });
  } catch (err: any) {
    console.error('[Borzo Webhook Error]:', err);
    if (eventId) {
      await db
        .update(schema.webhookEvents)
        .set({ error: err?.message || String(err) })
        .where(eq(schema.webhookEvents.event_id, eventId))
        .catch(() => {});
    }
    return NextResponse.json({ error: 'Borzo webhook error' }, { status: 500 });
  }
}
