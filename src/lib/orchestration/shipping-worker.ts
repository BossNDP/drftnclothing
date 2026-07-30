import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { ShippingRouter } from './providers/shipping-router';
import { transitionOrderStatus } from './order-state-machine';
import { writeAuditLog } from './audit-service';
import crypto from 'crypto';

const RETRY_BACKOFF_MS = [
  5 * 1000,        // Retry 1: 5s
  30 * 1000,       // Retry 2: 30s
  2 * 60 * 1000,   // Retry 3: 2m
  10 * 60 * 1000,  // Retry 4: 10m
  30 * 60 * 1000,  // Retry 5: 30m
];

export async function processShippingJobs(workerId: string = `worker-${crypto.randomBytes(4).toString('hex')}`) {
  const now = new Date();
  const correlationId = crypto.randomUUID();

  // 1. Acquire pending jobs with PostgreSQL FOR UPDATE SKIP LOCKED
  const pendingJobs = await db.transaction(async (tx: any) => {
    // Select pending jobs due for execution
    const jobs = await tx
      .select()
      .from(schema.shippingJobs)
      .where(
        and(
          eq(schema.shippingJobs.status, 'PENDING'),
          lte(schema.shippingJobs.run_after, now)
        )
      )
      .for('update', { skipLocked: true })
      .limit(20);

    if (jobs.length === 0) return [];

    const lockedJobIds = jobs.map((j: any) => j.id);
    await tx
      .update(schema.shippingJobs)
      .set({
        status: 'LOCKED',
        locked_at: now,
        worker_id: workerId,
        updated_at: now,
      })
      .where(sql`id IN ${lockedJobIds}`);

    return jobs;
  });

  if (pendingJobs.length === 0) {
    return { processed: 0, locked: 0, workerId };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const job of pendingJobs) {
    try {
      await processSingleJob(job, workerId, correlationId);
      successCount++;
    } catch (err: any) {
      failureCount++;
      await handleJobFailure(job, err?.message || String(err), workerId, correlationId);
    }
  }

  return {
    processed: pendingJobs.length,
    success: successCount,
    failed: failureCount,
    workerId,
  };
}

export async function processSingleJobById(params: {

  jobId: string;
  workerId?: string;
  correlationId?: string;
}) {
  const {
    jobId,
    workerId = `qstash-worker-${crypto.randomBytes(3).toString('hex')}`,
    correlationId = crypto.randomUUID(),
  } = params;

  // Read job state from DB
  const [job] = await db
    .select()
    .from(schema.shippingJobs)
    .where(eq(schema.shippingJobs.id, jobId))
    .limit(1);

  if (!job) {
    return { status: 'NOT_FOUND', message: `Shipping job ${jobId} not found` };
  }

  if (job.status === 'COMPLETED') {
    return { status: 'COMPLETED', message: 'Job already completed (idempotent)' };
  }

  if (job.status === 'FAILED') {
    return { status: 'FAILED', message: `Job is in FAILED state: ${job.last_error}` };
  }

  try {
    await processSingleJob(job, workerId, correlationId);
    return { status: 'SUCCESS', jobId, orderId: job.order_id };
  } catch (err: any) {
    await handleJobFailure(job, err?.message || String(err), workerId, correlationId);
    return { status: 'ERROR', jobId, error: err?.message || String(err) };
  }
}

