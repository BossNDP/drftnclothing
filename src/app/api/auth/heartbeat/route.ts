import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '@/lib/jwt';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('drftn_session')?.value;
    let userId: string | null = null;

    if (sessionToken) {
      const payload = await verifyToken(sessionToken);
      if (payload && payload.userId) {
        userId = payload.userId as string;
      }
    }

    if (!userId) {
      const clerkAuth = await auth();
      if (clerkAuth.userId) {
        userId = clerkAuth.userId;
      }
    }

    if (userId) {
      // Update last_active_at in database
      const updateData = { last_active_at: new Date() };
      if (Object.keys(updateData).length > 0) {
        await db
          .update(schema.users)
          .set(updateData)
          .where(eq(schema.users.id, userId));
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Not authenticated' });
  } catch (error) {
    console.error('Heartbeat Route Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
