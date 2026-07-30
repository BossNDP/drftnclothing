import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  findOrphanedShippingJobs,
  publishQStashShippingJobIdempotent,
} from '@/lib/orchestration/qstash-client';
import { writeAuditLog } from '@/lib/orchestration/audit-service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/shipping/requeue
 *
 * Manual recovery endpoint for rare QStash publish failures.
 *
 * Finds all shipping_jobs in status PENDING with qstash_message_id IS NULL
 * (i.e., jobs that have a committed order/payment but no QStash message —
 * caused by a QStash outage at the time of checkout commit).
 *
 * For each orphaned job:
 * - Publishes a new QStash delayed message (delay: 0 for immediate dispatch)
 * - Stores resulting messageId on the job row
 * - Writes an audit log entry
 *
 * SECURITY: Clerk Auth guard.
 * IDEMPOTENCY: Safe to call multiple times — publishQStashShippingJobIdempotent
 * uses atomic test-and-set and ignores already-published jobs.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (process.env.NODE_ENV === 'production' && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orphanedJobs = await findOrphanedShippingJobs();

    if (orphanedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned shipping jobs found — all jobs have QStash messages.',
        requeued: 0,
      });
    }

    const results: Array<{
      jobId: string;
      orderId: string;
      status: 'requeued' | 'failed';
      messageId?: string;
      error?: string;
    }> = [];

    for (const job of orphanedJobs) {
      const correlationId = crypto.randomUUID();

      try {
        const result = await publishQStashShippingJobIdempotent({
          shippingJobId: job.id,
          orderId: job.order_id,
          correlationId,
          delaySeconds: 0, // Immediate dispatch for admin requeue
        });

        results.push({
          jobId: job.id,
          orderId: job.order_id,
          status: 'requeued',
          messageId: result.messageId,
        });

        await writeAuditLog({
          orderId: job.order_id,
          correlationId,
          action: 'ADMIN_REQUEUE_SHIPPING_JOB_SUCCESS',
          details: { jobId: job.id, messageId: result.messageId, mode: result.mode },
        });
      } catch (err: any) {
        results.push({
          jobId: job.id,
          orderId: job.order_id,
          status: 'failed',
          error: err?.message || String(err),
        });

        await writeAuditLog({
          orderId: job.order_id,
          correlationId,
          action: 'ADMIN_REQUEUE_SHIPPING_JOB_FAILED',
          details: { jobId: job.id, error: err?.message || String(err) },
        });
      }
    }

    const requeued = results.filter((r) => r.status === 'requeued').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      message: `Requeued ${requeued} shipping job(s). ${failed} failed — check audit logs.`,
      total: orphanedJobs.length,
      requeued,
      failed,
      results,
    });
  } catch (err: any) {
    console.error('[Admin Requeue] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to requeue shipping jobs' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
