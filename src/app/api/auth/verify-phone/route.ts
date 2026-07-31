import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signToken, signTempToken } from '@/lib/jwt';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function formatPhoneToDatabase(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) return `+91${clean}`;
  if (clean.length === 12 && clean.startsWith('91')) return `+${clean}`;
  return `+${clean}`;
}

export async function POST(request: Request) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
    }

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimit(`auth:verify:ip:${ip}`, 10, 3600000);
    if (!rateLimitResult.success) {
      return NextResponse.json({
        error: `Too many verification attempts. Please retry in ${rateLimitResult.reset} seconds.`,
      }, { status: 429 });
    }

    const clientId = process.env.PHONE_EMAIL_CLIENT_ID ||
      process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID ||
      '17565400827940866842';

    let verifiedPhone: string | null = null;

    if (accessToken.startsWith('mock_token_')) {
      // Mock OTP bypass — only allowed when explicitly enabled for local dev.
      // ENABLE_MOCK_OTP must be 'true' AND we must not be in production.
      const isMockAllowed =
        process.env.ENABLE_MOCK_OTP === 'true' &&
        process.env.NODE_ENV !== 'production';

      if (isMockAllowed) {
        const mockPhone = accessToken.replace('mock_token_', '');
        verifiedPhone = formatPhoneToDatabase(mockPhone);
      } else {
        return NextResponse.json(
          { error: 'Invalid verification token' },
          { status: 400 }
        );
      }
    } else {
      // Verify with phone.email API
      const formData = new FormData();
      formData.append('client_id', clientId);
      formData.append('access_token', accessToken);

      const response = await fetch('https://eapi.phone.email/getuser', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      // Extract phone from top-level fields
      let phoneNo = data.phone_no || (data.userDetails && data.userDetails.phoneNo);
      let countryCode = data.country_code || (data.userDetails && data.userDetails.countryCode);

      // Fallback: decode ph_email_jwt payload if top-level fields are missing
      if (!phoneNo && data.ph_email_jwt) {
        try {
          const payloadBase64 = data.ph_email_jwt.split('.')[1];
          if (payloadBase64) {
            const jwtPayload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
            phoneNo = jwtPayload.phone_no || jwtPayload.phoneNo;
            countryCode = jwtPayload.country_code || jwtPayload.countryCode || countryCode;
          }
        } catch {
          // ignore decode errors
        }
      }

      if (!phoneNo) {
        console.error('phone.email getuser failed — no phone in response:', data, 'HTTP:', response.status);
        return NextResponse.json({
          error: 'Could not verify phone number with authentication provider',
          details: data,
        }, { status: 400 });
      }

      verifiedPhone = formatPhoneToDatabase(`${countryCode || ''}${phoneNo}`);
    }

    if (!verifiedPhone) {
      return NextResponse.json({ error: 'Phone verification failed' }, { status: 400 });
    }

    // Look up user by verified phone
    const [dbUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, verifiedPhone))
      .limit(1);

    if (dbUser) {
      // ── Returning user ── set session cookie and return immediately
      const token = await signToken({ userId: dbUser.id });
      cookies().set('drftn_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });

      const formattedUser = {
        ...dbUser,
        authProvider: dbUser.auth_provider,
        notificationsOptIn: dbUser.notifications_opt_in,
        phoneVerified: dbUser.phone_verified,
        emailVerified: dbUser.email_verified,
      };

      return NextResponse.json({ success: true, isNewUser: false, user: formattedUser });
    } else {
      // ── New user ── issue a short-lived temp token with the verified phone
      const tempToken = await signTempToken({ phone: verifiedPhone, isTemp: true });
      return NextResponse.json({ success: true, isNewUser: true, tempToken });
    }
  } catch (error) {
    console.error('Verify Phone API Error:', error);
    return NextResponse.json({ error: 'An unexpected verification error occurred' }, { status: 500 });
  }
}
