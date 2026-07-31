import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '@/lib/jwt';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { name, phone } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }

    // 1. Get authenticated user ID
    let userId: string | null = null;
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('drftn_session')?.value;

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

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Security: Rate limiting to prevent spamming updates
    // Limit to 5 updates per 1 minute per user
    const rateLimitResult = await rateLimit(`profile-update:${userId}`, 5, 60000);
    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: `Too many profile updates. Please wait ${rateLimitResult.reset} seconds.`,
      }, { status: 429 });
    }

    // 3. Build update payload
    const updateData: Record<string, any> = { name: name.trim() };

    // Only allow phone update if user doesn't already have a verified phone (Gmail users adding phone)
    if (phone && typeof phone === 'string') {
      const cleanPhone = phone.replace(/\D/g, '');
      if (/^[6-9]\d{9}$/.test(cleanPhone)) {
        const fullPhone = `+91${cleanPhone}`;

        // Check if phone number is already linked to another account
        const [existingPhoneUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.phone, fullPhone))
          .limit(1);

        if (existingPhoneUser && existingPhoneUser.id !== userId) {
          return NextResponse.json(
            { error: 'This phone number is already linked to another account.' },
            { status: 400 }
          );
        }

        // Check current user — only allow if they don't already have a verified phone
        const [currentUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        
        if (currentUser && (!currentUser.phone || !currentUser.phone_verified)) {
          updateData.phone = fullPhone;
          updateData.phone_verified = true;
        }
      }
    }

    // 4. Update in database
    const [updatedUser] = await db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, userId))
      .returning();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const formattedUser = {
      ...updatedUser,
      authProvider: updatedUser.auth_provider,
      notificationsOptIn: updatedUser.notifications_opt_in,
      phoneVerified: updatedUser.phone_verified,
      emailVerified: updatedUser.email_verified,
    };

    return NextResponse.json({ success: true, user: formattedUser });
  } catch (error) {
    console.error('Update profile API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
