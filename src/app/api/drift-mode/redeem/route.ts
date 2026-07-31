import { NextResponse } from 'next/server';
import { db } from '@/db';
import { driftModeCoupons } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { code, order_id } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'code_required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    const [updated] = await db
      .update(driftModeCoupons)
      .set({
        used: true,
        used_at: new Date(),
        order_id: order_id || null,
      })
      .where(eq(driftModeCoupons.code, cleanCode))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'coupon_not_found' }, { status: 44 });
    }

    return NextResponse.json({
      success: true,
      code: updated.code,
      used: updated.used,
      used_at: updated.used_at,
    });
  } catch (error: any) {
    console.error('[DriftMode redeem error]:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
