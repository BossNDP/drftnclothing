import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { db } from '@/db';
import * as schema from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const vid = typeof body.vid === 'string' ? body.vid.trim() : null;

    if (!vid || vid.length < 8 || vid.length > 128) {
      return NextResponse.json({ error: 'Invalid visitor ID' }, { status: 400 });
    }

    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);
    const monthStr = now.toISOString().slice(0, 7); // 'YYYY-MM'

    // 1. Update Redis cache for instant sub-millisecond metrics
    try {
      if (redis) {
        // Add or update timestamp score in live visitors sorted set
        await redis.zadd('analytics:live_visitors', { score: nowSec, member: vid });
        // Add to monthly & overall HyperLogLog counters for unique deduplicated visitor counts
        await redis.pfadd(`analytics:visitors:${monthStr}`, vid);
        await redis.pfadd('analytics:visitors:overall', vid);
      }
    } catch (redisErr) {
      // Redis error handled quietly — fallback to Postgres
    }

    // 2. Persist to PostgreSQL database for long-term audit trail and fail-safe count
    try {
      await db
        .insert(schema.uniqueVisitors)
        .values({
          visitor_id: vid,
          first_seen_at: now,
          last_seen_at: now,
          created_month: monthStr,
        })
        .onConflictDoUpdate({
          target: schema.uniqueVisitors.visitor_id,
          set: { last_seen_at: now },
        });
    } catch (dbErr) {
      // Ignore if DB upsert encounters transient schema lock
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
