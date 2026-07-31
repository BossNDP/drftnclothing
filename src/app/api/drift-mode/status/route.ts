import { NextResponse } from 'next/server';
import { db } from '@/db';
import { driftModeSettings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

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

      INSERT INTO drift_mode_settings (id, is_active, discount_percent)
      VALUES (1, true, 20)
      ON CONFLICT (id) DO NOTHING;
    `);
  } catch (err) {
    console.warn('[DriftMode ensureTables warning]:', err);
  }
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

    return NextResponse.json({
      is_active: settings ? settings.is_active : true,
      discount_percent: settings ? settings.discount_percent : 20,
    });
  } catch (error) {
    console.error('[DriftMode GET status error]:', error);
    return NextResponse.json({
      is_active: true,
      discount_percent: 20,
    });
  }
}
