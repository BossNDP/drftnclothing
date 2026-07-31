import { NextResponse } from 'next/server';
import { db } from '@/db';
import { driftModeSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let [settings] = await db
      .select()
      .from(driftModeSettings)
      .where(eq(driftModeSettings.id, 1))
      .limit(1);

    if (!settings) {
      const [seeded] = await db
        .insert(driftModeSettings)
        .values({
          id: 1,
          is_active: false,
          discount_percent: 20,
        })
        .onConflictDoNothing()
        .returning();

      settings = seeded || { id: 1, is_active: false, discount_percent: 20, updated_at: new Date() };
    }

    return NextResponse.json({
      is_active: settings.is_active,
      discount_percent: settings.discount_percent,
    });
  } catch (error) {
    console.error('[DriftMode GET status error]:', error);
    // Safe fallback if table doesn't exist yet or connection fails
    return NextResponse.json({
      is_active: false,
      discount_percent: 20,
    });
  }
}
