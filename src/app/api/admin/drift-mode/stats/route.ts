import { NextResponse } from 'next/server';
import { db } from '@/db';
import { driftModeSettings, driftModeCoupons } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [settings] = await db
      .select()
      .from(driftModeSettings)
      .where(eq(driftModeSettings.id, 1))
      .limit(1);

    const [statsRow] = await db
      .select({
        totalCodes: sql<number>`count(*)::int`,
        redeemedCodes: sql<number>`count(case when ${driftModeCoupons.used} = true then 1 end)::int`,
      })
      .from(driftModeCoupons);

    const totalCodes = statsRow?.totalCodes || 0;
    const redeemedCodes = statsRow?.redeemedCodes || 0;
    const conversionRate = totalCodes > 0 ? Math.round((redeemedCodes / totalCodes) * 100) : 0;

    return NextResponse.json({
      is_active: settings?.is_active || false,
      discount_percent: settings?.discount_percent || 30,
      stats: {
        totalCodes,
        redeemedCodes,
        conversionRate,
      },
    });
  } catch (error: any) {
    console.error('[DriftMode stats GET error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch stats' }, { status: 500 });
  }
}
