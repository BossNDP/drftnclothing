import { NextResponse } from 'next/server';
import { db } from '@/db';
import { driftModeSettings, driftModeCoupons } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { code, user_id } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, reason: 'missing_code' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Check if Drift Mode system is active
    const [settings] = await db
      .select()
      .from(driftModeSettings)
      .where(eq(driftModeSettings.id, 1))
      .limit(1);

    if (!settings || !settings.is_active) {
      return NextResponse.json({ valid: false, reason: 'inactive' });
    }

    // 2. Fetch coupon by code
    const [coupon] = await db
      .select()
      .from(driftModeCoupons)
      .where(eq(driftModeCoupons.code, cleanCode))
      .limit(1);

    if (!coupon) {
      return NextResponse.json({ valid: false, reason: 'invalid_code' });
    }

    if (coupon.used) {
      return NextResponse.json({ valid: false, reason: 'already_used' });
    }

    if (user_id && coupon.user_id !== user_id) {
      return NextResponse.json({ valid: false, reason: 'unauthorized' });
    }

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discount_percent: coupon.discount_percent,
    });
  } catch (error: any) {
    console.error('[DriftMode validate error]:', error);
    return NextResponse.json({ valid: false, reason: 'server_error' }, { status: 500 });
  }
}
