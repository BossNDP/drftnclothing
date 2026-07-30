import { NextResponse } from 'next/server';
import { processShippingJobs } from '@/lib/orchestration/shipping-worker';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify secret cron header if CRON_SECRET is set
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    const url = new URL(request.url);
    const secretParam = url.searchParams.get('secret');
    if (secretParam !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
    }
  }

  try {
    const result = await processShippingJobs();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err: any) {
    console.error('[Shipping Worker Cron Error]:', err);
    return NextResponse.json({ error: err?.message || 'Worker execution failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
