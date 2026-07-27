import { redis } from './redis';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';

export interface HoldItem {
  productId: string;
  size: string;
  quantity: number;
}

export interface ReservationMetadata {
  holdId: string;
  userId: string;
  items: HoldItem[];
  createdAt: number;
  expiresAt: number;
  extended: boolean;
}

const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const EXTENSION_TTL_SECONDS = 180; // 3 minutes extension
const MAX_TTL_SECONDS = 480; // 8 minutes max

/**
 * Computes available stock for a product size:
 * Available Stock = Real DB Stock - Total Active Redis Checkout Holds
 */
export async function getAvailableStock(productId: string, size: string, dbStock: number): Promise<number> {
  try {
    const holdKeys = await redis.keys(`hold:*:${productId}:${size}`);
    let activeHoldCount = 0;
    for (const key of holdKeys) {
      const val = await redis.get<number | string>(key);
      activeHoldCount += typeof val === 'number' ? val : parseInt(val || '0', 10);
    }
    return Math.max(0, dbStock - activeHoldCount);
  } catch (err) {
    console.error('[Reservation] Redis available stock calculation failed, falling back to DB:', err);
    return dbStock;
  }
}

/**
 * Creates a 5-minute Checkout Inventory Hold for cart items.
 */
export async function createCheckoutReservation({
  userId,
  items,
  cartId = 'default_cart',
}: {
  userId: string;
  items: HoldItem[];
  cartId?: string;
}): Promise<{
  success: boolean;
  holdId?: string;
  expiresAt?: number;
  secondsRemaining?: number;
  failedItem?: string;
  message?: string;
}> {
  if (!items || items.length === 0) {
    return { success: false, message: 'Cart items empty' };
  }

  const holdId = `chk_${userId.slice(-8)}_${Date.now()}`;
  const now = Date.now();
  const expiresAt = now + DEFAULT_TTL_SECONDS * 1000;

  // 1. Fetch DB product stocks
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const dbProducts = await db
    .select()
    .from(schema.products)
    .where(inArray(schema.products.id, productIds));

  const dbProductMap = new Map<string, any>(dbProducts.map((p: any) => [p.id, p]));

  // 2. Validate availability for all items against DB Stock minus Active Holds
  for (const item of items) {
    const prod: any = dbProductMap.get(item.productId);
    if (!prod) {
      return { success: false, failedItem: item.productId, message: 'Product not found' };
    }
    const rawStock = (prod.stock_quantity as Record<string, number>)[item.size] || 0;
    const available = await getAvailableStock(item.productId, item.size, rawStock);

    if (available < item.quantity) {
      return {
        success: false,
        failedItem: prod.name,
        message: `Only ${available} available in size ${item.size}`,
      };
    }
  }

  // 3. Set Redis Hold Keys (5-minute TTL)
  try {
    for (const item of items) {
      const redisKey = `hold:${holdId}:${item.productId}:${item.size}`;
      await redis.set(redisKey, item.quantity, { ex: DEFAULT_TTL_SECONDS });
    }

    // Save Reservation Metadata
    const metadataKey = `hold_meta:${holdId}`;
    const meta: ReservationMetadata = {
      holdId,
      userId,
      items,
      createdAt: now,
      expiresAt,
      extended: false,
    };
    await redis.set(metadataKey, JSON.stringify(meta), { ex: DEFAULT_TTL_SECONDS });

    return {
      success: true,
      holdId,
      expiresAt,
      secondsRemaining: DEFAULT_TTL_SECONDS,
    };
  } catch (err: any) {
    console.error('[Reservation] Failed to create Redis checkout hold:', err);
    return { success: false, message: err.message || 'Failed to create reservation' };
  }
}

/**
 * Extends reservation by 3 minutes (up to max 8 minutes) when payment begins.
 */
export async function extendCheckoutReservation(holdId: string): Promise<{
  success: boolean;
  expiresAt?: number;
  secondsRemaining?: number;
}> {
  try {
    const metadataKey = `hold_meta:${holdId}`;
    const rawMeta = await redis.get<string | ReservationMetadata>(metadataKey);
    if (!rawMeta) return { success: false };

    const meta: ReservationMetadata = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    const now = Date.now();
    const maxExpiry = meta.createdAt + MAX_TTL_SECONDS * 1000;
    const newExpiry = Math.min(now + EXTENSION_TTL_SECONDS * 1000, maxExpiry);
    const newTtlSeconds = Math.max(1, Math.floor((newExpiry - now) / 1000));

    // Update keys
    for (const item of meta.items) {
      const redisKey = `hold:${holdId}:${item.productId}:${item.size}`;
      await redis.expire(redisKey, newTtlSeconds);
    }

    meta.expiresAt = newExpiry;
    meta.extended = true;
    await redis.set(metadataKey, JSON.stringify(meta), { ex: newTtlSeconds });

    return {
      success: true,
      expiresAt: newExpiry,
      secondsRemaining: newTtlSeconds,
    };
  } catch (err) {
    console.error('[Reservation] Extension failed:', err);
    return { success: false };
  }
}

/**
 * Releases Redis holds (on payment failure or manual release).
 */
export async function releaseCheckoutReservation(holdId: string): Promise<void> {
  try {
    const metadataKey = `hold_meta:${holdId}`;
    const rawMeta = await redis.get<string | ReservationMetadata>(metadataKey);
    if (!rawMeta) return;

    const meta: ReservationMetadata = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    for (const item of meta.items) {
      const redisKey = `hold:${holdId}:${item.productId}:${item.size}`;
      await redis.del(redisKey);
    }
    await redis.del(metadataKey);
  } catch (err) {
    console.error('[Reservation] Release failed:', err);
  }
}
