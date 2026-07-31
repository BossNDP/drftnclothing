import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { driftModeSettings, driftModeCoupons, discountCodes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

async function ensureTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drift_mode_settings (
        id SERIAL PRIMARY KEY,
        is_active BOOLEAN NOT NULL DEFAULT true,
        discount_percent INTEGER NOT NULL DEFAULT 20,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drift_mode_coupons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        discount_percent INTEGER NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        used_at TIMESTAMPTZ,
        order_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch {}
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DRIFT-${rand}`;
}

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {}

  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('drftn_session')?.value;
    if (sessionToken) {
      const payload = await verifyToken(sessionToken);
      if (payload && payload.userId) {
        return payload.userId as string;
      }
    }
  } catch {}

  return null;
}

export async function POST() {
  try {
    await ensureTables();
    // 1. Resolve user ID
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    // 2. Check if Drift Mode is active
    let [settings] = await db
      .select()
      .from(driftModeSettings)
      .where(eq(driftModeSettings.id, 1))
      .limit(1);

    if (!settings || !settings.is_active) {
      return NextResponse.json({ error: 'inactive' }, { status: 400 });
    }

    // 3. Check if coupon already exists for user
    const [existingCoupon] = await db
      .select()
      .from(driftModeCoupons)
      .where(eq(driftModeCoupons.user_id, userId))
      .limit(1);

    if (existingCoupon) {
      if (existingCoupon.used) {
        return NextResponse.json({ error: 'already_used' }, { status: 400 });
      }
      return NextResponse.json({
        code: existingCoupon.code,
        discount_percent: existingCoupon.discount_percent,
        used: false,
      });
    }

    // 4. Generate new DRIFT-XXXXXX code
    let newCode = generateRandomCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      attempts++;
      const [dup] = await db
        .select()
        .from(driftModeCoupons)
        .where(eq(driftModeCoupons.code, newCode))
        .limit(1);
      if (!dup) {
        isUnique = true;
      } else {
        newCode = generateRandomCode();
      }
    }

    const [inserted] = await db
      .insert(driftModeCoupons)
      .values({
        user_id: userId,
        code: newCode,
        discount_percent: settings.discount_percent,
        used: false,
      })
      .returning();

    // Also sync to main discountCodes table so it appears in Admin Discounts Section
    try {
      await db.insert(discountCodes).values({
        code: newCode,
        discount_type: 'percent',
        discount_value: settings.discount_percent,
        min_order_value: 0,
        usage_limit: 1,
        used_count: 0,
        is_active: true,
      }).onConflictDoNothing();
    } catch (e) {
      console.warn('[Sync to discountCodes warning]:', e);
    }

    return NextResponse.json({
      code: inserted.code,
      discount_percent: inserted.discount_percent,
      used: false,
    });
  } catch (error: any) {
    console.error('[DriftMode generate-code error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate code' }, { status: 500 });
  }
}
