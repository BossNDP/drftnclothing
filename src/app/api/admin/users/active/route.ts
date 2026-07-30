import { NextResponse } from 'next/server';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = getAuth(request as any);
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(session.userId);
    const role = (clerkUser.publicMetadata as any)?.role;
    const isIntern = role === 'intern';

    // Active user criteria: active within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Query active users
    const activeUsers = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        phone: schema.users.phone,
        lastActiveAt: schema.users.last_active_at,
      })
      .from(schema.users)
      .where(gte(schema.users.last_active_at, fiveMinutesAgo))
      .orderBy(schema.users.last_active_at);

    const totalActiveCount = activeUsers.length;

    // Mask PII for interns
    if (isIntern) {
      return NextResponse.json({
        success: true,
        count: totalActiveCount,
        users: [], // Hide users list for interns to protect PII
      });
    }

    return NextResponse.json({
      success: true,
      count: totalActiveCount,
      users: activeUsers,
    });
  } catch (error) {
    console.error('Admin Active Users API error:', error);
    return NextResponse.json({ success: true, count: 0, users: [] });
  }
}
