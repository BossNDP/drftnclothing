import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { driftModeCoupons } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

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
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    // Ensure user record exists or update view count
    const [existing] = await db
      .select()
      .from(driftModeCoupons)
      .where(eq(driftModeCoupons.user_id, userId))
      .limit(1);

    if (existing) {
      const updatedCount = (existing.popup_shown_count || 0) + 1;
      await db
        .update(driftModeCoupons)
        .set({ popup_shown_count: updatedCount })
        .where(eq(driftModeCoupons.user_id, userId));

      return NextResponse.json({ success: true, popup_shown_count: updatedCount });
    } else {
      // Upsert coupon entry with popup_shown_count = 1
      await db.execute(sql`
        INSERT INTO drift_mode_coupons (user_id, code, discount_percent, popup_shown_count)
        VALUES (${userId}, ${'DRIFTMODEON30'}, 30, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET popup_shown_count = drift_mode_coupons.popup_shown_count + 1;
      `);

      return NextResponse.json({ success: true, popup_shown_count: 1 });
    }
  } catch (error: any) {
    console.error('[DriftMode track-view error]:', error);
    return NextResponse.json({ error: error?.message || 'Failed to track view' }, { status: 500 });
  }
}
