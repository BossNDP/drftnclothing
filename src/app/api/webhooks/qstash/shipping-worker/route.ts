import { NextResponse } from 'next/server';
import { verifyQStashSignature } from '@/lib/orchestration/qstash-client';
import { processSingleJobById } from '@/lib/orchestration/shipping-worker';
import { writeAuditLog } from '@/lib/orchestration/audit-service';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// 4 MB is generous — QStash payloads are tiny; this guards against oversized requests
const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Upstash QStash Webhook Route – Event-Driven Shipping Worker Trigger
 *
 * SECURITY:
 * - Upstash signature verification enforced (constant-time comparison via SDK)
 * - Only POST requests accepted
 * - Body size bounded
 * - Returns 200 on duplicate deliveries (prevents QStash retrying endlessly)
 *
 * IDEMPOTENCY:
 * - processSingleJobById re-checks job status via DB
 * - Worker Guard 4 detects existing shipment and returns 200 without re-dispatching
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Read and bound raw body
    const rawBody = await request.text();

    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    // 2. Enforce Upstash Signature Verification (constant-time — handled by SDK)
    const isValidSignature = await verifyQStashSignature(request, rawBody);
    if (!isValidSignature) {
      console.warn('[QStash Webhook] Unauthorized — invalid or missing upstash-signature.');
      return NextResponse.json({ error: 'Unauthorized QStash signature' }, { status: 401 });
    }

    // 3. Parse and validate payload (reject malformed JSON)
    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { shippingJobId, orderId, correlationId, timestamp } = payload;

    if (!shippingJobId || typeof shippingJobId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid shippingJobId' }, { status: 400 });
    }

    const effectiveCorrelationId = correlationId || request.headers.get('x-correlation-id') || undefined;

    // 4. Fast-path: check if job is already completed — return 200 immediately for duplicate deliveries
    const [existingJob] = await db
      .select({ status: schema.shippingJobs.status, order_id: schema.shippingJobs.order_id })
      .from(schema.shippingJobs)
      .where(eq(schema.shippingJobs.id, shippingJobId))
      .limit(1);

    if (existingJob?.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        message: 'Job already completed — duplicate delivery handled safely (idempotent)',
        shippingJobId,
      });
    }

    // 5. Audit: record webhook receipt
    await writeAuditLog({
      orderId: orderId || existingJob?.order_id || null,
      correlationId: effectiveCorrelationId,
      action: 'QSTASH_WEBHOOK_RECEIVED',
      details: {
        shippingJobId,
        payloadTimestamp: timestamp,
        currentJobStatus: existingJob?.status || 'NOT_FOUND',
      },
    });

    // 6. Process job via shared worker (with all 4 validation guards)
    const result = await processSingleJobById({
      jobId: shippingJobId,
      workerId: 'qstash-webhook-worker',
      correlationId: effectiveCorrelationId,
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      shippingJobId,
      durationMs,
      result,
    });

  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error('[QStash Webhook Exception]:', err);
    // Return 500 to let QStash retry — but worker idempotency means retries are safe
    return NextResponse.json(
      { error: err?.message || 'QStash webhook processing error', durationMs },
      { status: 500 }
    );
  }
}

// Reject all non-POST methods explicitly
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