async function processSingleJob(job: any, workerId: string, correlationId: string) {
  // ── PHASE 1: DB Transaction — Lock order, check guards, transition to READY_FOR_SHIPPING ──
  const phase1Result = await db.transaction(async (tx: any) => {
    // Read Order with FOR UPDATE
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, job.order_id))
      .for('update')
      .limit(1);

    if (!order) {
      await tx
        .update(schema.shippingJobs)
        .set({ status: 'FAILED', last_error: 'ORDER_NOT_FOUND', updated_at: new Date() })
        .where(eq(schema.shippingJobs.id, job.id));
      return { status: 'ABORT' };
    }

    // ── Guard 1: Cancellation ──
    if (order.order_status === 'CANCELLED') {
      await tx
        .update(schema.shippingJobs)
        .set({ status: 'COMPLETED', last_error: 'Order was cancelled; job skipped.', updated_at: new Date() })
        .where(eq(schema.shippingJobs.id, job.id));

      await writeAuditLog({
        orderId: order.id,
        correlationId,
        action: 'SHIPPING_WORKER:JOB_SKIPPED_CANCELLED_ORDER',
        workerId,
        clientTx: tx,
      });
      return { status: 'ABORT' };
    }

    // ── Guard 2: Payment verification ──
    const acceptablePaymentStatuses = ['paid', 'partially_paid'];
    if (!acceptablePaymentStatuses.includes(order.payment_status || '')) {
      await tx
        .update(schema.shippingJobs)
        .set({
          status: 'FAILED',
          last_error: `Payment not confirmed. payment_status=${order.payment_status}. Job aborted.`,
          updated_at: new Date(),
        })
        .where(eq(schema.shippingJobs.id, job.id));

      await writeAuditLog({
        orderId: order.id,
        correlationId,
        action: 'SHIPPING_WORKER:JOB_ABORTED_PAYMENT_NOT_CONFIRMED',
        workerId,
        details: { payment_status: order.payment_status },
        clientTx: tx,
      });
      return { status: 'ABORT' };
    }

    // ── Guard 3: Cancellation window re-verification (never trust queued timestamp) ──
    if (order.cancel_allowed_until && new Date(order.cancel_allowed_until) > new Date()) {
      const rescheduleAt = new Date(order.cancel_allowed_until);
      await tx
        .update(schema.shippingJobs)
        .set({
          status: 'PENDING',
          run_after: rescheduleAt,
          last_error: 'Cancellation window still open — rescheduled.',
          updated_at: new Date(),
        })
        .where(eq(schema.shippingJobs.id, job.id));

      await writeAuditLog({
        orderId: order.id,
        correlationId,
        action: 'SHIPPING_WORKER:JOB_RESCHEDULED_CANCELLATION_WINDOW_OPEN',
        workerId,
        details: { cancel_allowed_until: order.cancel_allowed_until, rescheduleAt: rescheduleAt.toISOString() },
        clientTx: tx,
      });
      return { status: 'ABORT' };
    }

    // ── Guard 4: Duplicate shipment (idempotency) ──
    if (order.awb_code || order.provider_shipment_id || order.shiprocket_order_id || order.borzo_order_id) {
      await tx
        .update(schema.shippingJobs)
        .set({
          status: 'COMPLETED',
          last_error: 'Shipment already exists — job marked complete (idempotent).',
          updated_at: new Date(),
        })
        .where(eq(schema.shippingJobs.id, job.id));

      await writeAuditLog({
        orderId: order.id,
        correlationId,
        action: 'SHIPPING_WORKER:JOB_SKIPPED_SHIPMENT_ALREADY_EXISTS',
        workerId,
        details: {
          awb_code: order.awb_code,
          provider_shipment_id: order.provider_shipment_id,
        },
        clientTx: tx,
      });
      return { status: 'ABORT' };
    }

    // Transition state from CANCELLATION_WINDOW / PAID -> READY_FOR_SHIPPING
    let currentStatus = order.order_status;
    if (currentStatus === 'CANCELLATION_WINDOW' || currentStatus === 'PAID') {
      await transitionOrderStatus({
        orderId: order.id,
        currentStatus,
        targetState: 'READY_FOR_SHIPPING',
        workerId,
        correlationId,
        clientTx: tx,
      });
      currentStatus = 'READY_FOR_SHIPPING';
    }

    const itemsList = (order.items as any[]) || [];
    return {
      status: 'DISPATCH',
      dispatchInput: {
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        shippingAddress: order.shipping_address as any,
        items: itemsList.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, slug: i.slug })),
        subtotal: order.subtotal,
        total: order.total,
        paymentType: order.payment_type === 'cod' ? 'cod' : 'prepaid',
        remainingAmount: order.remaining_amount || 0,
        shippingProviderPreference: order.courier_provider || undefined,
      },
    };
  });

  if (phase1Result.status === 'ABORT' || !phase1Result.dispatchInput) {
    return;
  }

  // ── PHASE 2: External HTTP Request — Executed OUTSIDE database transaction ──
  // External HTTP calls (Shiprocket/Borzo) are made without holding DB connection pool locks.
  const shippingResult = await ShippingRouter.dispatchShipment(phase1Result.dispatchInput);

  // ── PHASE 3: DB Transaction — Record shipment details & mark job COMPLETED ──
  await db.transaction(async (tx: any) => {
    await tx
      .update(schema.orders)
      .set({
        fulfillment_type: shippingResult.provider,
        provider_shipment_id: shippingResult.shipmentId,
        awb_code: shippingResult.awbCode,
        courier_name: shippingResult.courierName,
        courier_provider: shippingResult.provider,
        tracking_number: shippingResult.awbCode,
        tracking_url: shippingResult.trackingUrl,
        label_url: shippingResult.labelUrl || null,
        shiprocket_order_id: shippingResult.provider === 'shiprocket' ? shippingResult.shipmentId : null,
        borzo_order_id: shippingResult.provider === 'borzo' ? shippingResult.shipmentId : null,
        updated_at: new Date(),
      })
      .where(eq(schema.orders.id, phase1Result.dispatchInput.orderId));

    // Transition Order state to SHIPPING_CREATED
    await transitionOrderStatus({
      orderId: phase1Result.dispatchInput.orderId,
      currentStatus: 'READY_FOR_SHIPPING',
      targetState: 'SHIPPING_CREATED',
      workerId,
      correlationId,
      clientTx: tx,
    });

    // Mark shipping job COMPLETED
    await tx
      .update(schema.shippingJobs)
      .set({
        status: 'COMPLETED',
        updated_at: new Date(),
      })
      .where(eq(schema.shippingJobs.id, job.id));

    await writeAuditLog({
      orderId: phase1Result.dispatchInput.orderId,
      correlationId,
      action: 'SHIPPING_WORKER:SHIPMENT_CREATED_SUCCESS',
      workerId,
      details: {
        provider: shippingResult.provider,
        shipmentId: shippingResult.shipmentId,
        awbCode: shippingResult.awbCode,
      },
      clientTx: tx,
    });
  });
}

