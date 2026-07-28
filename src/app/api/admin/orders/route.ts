import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function formatOrderRow(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    order_number: r.order_number,
    customer_name: r.customer_name,
    customer_email: r.customer_email,
    customer_phone: r.customer_phone,
    shipping_address: r.shipping_address,
    items: r.items,
    subtotal: Number(r.subtotal || 0),
    shipping_charge: Number(r.shipping_charge ?? r.shipping_fee ?? 0),
    discount_code: r.discount_code || null,
    discount_amount: Number(r.discount_amount || 0),
    total: Number(r.total ?? r.total_amount ?? 0),
    payment_status: r.payment_status === 'refunded' ? 'failed' : (r.payment_status || 'pending'),
    payment_id: r.payment_id || r.razorpay_payment_id || undefined,
    order_status: r.order_status || r.status || 'placed',
    fulfillment_type: r.fulfillment_type || 'delivery',
    pickup_status: r.pickup_status || null,
    pickup_code: r.pickup_code || null,
    tracking_number: r.tracking_number || undefined,
    courier_partner: r.courier_partner || undefined,
    payment_type: r.payment_type || 'prepaid',
    deposit_amount: r.deposit_amount || null,
    remaining_amount: r.remaining_amount || null,
    deposit_status: r.deposit_status || null,
    verified_phone: r.verified_phone || null,
    razorpay_order_id: r.razorpay_order_id || undefined,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      try {
        const [r] = await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, id))
          .limit(1);

        if (!r) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        return NextResponse.json({ order: formatOrderRow(r) });
      } catch (e) {
        const raw: any = await db.execute(sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`);
        const row = raw.rows?.[0] || (Array.isArray(raw) ? raw[0] : null);
        if (!row) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        return NextResponse.json({ order: formatOrderRow(row) });
      }
    }

    let list: any[] = [];
    try {
      list = await db
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.created_at));
    } catch (dbErr) {
      console.warn('Drizzle select error, falling back to SQL execute:', dbErr);
      const raw: any = await db.execute(sql`SELECT * FROM orders ORDER BY created_at DESC`);
      list = (raw.rows || (Array.isArray(raw) ? raw : [])) as any[];
    }

    const formattedOrders = list.map(formatOrderRow).filter(Boolean);
    return NextResponse.json({ orders: formattedOrders });
  } catch (error: any) {
    console.error('Admin orders GET error:', error);
    return NextResponse.json({ orders: [], error: error?.message || 'Failed to fetch orders' });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Order ID parameter is required' }, { status: 400 });
    }

    const body = await request.json();

    const [updatedOrder] = await db
      .update(schema.orders)
      .set({
        ...body,
        updated_at: new Date(),
      })
      .where(eq(schema.orders.id, id))
      .returning();

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Admin orders PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
