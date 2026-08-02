import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { redis } from '@/lib/redis';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, gte, count, countDistinct } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = getAuth(request as any);
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);
    const threeMinsAgoSec = nowSec - 180;
    const monthStr = now.toISOString().slice(0, 7); // 'YYYY-MM'
    const threeMinsAgoDate = new Date(now.getTime() - 3 * 60 * 1000);

    let liveVisitors = 0;
    let monthlyVisitors = 0;
    let overallVisitors = 0;

    // 1. Fetch live active visitors from Redis sorted set
    try {
      if (redis) {
        // Clean up entries older than 3 minutes
        await redis.zremrangebyscore('analytics:live_visitors', 0, threeMinsAgoSec);
        liveVisitors = await redis.zcard('analytics:live_visitors');
        monthlyVisitors = await redis.pfcount(`analytics:visitors:${monthStr}`);
        overallVisitors = await redis.pfcount('analytics:visitors:overall');
      }
    } catch (err) {
      // Ignore Redis errors, fallback to PostgreSQL
    }

    // 2. Query PostgreSQL database to ensure accuracy and as fail-safe fallback
    try {
      // Postgres Live Visitors (if Redis is empty)
      if (liveVisitors === 0) {
        const [dbLive] = await db
          .select({ value: countDistinct(schema.uniqueVisitors.visitor_id) })
          .from(schema.uniqueVisitors)
          .where(gte(schema.uniqueVisitors.last_seen_at, threeMinsAgoDate));
        liveVisitors = dbLive?.value || 0;
      }

      // Postgres Monthly Visitors
      const [dbMonthly] = await db
        .select({ value: count(schema.uniqueVisitors.visitor_id) })
        .from(schema.uniqueVisitors)
        .where(eq(schema.uniqueVisitors.created_month, monthStr));
      
      const dbMonthlyCount = dbMonthly?.value || 0;
      monthlyVisitors = Math.max(monthlyVisitors, dbMonthlyCount);

      // Postgres Overall Visitors
      const [dbOverall] = await db
        .select({ value: count(schema.uniqueVisitors.visitor_id) })
        .from(schema.uniqueVisitors);

      const dbOverallCount = dbOverall?.value || 0;
      overallVisitors = Math.max(overallVisitors, dbOverallCount);
    } catch (dbErr) {
      // Postgres error fallback
    }

    return NextResponse.json({
      success: true,
      liveVisitors,
      monthlyVisitors,
      overallVisitors,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
