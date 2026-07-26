import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { like } from 'drizzle-orm';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * One-time admin role bootstrapper.
 *
 * SECURITY HARDENING:
 * 1. Rate limited to 3 attempts per 5 minutes per IP — prevents brute-force.
 * 2. Requires a ROLE_SETUP_TOKEN header that matches the env var of the same
 *    name. Set ROLE_SETUP_TOKEN to a long random string in Vercel env vars.
 *    Without this token the endpoint returns 403 immediately.
 * 3. Still excluded from admin middleware to avoid chicken-and-egg lockout,
 *    but the token requirement makes unauthenticated access useless.
 *
 * HOW TO USE:
 *   curl -H "x-setup-token: <your_ROLE_SETUP_TOKEN>" \
 *        https://drftn.in/api/admin/set-role-clerk
 *
 * After first successful run, rotate or delete ROLE_SETUP_TOKEN from Vercel
 * env vars so this endpoint can never be invoked again.
 */
export async function GET(request: Request) {
  // ── 1. Rate limit (3 per 5 min per IP) ───────────────────────────────────
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rl = await rateLimit(`set-role-clerk:${ip}`, 3, 5 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rl.reset} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rl.reset) } }
    );
  }

  // ── 2. Setup token gate ───────────────────────────────────────────────────
  const setupToken = process.env.ROLE_SETUP_TOKEN;
  if (!setupToken) {
    // No token configured → endpoint is permanently disabled
    return NextResponse.json(
      { error: 'This endpoint is disabled. Set ROLE_SETUP_TOKEN to enable it.' },
      { status: 403 }
    );
  }

  const providedToken = request.headers.get('x-setup-token') || '';
  // Constant-time comparison to prevent timing attacks
  const crypto = await import('crypto');
  const setupBuf = Buffer.from(setupToken, 'utf-8');
  const providedBuf = Buffer.from(providedToken, 'utf-8');

  const tokenMatch =
    setupBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(setupBuf, providedBuf);

  if (!tokenMatch) {
    console.warn(`[set-role-clerk] ❌ Invalid setup token from IP: ${ip}`);
    return NextResponse.json({ error: 'Forbidden: invalid setup token' }, { status: 403 });
  }

  // ── 3. Promote hardcoded admin emails ─────────────────────────────────────
  try {
    const client = await clerkClient();
    const emailsToPromote = ['nagarjundp256@gmail.com', 'drftnclothing@gmail.com', 'chethansc47@gmail.com', 'nnvg2608@gmail.com'];
    const results: any[] = [];

    for (const email of emailsToPromote) {
      console.log(`[Clerk Promo] Searching for user with email: ${email}`);

      const response = await client.users.getUserList({
        emailAddress: [email],
        limit: 1,
      });

      const users = response.data || response;
      const user = Array.isArray(users) ? users[0] : null;

      if (!user) {
        results.push({ email, status: 'Not Found', message: 'No user registered under this email in Clerk.' });
        continue;
      }

      console.log(`[Clerk Promo] Found user ${user.id} for email ${email}. Promoting to admin...`);

      await client.users.updateUserMetadata(user.id, {
        publicMetadata: { role: 'admin' },
      });

      results.push({
        email,
        status: 'Success',
        clerkUserId: user.id,
        message: 'Public metadata updated successfully: { role: "admin" }',
      });
    }

    // Clean up stale vercel.app staging push subscriptions
    let deletedStagingSubs = 0;
    try {
      const deleted = await db
        .delete(pushSubscriptions)
        .where(like(pushSubscriptions.endpoint, '%vercel.app%'))
        .returning();
      deletedStagingSubs = deleted.length;
      console.log(`[DB Cleanup] Purged ${deletedStagingSubs} staging vercel.app subscriptions`);
    } catch (cleanupErr) {
      console.error('[DB Cleanup Error] Failed to delete staging subscriptions:', cleanupErr);
    }

    return NextResponse.json({
      success: true,
      results,
      purgedStagingSubscriptionsCount: deletedStagingSubs,
      reminder: 'Done! Remove or rotate ROLE_SETUP_TOKEN in Vercel env vars now.',
    });
  } catch (error: any) {
    console.error('[Clerk Promo Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
