import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { writeAuditLog } from '@/lib/orchestration/audit-service';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (process.env.NODE_ENV === 'production' && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deadJobId = params.id;
    if (!deadJobId) {
      return NextResponse.json({ error: 'Missing dead job ID' }, { status: 400 });
    }

    const result = await db.transaction(async (tx: any) => {
      const [deadJob] = await tx
        .select()
        .from(schema.deadShippingJobs)
        .where(eq(schema.deadShippingJobs.id, deadJobId))
        .limit(1);

      if (!deadJob) {
        throw new Error('Dead letter job not found');
      }

      // Re-enqueue into shipping_jobs
      const [newJob] = await tx
        .insert(schema.shippingJobs)
        .values({
          order_id: deadJob.order_id,
          run_after: new Date(), // Immediate execution
          status: 'PENDING',
          attempts: 0,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      // Delete from dead_shipping_jobs
      await tx
        .delete(schema.deadShippingJobs)
        .where(eq(schema.deadShippingJobs.id, deadJobId));

      await writeAuditLog({
        orderId: deadJob.order_id,
        action: 'ADMIN_RETRYS_DEAD_LETTER_JOB',
        workerId: userId || 'admin',
        details: { oldJobId: deadJob.job_id, newJobId: newJob.id },
        clientTx: tx,
      });

      return newJob;
    });

    return NextResponse.json({
      success: true,
      message: 'Job re-enqueued successfully for immediate worker execution',
      new_job: result,
    });
  } catch (err: any) {
    console.error('[Admin Retry Dead Job Error]:', err);
    return NextResponse.json({ error: err?.message || 'Failed to retry dead letter job' }, { status: 500 });
  }
}