async function handleJobFailure(job: any, errorMessage: string, workerId: string, correlationId: string) {
  const nextAttempts = (job.attempts || 0) + 1;

  if (nextAttempts <= 5) {
    const backoffMs = RETRY_BACKOFF_MS[nextAttempts - 1] || 30 * 60 * 1000;
    const nextRunAfter = new Date(Date.now() + backoffMs);

    await db
      .update(schema.shippingJobs)
      .set({
        status: 'PENDING',
        attempts: nextAttempts,
        run_after: nextRunAfter,
        last_error: errorMessage,
        updated_at: new Date(),
      })
      .where(eq(schema.shippingJobs.id, job.id));

    await writeAuditLog({
      orderId: job.order_id,
      correlationId,
      action: `SHIPPING_WORKER:RETRY_SCHEDULED_ATTEMPT_${nextAttempts}`,
      workerId,
      details: { nextRunAfter: nextRunAfter.toISOString(), error: errorMessage },
    });
  } else {
    // 5 failures reached -> Move to Dead Letter Queue (dead_shipping_jobs)
    await db.transaction(async (tx: any) => {
      await tx.insert(schema.deadShippingJobs).values({
        job_id: job.id,
        order_id: job.order_id,
        reason: `Exceeded maximum retries (5). Last error: ${errorMessage}`,
        failed_at: new Date(),
        last_error: errorMessage,
        attempts: nextAttempts,
        payload: job,
      });

      await tx
        .update(schema.shippingJobs)
        .set({
          status: 'FAILED',
          attempts: nextAttempts,
          last_error: errorMessage,
          updated_at: new Date(),
        })
        .where(eq(schema.shippingJobs.id, job.id));

      await writeAuditLog({
        orderId: job.order_id,
        correlationId,
        action: 'SHIPPING_WORKER:JOB_MOVED_TO_DEAD_LETTER_QUEUE',
        workerId,
        details: { attempts: nextAttempts, error: errorMessage },
        clientTx: tx,
      });
    });
  }
}
