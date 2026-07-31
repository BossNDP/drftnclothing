import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken, signToken } from '@/lib/jwt';
import { auth, clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

function formatUser(u: any) {
  if (!u) return null;
  return {
    ...u,
    authProvider: u.auth_provider || u.authProvider || 'phone',
    auth_provider: u.auth_provider || u.authProvider || 'phone',
    notificationsOptIn: u.notifications_opt_in ?? u.notificationsOptIn ?? true,
    phoneVerified: u.phone_verified ?? u.phoneVerified ?? false,
    emailVerified: u.email_verified ?? u.emailVerified ?? false,
  };
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('drftn_session')?.value;

    if (sessionToken) {
      const payload = await verifyToken(sessionToken);
      if (payload && payload.userId) {
        // Query user from database
        const [dbUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, payload.userId as string))
          .limit(1);

        if (dbUser) {
          return NextResponse.json({ user: formatUser(dbUser) });
        }
      }
    }

    // Fallback: Check if Clerk is authenticated
    const clerkAuth = await auth();
    if (clerkAuth.userId) {
      // Fetch user from database
      const [dbUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, clerkAuth.userId))
        .limit(1);

      if (dbUser) {
        // Sync custom cookie session for Clerk session
        const token = await signToken({ userId: dbUser.id });
        cookies().set('drftn_session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
        });

        return NextResponse.json({ user: formatUser(dbUser) });
      }

      // If user does not exist in DB yet, pull info from Clerk and create in DB
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(clerkAuth.userId);
        const email = clerkUser.emailAddresses.find(
          (e: any) => e.id === clerkUser.primaryEmailAddressId
        )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || null;
        const name = clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Google User';

        // Check if user already exists by email
        let dbUserByEmail = null;
        if (email) {
          const [found] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);
          dbUserByEmail = found;
        }

        let syncedUser;
        if (dbUserByEmail) {
          // Update user ID or link user
          const [updated] = await db
            .update(schema.users)
            .set({
              id: clerkAuth.userId,
              auth_provider: 'google',
              email_verified: true,
              name: dbUserByEmail.name || name,
            })
            .where(eq(schema.users.id, dbUserByEmail.id))
            .returning();
          syncedUser = updated;
        } else {
          // Create new user in our DB
          const [created] = await db
            .insert(schema.users)
            .values({
              id: clerkAuth.userId,
              email: email,
              email_verified: !!email,
              name: name,
              auth_provider: 'google',
              notifications_opt_in: true,
              terms_accepted_at: new Date(),
            })
            .returning();
          syncedUser = created;
        }

        // Sign custom cookie session
        const token = await signToken({ userId: syncedUser.id });
        cookies().set('drftn_session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60,
          path: '/',
        });

        return NextResponse.json({ user: formatUser(syncedUser) });
      } catch (clerkErr) {
        console.error('Clerk user sync failed:', clerkErr);
      }
    }

    return NextResponse.json({ user: null });
  } catch (error) {
    console.error('Unified Auth Me Route Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
