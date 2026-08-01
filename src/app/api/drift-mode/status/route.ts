import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { driftModeSettings, driftModeCoupons } from '@/db/schema';
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
        popup_shown_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE drift_mode_coupons ADD COLUMN IF NOT EXISTS popup_shown_count INTEGER NOT NULL DEFAULT 0;

      INSERT INTO drift_mode_settings (id, is_active, discount_percent)
      VALUES (1, true, 20)
      ON CONFLICT (id) DO NOTHING;
    `);
  } catch (err) {
    console.warn('[DriftMode ensureTables warning]:', err);
  }
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

export async function GET() {
  try {
    await ensureTables();

    let settings: any = null;
    try {
      const [row] = await db
        .select()
        .from(driftModeSettings)
        .where(eq(driftModeSettings.id, 1))
        .limit(1);
      settings = row;
    } catch {}

    const userId = await getUserId();
    let popupShownCount = 0;
    let codeGenerated = false;
    let codeUsed = false;

    if (userId) {
      try {
        const [userCoupon] = await db
          .select()
          .from(driftModeCoupons)
          .where(eq(driftModeCoupons.user_id, userId))
          .limit(1);

        if (userCoupon) {
          popupShownCount = userCoupon.popup_shown_count || 0;
          codeGenerated = true;
          codeUsed = !!userCoupon.used;
        }
      } catch (e) {
        console.warn('[DriftMode GET status user check error]:', e);
      }
    }

    return NextResponse.json({
      is_active: settings ? settings.is_active : true,
      discount_percent: settings ? settings.discount_percent : 20,
      popup_shown_count: popupShownCount,
      code_generated: codeGenerated,
      code_used: codeUsed,
    });
  } catch (error) {
    console.error('[DriftMode GET status error]:', error);
    return NextResponse.json({
      is_active: true,
      discount_percent: 20,
      popup_shown_count: 0,
      code_generated: false,
      code_used: false,
    });
  }
}
