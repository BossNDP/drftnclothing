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
        discount_percent INTEGER NOT NULL DEFAULT 30,
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

      UPDATE drift_mode_settings SET discount_percent = 30 WHERE id = 1 AND (discount_percent IS NULL OR discount_percent = 20);
      DELETE FROM discount_codes WHERE code IN ('DRIFTMODEON20', 'DRFTNMODEON20', 'DRIFTMODE20');
    `);
  } catch {}
}

const STATIC_DRIFT_CODE = 'DRIFTMODEON30';

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

    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    let [settings] = await db
      .select()
      .from(driftModeSettings)
      .where(eq(driftModeSettings.id, 1))
      .limit(1);

    if (!settings || !settings.is_active) {
      return NextResponse.json({ error: 'inactive' }, { status: 400 });
    }

    // Check if coupon entry exists for user
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
        code: STATIC_DRIFT_CODE,
        discount_percent: settings.discount_percent,
        used: false,
      });
    }

    const [inserted] = await db
      .insert(driftModeCoupons)
      .values({
        user_id: userId,
        code: STATIC_DRIFT_CODE,
        discount_percent: settings.discount_percent,
        used: false,
      })
      .onConflictDoUpdate({
        target: driftModeCoupons.user_id,
        set: { code: STATIC_DRIFT_CODE, discount_percent: settings.discount_percent },
      })
      .returning();

    // Sync to main discountCodes table for visibility
    try {
      await db.insert(discountCodes).values({
        code: STATIC_DRIFT_CODE,
        discount_type: 'percent',
        discount_value: settings.discount_percent,
        min_order_value: 0,
        usage_limit: null,
        used_count: 0,
        is_active: true,
      }).onConflictDoNothing();
    } catch (e) {
      console.warn('[Sync to discountCodes warning]:', e);
    }

    return NextResponse.json({
      code: STATIC_DRIFT_CODE,
      discount_percent: inserted ? inserted.discount_percent : settings.discount_percent,
      used: false,
    });
  } catch (error: any) {
    console.error('[DriftMode generate-code error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate code' }, { status: 500 });
  }
}
