import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { verifyToken } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/orchestration/rate-limiter';
import { requestOrderCancellation } from '@/lib/orchestration/cancellation-service';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  let userId: string | null = null;

  try {
    const rawCookie = request.headers.get('cookie') || '';
    const sessionToken = rawCookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('drftn_session='))
      ?.split('=')?.[1];

    if (sessionToken) {
      const payload = await verifyToken(sessionToken);
      if (payload && payload.userId) {
        userId = payload.userId as string;
      }
    }

    if (!userId) {
      try {
        const authData = await auth();
        userId = authData.userId;
      } catch (e) {
        // Clerk missing session
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success, resetSec } = await checkRateLimit({
      endpoint: 'cancel',
      userId,
      sessionToken,
      ip,
    });

    if (!success) {
      return NextResponse.json({ error: 'Too many cancellation requests, please wait.' }, { status: 429 });
    }

    const body = await request.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    const result = await requestOrderCancellation({
      orderId,
      userId,
      reason,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Orders Cancel API Error]:', err);
    if (err?.message?.startsWith('CANCELLATION_WINDOW_EXPIRED')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || 'Failed to cancel order' }, { status: 500 });
  }
}
