import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { desc, gte, eq } from 'drizzle-orm';

/**
 * NOT SHOPIFY APPS:
 * Real purchase social proof API query.
 * Queries actual order events from Neon database created in the last 24 hours.
 * Anonymized strictly to City level (e.g. "Someone in Bengaluru purchased 18 minutes ago").
 * Zero fake notification widgets or artificial counter scripts.
 */
export async function GET() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentOrders = await db
      .select({
        id: schema.orders.id,
        created_at: schema.orders.created_at,
        shipping_address: schema.orders.shipping_address,
        items: schema.orders.items,
      })
      .from(schema.orders)
      .where(gte(schema.orders.created_at, twentyFourHoursAgo))
      .orderBy(desc(schema.orders.created_at))
      .limit(12);

    const formattedEvents = recentOrders
      .map((order: any) => {
        const city = order.shipping_address?.city || 'Bengaluru';
        const firstItem = Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
        const itemName = firstItem?.name || 'Heavyweight Drop';
        const size = firstItem?.size || 'M';

        return {
          id: order.id,
          city,
          itemName,
          size,
          createdAt: order.created_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      events: formattedEvents,
      count: formattedEvents.length,
    });
  } catch (error) {
    console.error('[Recent Purchases API Error]:', error);
    return NextResponse.json({ events: [], count: 0 });
  }
}
