import { db } from '@/db';
import * as schema from '@/db/schema';
import crypto from 'crypto';

export async function writeAuditLog(params: {
  orderId?: string | null;
  correlationId?: string;
  action: string;
  workerId?: string | null;
  details?: Record<string, any>;
  clientTx?: any;
}) {
  const { orderId, correlationId = crypto.randomUUID(), action, workerId, details, clientTx } = params;
  const dbClient = clientTx || db;

  try {
    await dbClient.insert(schema.auditLogs).values({
      order_id: orderId || null,
      correlation_id: correlationId,
      action,
      worker_id: workerId || null,
      details: details || null,
      created_at: new Date(),
    });
  } catch (err) {
    console.error('[AuditService] Failed to write audit log:', err);
  }
}
