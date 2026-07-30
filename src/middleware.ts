import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

// SQL injection and malicious request pattern filters
function isMalicious(urlStr: string): boolean {
  const decoded = decodeURIComponent(urlStr).toLowerCase();
  const patterns = [
    /union\s+select/i,
    /select\s+.*\s+from/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /drop\s+table/i,
    /update\s+.*\s+set/i,
    /--/,
    /\/\*/,
    /pg_sleep\(/i,
    /<script/i,
    /javascript:/i
  ];
  return patterns.some(pattern => pattern.test(decoded));
}

// Log API Requests to console
function logApiRequest(ip: string, method: string, path: string) {
  console.log(`[API Request] Method: ${method}, Path: ${path}, IP: ${ip}, Time: ${new Date().toISOString()}`);
}

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const secretPath = process.env.ADMIN_SECRET_PATH || '/hq-drftn-secure-portal-2026-9f8z';

  // Pass Clerk's OAuth callback through immediately — any middleware check here
  // would break the token-exchange step and cause a 404.
  if (pathname.startsWith('/sso-callback')) {
    return NextResponse.next();
  }

  const adminSecretVal = process.env.ADMIN_JWT_SECRET || (
    process.env.NODE_ENV === 'production' 
      ? 'PROD_SECRET_REQUIRED_' + (globalThis as any).__PROD_SECRET_KEY__
      : 'drftn_secure_secret_fallback'
  );

  // 1. Secret Path Gateway - authorize and redirect to admin
  if (pathname === secretPath) {
    const adminUrl = new URL('/admin', request.url);
    const response = NextResponse.redirect(adminUrl);
    response.cookies.set('admin_access_allowed', adminSecretVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 60 * 60, // 12 hours
      path: '/'
    });
    return response;
  }

  // 2. Hide /admin and /api/admin from unauthorized visitors
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const cookieVal = request.cookies.get('admin_access_allowed')?.value;
    if (cookieVal !== adminSecretVal) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }

  const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
  const method = request.method;

  // 1. Block obviously malicious requests (SQL injection, script injections)
  if (isMalicious(request.url)) {
    console.warn(`[Blocked Malicious Request] IP: ${ip}, Path: ${pathname}`);
    return new NextResponse(
      JSON.stringify({ error: 'Bad Request: Malicious activity detected' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Log API Requests
  if (pathname.startsWith('/api')) {
    logApiRequest(ip, method, pathname);
  }

  // 3. Rate Limiting for API routes (exclude /api/orders/create as it uses its own Upstash Redis rate limiter)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/orders/create')) {
    let limit = 60; // default 60 requests per minute
    let windowMs = 60000; // 1 minute
    
    if (pathname.startsWith('/api/orders/track')) {
      limit = 10;
      windowMs = 600000; // 10 minutes
    } else if (pathname.startsWith('/api/shipping/serviceability')) {
      limit = 5;
      windowMs = 60000;
    } else if (pathname.startsWith('/api/discount/validate')) {
      limit = 5;
    } else if (pathname.startsWith('/api/orders/verify-payment')) {
      limit = 10;
    } else if (pathname.startsWith('/api/admin/push/announce-')) {
      limit = 5;
      windowMs = 300000; // 5 minutes
    } else if (pathname === '/api/push/subscribe' || pathname === '/api/push/unsubscribe') {
      limit = 10;
      windowMs = 60000; // 1 minute
    }

    const rateLimitResult = await rateLimit(`ratelimit:${ip}:${pathname}`, limit, windowMs);
    if (!rateLimitResult.success) {
      console.warn(`[Rate Limit Exceeded] IP: ${ip}, Path: ${pathname}`);
      return new NextResponse(
        JSON.stringify({ error: `Too many requests. Please retry in ${rateLimitResult.reset} seconds.` }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.reset)
          }
        }
      );
    }
  }

  // 4. Protection for Admin Routes (pages & APIs) via Clerk
  if (isAdminRoute(request)) {
    // Exclude the login page itself to allow loading of the form
    if (pathname === '/admin/login') {
      return NextResponse.next();
    }
    // Exclude the clerk role promoter endpoint from admin protection to avoid chicken-and-egg lockouts
    if (pathname === '/api/admin/set-role-clerk') {
      return NextResponse.next();
    }

    const session = await auth();
    if (!session.userId) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized: Session missing' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Fetch Clerk user details to verify email allowlist and public metadata role
    let userRole = (session.sessionClaims?.metadata as any)?.role || (session.sessionClaims?.publicMetadata as any)?.role;
    let userEmail: string | undefined = undefined;

    try {
      const client = await clerkClient();
      const user = await client.users.getUser(session.userId);
      userRole = userRole || (user.publicMetadata as any)?.role;
      userEmail = user.emailAddresses.find(
        (e: any) => e.id === user.primaryEmailAddressId
      )?.emailAddress || user.emailAddresses[0]?.emailAddress;
    } catch (err) {
      console.error('Clerk middleware user fetch failed:', err);
    }

    const fallbackAllowlist = [
      'admin@drftn.in',
      'nagarjundp256@gmail.com',
      'drftnclothing@gmail.com',
      'chethansc47@gmail.com',
      'nnvg2608@gmail.com'
    ];

    const envAllowlist = (process.env.ADMIN_ALLOWLIST_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    const allowlist = Array.from(new Set([...fallbackAllowlist, ...envAllowlist]));

    const isEmailAllowed = userEmail && allowlist.includes(userEmail.toLowerCase());
    const isAdmin = userRole === 'admin';

    // Authorized if email is in allowlist OR user has explicit admin role metadata in Clerk
    const isAuthorized = isEmailAllowed || isAdmin;

    if (!isAuthorized) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized: Admins only' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const unauthorizedUrl = new URL(
        `/admin/login?error=unauthorized&email=${encodeURIComponent(userEmail || 'none')}&role=${encodeURIComponent(userRole || 'none')}&userId=${encodeURIComponent(session.userId || 'none')}`, 
        request.url
      );
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
