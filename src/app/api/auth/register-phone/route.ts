import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken, signToken } from '@/lib/jwt';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { name, email, tempToken, notificationsOptIn: bodyNotifications } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    let verifiedPhone: string | null = null;
    let notificationsOptIn = bodyNotifications !== false;

    // 1. Try to verify temporary phone token if provided
    if (tempToken) {
      const payload = (await verifyToken(tempToken)) as any;
      if (payload && payload.isTemp && payload.phone) {
        verifiedPhone = payload.phone;
        if (bodyNotifications === undefined && payload.notificationsOptIn !== undefined) {
          notificationsOptIn = payload.notificationsOptIn !== false;
        }
      }
    }

    // 2. Check if user is ALREADY logged in via session cookie or Clerk
    let currentUserId: string | null = null;
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('drftn_session')?.value;
    if (sessionToken) {
      const payload = await verifyToken(sessionToken);
      if (payload && payload.userId) {
        currentUserId = payload.userId as string;
      }
    }
    if (!currentUserId) {
      const clerkAuth = await auth();
      if (clerkAuth.userId) {
        currentUserId = clerkAuth.userId;
      }
    }

    // If user is already logged in, update their existing profile
    if (currentUserId) {
      const [currentUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, currentUserId))
        .limit(1);

      if (currentUser) {
        const updateData: Record<string, any> = {
          name: name.trim(),
          notifications_opt_in: notificationsOptIn,
        };
        if (verifiedPhone && !currentUser.phone_verified) {
          updateData.phone = verifiedPhone;
          updateData.phone_verified = true;
        }
        if (email && email.trim() && !currentUser.email) {
          updateData.email = email.trim().toLowerCase();
        }

        const [updatedUser] = await db
          .update(schema.users)
          .set(updateData)
          .where(eq(schema.users.id, currentUserId))
          .returning();

        const formattedUser = {
          ...updatedUser,
          authProvider: updatedUser.auth_provider,
          notificationsOptIn: updatedUser.notifications_opt_in,
          phoneVerified: updatedUser.phone_verified,
          emailVerified: updatedUser.email_verified,
        };

        return NextResponse.json({
          success: true,
          user: formattedUser,
          triggerPush: notificationsOptIn,
        });
      }
    }

    // If not logged in and no verified phone token could be decoded:
    if (!verifiedPhone) {
      return NextResponse.json(
        { error: 'Verification session expired. Please verify your phone number again.' },
        { status: 400 }
      );
    }

    // 3. Clean email
    let cleanEmail: string | null = null;
    if (email && typeof email === 'string' && email.trim()) {
      const targetEmail = email.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        // Check if email already in use
        const [emailInUseUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, targetEmail))
          .limit(1);

        if (!emailInUseUser) {
          cleanEmail = targetEmail;
        } else if (!emailInUseUser.phone) {
          // If the email account has no phone linked yet, link this verified phone to that existing account
          const [linkedUser] = await db
            .update(schema.users)
            .set({
              phone: verifiedPhone,
              phone_verified: true,
              name: name.trim(),
              notifications_opt_in: notificationsOptIn,
            })
            .where(eq(schema.users.id, emailInUseUser.id))
            .returning();

          const token = await signToken({ userId: linkedUser.id });
          cookies().set('drftn_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
          });

          return NextResponse.json({
            success: true,
            user: {
              ...linkedUser,
              authProvider: linkedUser.auth_provider,
              notificationsOptIn: linkedUser.notifications_opt_in,
              phoneVerified: linkedUser.phone_verified,
              emailVerified: linkedUser.email_verified,
            },
            triggerPush: notificationsOptIn,
          });
        } else {
          // Email belongs to another account — omit email for this phone registration instead of blocking
          cleanEmail = null;
        }
      }
    }

    // 4. Check if phone is already registered
    const [existingPhoneUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, verifiedPhone))
      .limit(1);

    if (existingPhoneUser) {
      const token = await signToken({ userId: existingPhoneUser.id });
      cookies().set('drftn_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      return NextResponse.json({
        success: true,
        user: {
          ...existingPhoneUser,
          authProvider: existingPhoneUser.auth_provider,
          notificationsOptIn: existingPhoneUser.notifications_opt_in,
          phoneVerified: existingPhoneUser.phone_verified,
          emailVerified: existingPhoneUser.email_verified,
        },
        triggerPush: false,
      });
    }

    // 5. Create new user in database
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;
    const [newUser] = await db
      .insert(schema.users)
      .values({
        id: userId,
        phone: verifiedPhone,
        phone_verified: true,
        email: cleanEmail,
        email_verified: false,
        name: name.trim(),
        notifications_opt_in: notificationsOptIn,
        terms_accepted_at: new Date(),
        auth_provider: 'phone',
      })
      .returning();

    const formattedUser = {
      ...newUser,
      authProvider: newUser.auth_provider,
      notificationsOptIn: newUser.notifications_opt_in,
      phoneVerified: newUser.phone_verified,
      emailVerified: newUser.email_verified,
    };

    // 6. Sign custom session cookie
    const token = await signToken({ userId: newUser.id });
    cookies().set('drftn_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: formattedUser,
      triggerPush: notificationsOptIn,
    });
  } catch (error) {
    console.error('Register Phone User API Error:', error);
    return NextResponse.json({ error: 'An unexpected registration error occurred' }, { status: 500 });
  }
}
