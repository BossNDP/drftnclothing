import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { dbHttp } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  try {
    // 1. Try Redis fast-cache first
    const keys = SIZES.map((s) => `stock:${id}:${s}`);
    const values = await redis.mget<(string | null)[]>(...keys).catch(() => []);

    const stock: Record<string, number> = {};
    let hasRedisData = false;

    if (Array.isArray(values)) {
      SIZES.forEach((size, idx) => {
        const val = values[idx];
        if (val !== null && val !== undefined) {
          stock[size] = Math.max(0, Number(val));
          hasRedisData = true;
        }
      });
    }

    if (hasRedisData) {
      return NextResponse.json(
        { stock },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    // 2. Single indexed query targeting ONLY stock_quantity column for this product ID via dbHttp
    const [p] = await dbHttp
      .select({ stock_quantity: schema.products.stock_quantity })
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);

    const liveStock = p?.stock_quantity || {};

    return NextResponse.json(
      { stock: liveStock },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err) {
    console.error('[Stock API] Live stock read failed:', err);
    return NextResponse.json({ error: 'Failed to fetch stock' }, { status: 500 });
  }
}
