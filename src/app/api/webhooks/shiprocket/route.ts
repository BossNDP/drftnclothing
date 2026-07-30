import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { transitionOrderStatus, OrderState } from '@/lib/orchestration/order-state-machine';
import { writeAuditLog } from '@/lib/orchestration/audit-service';

export async function POST(request: Request) {
  let eventId = '';

  try {
    const tokenHeader = request.headers.get('x-shiprocket-token') || request.headers.get('authorization');
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;

    if (expectedToken && tokenHeader !== expectedToken && tokenHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized Shiprocket Webhook token' }, { status: 401 });
    }

    const payload = await request.json();
    const { order_id, awb, current_status, courier_name, location, etd } = payload;

    if (!order_id && !awb) {
      return NextResponse.json({ error: 'Missing order_id or awb' }, { status: 400 });
    }

    eventId = `shiprocket_${order_id || awb}_${current_status}_${payload.timestamp || Date.now()}`;

    // Idempotency check via webhook_events table
    const [existingEvent] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.event_id, eventId))
      .limit(1);

    if (existingEvent && existingEvent.processed) {
      return NextResponse.json({ success: true, message: 'Event already processed' });
    }

    if (!existingEvent) {
      await db.insert(schema.webhookEvents).values({
        provider: 'shiprocket',
        event_type: current_status || 'STATUS_UPDATE',
        event_id: eventId,
        payload,
        processed: false,
      });
    }

    // Find Order in Neon DB
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(
        or(
          order_id ? eq(schema.orders.order_number, String(order_id)) : undefined,
          order_id ? eq(schema.orders.shiprocket_order_id, String(order_id)) : undefined,
          awb ? eq(schema.orders.awb_code, String(awb)) : undefined
        )
      )
      .limit(1);

    if (!order) {
      console.warn(`[Shiprocket Webhook] Order not found for order_id: ${order_id}, awb: ${awb}`);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Map Shiprocket status to OrderState
    const rawStatus = (current_status || '').toUpperCase();
    let targetState: OrderState | null = null;

    if (rawStatus.includes('PICKED UP') || rawStatus.includes('IN TRANSIT') || rawStatus.includes('SHIPPED')) {
      targetState = 'IN_TRANSIT';
    } else if (rawStatus.includes('OUT FOR DELIVERY')) {
      targetState = 'OUT_FOR_DELIVERY';
    } else if (rawStatus.includes('DELIVERED')) {
      targetState = 'DELIVERED';
    }

    // Write shipment event
    await db.insert(schema.shipmentEvents).values({
      order_id: order.id,
      status: current_status || 'UPDATED',
      courier: courier_name || order.courier_name || 'Shiprocket Partner',
      location: location || null,
      description: payload.scans?.[0]?.location || current_status,
      event_timestamp: new Date(),
      raw_data: payload,
    });

    // Update order fields
    await db
      .update(schema.orders)
      .set({
        awb_code: awb || order.awb_code,
        courier_name: courier_name || order.courier_name,
        tracking_number: awb || order.tracking_number,
        updated_at: new Date(),
      })
      .where(eq(schema.orders.id, order.id));

    // Transition OrderState if state progression occurred
    if (targetState && order.order_status !== targetState) {
      try {
        await transitionOrderStatus({
          orderId: order.id,
          currentStatus: order.order_status,
          targetState,
          reason: `Shiprocket webhook status update: ${current_status}`,
        });
      } catch (fsmErr) {
        console.warn(`[Shiprocket Webhook] Could not transition order ${order.order_number}:`, fsmErr);
      }
    }

    await db
      .update(schema.webhookEvents)
      .set({ processed: true, processed_at: new Date() })
      .where(eq(schema.webhookEvents.event_id, eventId));

    await writeAuditLog({
      orderId: order.id,
      action: 'WEBHOOK:SHIPROCKET_STATUS_UPDATED',
      details: { current_status, awb, courier_name },
    });

    return NextResponse.json({ success: true, processed: true });
  } catch (err: any) {
    console.error('[Shiprocket Webhook Error]:', err);
    if (eventId) {
      await db
        .update(schema.webhookEvents)
        .set({ error: err?.message || String(err) })
        .where(eq(schema.webhookEvents.event_id, eventId))
        .catch(() => {});
    }
    return NextResponse.json({ error: 'Shiprocket webhook processing error' }, { status: 500 });
  }
}
