import { Client, Receiver } from '@upstash/qstash';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';
import { writeAuditLog } from './audit-service';

export interface QStashShippingJobPayload {
  shippingJobId: string;
  orderId: string;
  correlationId: string;
  timestamp: number;
  signatureVersion: string;
}

const RETRY_BACKOFF_MS = [1000, 2000, 4000]; // 3 attempts: 1s, 2s, 4s

let qstashClient: Client | null = null;
let qstashReceiver: Receiver | null = null;

function getQStashClient(): Client | null {
  if (qstashClient) return qstashClient;
  const token = process.env.QSTASH_TOKEN;
  if (!token || token.includes('placeholder') || token.includes('mock')) return null;
  try {
    qstashClient = new Client({ token });
    return qstashClient;
  } catch (err) {
    console.error('[QStashClient] Failed to initialize QStash client:', err);
    return null;
  }
}

function getQStashReceiver(): Receiver | null {
  if (qstashReceiver) return qstashReceiver;
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY || process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey || currentSigningKey.includes('placeholder')) return null;
  try {
    qstashReceiver = new Receiver({
      currentSigningKey,
      nextSigningKey: nextSigningKey || currentSigningKey,
    });
    return qstashReceiver;
  } catch (err) {
    console.error('[QStashClient] Failed to initialize QStash receiver:', err);
    return null;
  }
}

/**
 * publishQStashShippingJobIdempotent
 *
 * IDEMPOTENCY: Uses an atomic DB test-and-set to ensure only ONE QStash message
 * is ever published per shipping job — even when called concurrently by the browser
 * callback and the Razorpay webhook simultaneously.
 *
 * Flow:
 *   1. Attempt atomic UPDATE shipping_jobs SET qstash_message_id = NULL check
 *   2. If job already has a qstash_message_id → skip (idempotent return)
 *   3. If job has no qstash_message_id → publish with 3-attempt retry + exponential backoff
 *   4. On success → store messageId in DB for observability and orphan detection
 *   5. On permanent failure → log prominently; job stays PENDING for admin requeue
 *
 * POST-COMMIT ONLY: Must be called after the Neon transaction has committed.
 */
