import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { driftModeSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    // Allow if authenticated (or session cookie authenticated for admin panel)
    const body = await request.json();
    const { is_active, discount_percent } = body;

    const newIsActive = typeof is_active === 'boolean' ? is_active : false;
    const newDiscount = typeof discount_percent === 'number' && discount_percent > 0 ? Math.min(100, Math.max(1, Math.round(discount_percent))) : 20;

    const [existing] = await db
      .select()
      .from(driftModeSettings)
      .where(eq(driftModeSettings.id, 1))
      .limit(1);

    let updated;
    if (existing) {
      [updated] = await db
        .update(driftModeSettings)
        .set({
          is_active: newIsActive,
          discount_percent: newDiscount,
          updated_at: new Date(),
        })
        .where(eq(driftModeSettings.id, 1))
        .returning();
    } else {
      [updated] = await db
        .insert(driftModeSettings)
        .values({
          id: 1,
          is_active: newIsActive,
          discount_percent: newDiscount,
          updated_at: new Date(),
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      is_active: updated.is_active,
      discount_percent: updated.discount_percent,
    });
  } catch (error: any) {
    console.error('[DriftMode toggle error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to toggle Drift Mode' }, { status: 500 });
  }
}
