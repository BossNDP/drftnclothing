import { NextResponse } from 'next/server';
import {
  createCheckoutReservation,
  extendCheckoutReservation,
  releaseCheckoutReservation,
  ReservationMetadata,
} from '@/lib/checkout-reservation';
import { redis } from '@/lib/redis';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { getOptimizedImageUrl } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/reserve
 * Handles actions: 'create' | 'extend' | 'release' | 'admin_release'
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = 'create', userId = 'guest_user', items, holdId } = body;

    if (action === 'create') {
      const result = await createCheckoutReservation({ userId, items });
      if (!result.success) {
        return NextResponse.json({ error: result.message, failedItem: result.failedItem }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === 'extend') {
      if (!holdId) return NextResponse.json({ error: 'holdId required' }, { status: 400 });
      const result = await extendCheckoutReservation(holdId);
      return NextResponse.json(result);
    }

    if (action === 'release' || action === 'admin_release') {
      if (!holdId) return NextResponse.json({ error: 'holdId required' }, { status: 400 });
      await releaseCheckoutReservation(holdId);
      return NextResponse.json({ success: true, message: 'Reservation released' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/checkout/reserve] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/checkout/reserve
 * Fetches active holds list for Admin Dashboard or specific holdId status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const holdId = searchParams.get('holdId');

    if (holdId) {
      const metadataKey = `hold_meta:${holdId}`;
      const rawMeta = await redis.get<string | ReservationMetadata>(metadataKey);
      if (!rawMeta) {
        return NextResponse.json({ active: false });
      }
      const meta: ReservationMetadata = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
      const secondsRemaining = Math.max(0, Math.floor((meta.expiresAt - Date.now()) / 1000));
      return NextResponse.json({ active: secondsRemaining > 0, meta, secondsRemaining });
    }

    // Admin Dashboard list query
    const metaKeys = await redis.keys('hold_meta:*');
    const activeHolds: any[] = [];

    const productIdsSet = new Set<string>();
    const tempMetas: ReservationMetadata[] = [];

    for (const key of metaKeys) {
      const raw = await redis.get<string | ReservationMetadata>(key);
      if (raw) {
        const meta: ReservationMetadata = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const secondsRemaining = Math.max(0, Math.floor((meta.expiresAt - Date.now()) / 1000));
        if (secondsRemaining > 0) {
          tempMetas.push(meta);
          for (const item of meta.items) {
            productIdsSet.add(item.productId);
          }
        }
      }
    }

    let productMap = new Map<string, any>();
    if (productIdsSet.size > 0) {
      const prods = await db
        .select()
        .from(schema.products)
        .where(inArray(schema.products.id, Array.from(productIdsSet)));
      productMap = new Map<string, any>(prods.map((p: any) => [p.id, p]));
    }

    for (const meta of tempMetas) {
      const secondsRemaining = Math.max(0, Math.floor((meta.expiresAt - Date.now()) / 1000));
      const formattedItems = meta.items.map((item) => {
        const p = productMap.get(item.productId);
        return {
          productId: item.productId,
          name: p?.name || 'Garment Item',
          image: p?.images[0] ? getOptimizedImageUrl(p.images[0], 200) : '',
          size: item.size,
          quantity: item.quantity,
          price: p?.price || 0,
        };
      });

      activeHolds.push({
        holdId: meta.holdId,
        userId: meta.userId,
        createdAt: new Date(meta.createdAt).toISOString(),
        expiresAt: new Date(meta.expiresAt).toISOString(),
        secondsRemaining,
        extended: meta.extended,
        items: formattedItems,
      });
    }

    return NextResponse.json({
      activeHoldsCount: activeHolds.length,
      holds: activeHolds,
    });
  } catch (err: any) {
    console.error('[API GET /api/checkout/reserve] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
