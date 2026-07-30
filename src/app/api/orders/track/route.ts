import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/orchestration/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success, resetSec } = await checkRateLimit({
      endpoint: 'track',
      ip,
    });

    if (!success) {
      return NextResponse.json(
        { error: `Too many tracking attempts. Please retry in ${resetSec} seconds.` },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber');
    const phone = searchParams.get('phone');

    if (!orderNumber || !phone) {
      return NextResponse.json({ error: 'Both orderNumber and phone are required for tracking' }, { status: 400 });
    }

    const cleanOrderNumber = orderNumber.trim().toUpperCase();
    const cleanPhone = phone.trim();

    // 1. Fetch order directly from Neon DB (ONLY source of truth)
    const [order] = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.order_number, cleanOrderNumber))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: 'No matching order found. Please check order number.' },
        { status: 404 }
      );
    }

    // 2. Validate phone match (full phone or ending digits)
    const phoneMatches =
      order.customer_phone === cleanPhone ||
      order.customer_phone.endsWith(cleanPhone) ||
      (cleanPhone.length >= 4 && order.customer_phone.endsWith(cleanPhone.slice(-4)));

    if (!phoneMatches) {
      return NextResponse.json(
        { error: 'Authentication failed: Phone number mismatch for this order number.' },
        { status: 403 }
      );
    }

    // 3. Fetch shipment events from Neon DB
    const events = await db
      .select()
      .from(schema.shipmentEvents)
      .where(eq(schema.shipmentEvents.order_id, order.id))
      .orderBy(desc(schema.shipmentEvents.event_timestamp));

    const productIds = ((order.items as any[]) || []).map((i: any) => i.id || i.productId);
    const fallbackImages =
      productIds.length > 0
        ? await db
            .select()
            .from(schema.productImages)
            .where(inArray(schema.productImages.product_id, productIds))
        : [];

    const imageMap = new Map<string, string>();
    fallbackImages.forEach((img: any) => {
      if (!imageMap.has(img.product_id)) {
        imageMap.set(img.product_id, img.image_url);
      }
    });

    const sanitizedItems = ((order.items as any[]) || []).map((item: any) => ({
      name: item.name,
      size: item.size,
      quantity: item.quantity,
      image: item.image || imageMap.get(item.id || item.productId) || '',
      price: item.price,
    }));

    const pincode = order.shipping_address?.pincode || '';
    const isLocalCity = pincode.startsWith('560');
    const estDaysText = isLocalCity ? '1-2 business days' : '3-5 business days';

    return NextResponse.json({
      order_number: order.order_number,
      order_status: order.order_status,
      payment_status: order.payment_status,
      fulfillment_type: order.fulfillment_type,
      created_at: order.created_at.toISOString(),
      items: sanitizedItems,
      total: order.total,
      subtotal: order.subtotal,
      shipping_charge: order.shipping_charge,
      discount_amount: order.discount_amount || 0,
      awb_code: order.awb_code || order.tracking_number || null,
      tracking_number: order.awb_code || order.tracking_number || null,
      courier_name: order.courier_name || order.courier_partner || null,
      tracking_url: order.tracking_url || null,
      label_url: order.label_url || null,
      estimated_delivery_text: estDaysText,
      events: events.map((e: any) => ({
        status: e.status,
        courier: e.courier,
        location: e.location,
        description: e.description,
        timestamp: e.event_timestamp ? new Date(e.event_timestamp).toISOString() : new Date().toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Track Order API Error]:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during tracking lookup' }, { status: 500 });
  }
}