export async function publishQStashShippingJobIdempotent(params: {
  shippingJobId: string;
  orderId: string;
  correlationId: string;
  delaySeconds?: number;
}): Promise<{ success: boolean; messageId?: string; mode: 'qstash' | 'fallback' | 'already_published' }> {
  const { shippingJobId, orderId, correlationId, delaySeconds = 300 } = params;

  // ── Idempotency: Atomic test-and-set using a sentinel value ──
  // We lock the job for publishing by checking qstash_message_id IS NULL.
  // If another concurrent call published first, the UPDATE will match 0 rows → we skip.
  const lockResult = await db.execute(
    sql`UPDATE shipping_jobs
        SET qstash_message_id = 'PUBLISHING', updated_at = NOW()
        WHERE id = ${shippingJobId}
          AND qstash_message_id IS NULL
          AND status = 'PENDING'
        RETURNING id`
  );

  const lockRows = (lockResult as any).rows ?? lockResult ?? [];
  if (!Array.isArray(lockRows) || lockRows.length === 0) {
    // Either already published or job is no longer PENDING — skip
    const [existingJob] = await db
      .select({ qstash_message_id: schema.shippingJobs.qstash_message_id })
      .from(schema.shippingJobs)
      .where(eq(schema.shippingJobs.id, shippingJobId))
      .limit(1);

    if (existingJob?.qstash_message_id && existingJob.qstash_message_id !== 'PUBLISHING') {
      return { success: true, messageId: existingJob.qstash_message_id, mode: 'already_published' };
    }
    return { success: true, mode: 'already_published' };
  }

  // ── Publish with retry + exponential backoff ──
  const client = getQStashClient();

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://drftn.in');
  const destinationUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/qstash/shipping-worker`;

  const payload: QStashShippingJobPayload = {
    shippingJobId,
    orderId,
    correlationId,
    timestamp: Date.now(),
    signatureVersion: 'v1',
  };

  if (!client) {
    // Development / staging: no QStash credentials — reset sentinel and return fallback
    await db
      .update(schema.shippingJobs)
      .set({ qstash_message_id: null, updated_at: new Date() })
      .where(eq(schema.shippingJobs.id, shippingJobId));

    console.log(
      `[QStashClient] Dev mode: QSTASH_TOKEN absent. Job ${shippingJobId} stays PENDING for cron/admin pickup.`
    );
    return { success: true, mode: 'fallback' };
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length + 1; attempt++) {
    try {
      const res = await client.publishJSON({
        url: destinationUrl,
        delay: delaySeconds,
        body: payload,
        retries: 3,
        headers: { 'x-correlation-id': correlationId },
      });

      // ── Success: persist messageId + timestamp for observability ──
      await db
        .update(schema.shippingJobs)
        .set({
          qstash_message_id: res.messageId,
          qstash_published_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(schema.shippingJobs.id, shippingJobId));

      await writeAuditLog({
        orderId,
        correlationId,
        action: 'QSTASH_PUBLISHED_DELAYED_SHIPPING_JOB',
        details: {
          messageId: res.messageId,
          shippingJobId,
          delaySeconds,
          destinationUrl,
          attempt: attempt + 1,
        },
      });

      console.log(
        `[QStashClient] Published job ${shippingJobId} (msgId: ${res.messageId}, delay: ${delaySeconds}s, attempt: ${attempt + 1})`
      );

      return { success: true, messageId: res.messageId, mode: 'qstash' };
    } catch (err: any) {
      lastError = err;
      if (attempt < RETRY_BACKOFF_MS.length) {
        const backoff = RETRY_BACKOFF_MS[attempt];
        console.warn(
          `[QStashClient] Publish attempt ${attempt + 1} failed for job ${shippingJobId}. Retrying in ${backoff}ms...`,
          err?.message
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  // ── All retries exhausted: reset sentinel so admin requeue can pick it up ──
  await db
    .update(schema.shippingJobs)
    .set({ qstash_message_id: null, updated_at: new Date() })
    .where(eq(schema.shippingJobs.id, shippingJobId));

  await writeAuditLog({
    orderId,
    correlationId,
    action: 'QSTASH_PUBLISH_PERMANENTLY_FAILED_REQUIRES_ADMIN_REQUEUE',
    details: {
      shippingJobId,
      error: lastError?.message || String(lastError),
      destinationUrl,
    },
  });

  console.error(
    `[QStashClient] ⚠️ CRITICAL: All QStash publish attempts failed for shipping job ${shippingJobId}. ` +
      `Order ${orderId} will NOT ship automatically. ` +
      `Use POST /api/admin/shipping/requeue to recover.`
  );

  return { success: false, mode: 'fallback' };
}

/**
 * @deprecated Use publishQStashShippingJobIdempotent instead.
 * Kept for backward compat — proxies to the idempotent version.
 */
export async function publishQStashShippingJob(params: {
  shippingJobId: string;
  orderId: string;
  correlationId: string;
  delaySeconds?: number;
}) {
  return publishQStashShippingJobIdempotent(params);
}

/**
 * verifyQStashSignature
 * Verifies the Upstash QStash webhook signature using the official SDK Receiver.
 * Uses constant-time comparison (handled internally by the SDK).
 */
export async function verifyQStashSignature(
  request: Request,
  rawBody: string
): Promise<boolean> {
  const receiver = getQStashReceiver();
  const signature = request.headers.get('upstash-signature');

  if (!receiver) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[QStashClient] SECURITY ERROR: QSTASH_CURRENT_SIGNING_KEY missing in production!'
      );
      return false;
    }
    console.warn(
      '[QStashClient] QSTASH_CURRENT_SIGNING_KEY absent — bypassing verification in dev mode.'
    );
    return true;
  }

  if (!signature) {
    console.warn('[QStashClient] Missing upstash-signature header on incoming webhook request.');
    return false;
  }

  try {
    return await receiver.verify({ signature, body: rawBody, url: request.url });
  } catch (err: any) {
    console.error('[QStashClient] QStash signature verification exception:', err?.message);
    return false;
  }
}

/**
 * findOrphanedShippingJobs
 * Returns shipping jobs that are PENDING but have no QStash message published.
 * Used by the admin requeue endpoint to recover from QStash outage.
 */
export async function findOrphanedShippingJobs() {
  return db
    .select()
    .from(schema.shippingJobs)
    .where(
      sql`${schema.shippingJobs.status} = 'PENDING'
          AND (${schema.shippingJobs.qstash_message_id} IS NULL
               OR ${schema.shippingJobs.qstash_message_id} = 'PUBLISHING')`
    );
}
