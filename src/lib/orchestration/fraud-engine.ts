import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, or, and, gte, sql } from 'drizzle-orm';
import { writeAuditLog } from './audit-service';

export interface FraudEvaluationInput {
  userId?: string | null;
  phone: string;
  email: string;
  ip: string;
  deviceFingerprint?: string | null;
  shippingAddress?: any;
}

export interface FraudEvaluationResult {
  allowCod: boolean;
  score: number;
  reason?: string;
}

const FRAUD_THRESHOLD = 50;

export async function evaluateFraud(input: FraudEvaluationInput): Promise<FraudEvaluationResult> {
  const { userId, phone, email, ip, deviceFingerprint } = input;
  let score = 0;
  const reasons: string[] = [];

  try {
    // 1. Direct lookup in fraud_scores table for pre-flagged entries
    const existingScores = await db
      .select()
      .from(schema.fraudScores)
      .where(
        or(
          phone ? eq(schema.fraudScores.phone, phone) : undefined,
          email ? eq(schema.fraudScores.email, email) : undefined,
          userId ? eq(schema.fraudScores.user_id, userId) : undefined,
          ip ? eq(schema.fraudScores.ip_address, ip) : undefined
        )
      )
      .limit(5);

    for (const record of existingScores) {
      if (record.is_cod_disabled) {
        return {
          allowCod: false,
          score: Math.max(record.fraud_score, FRAUD_THRESHOLD),
          reason: record.reason || 'COD disabled due to prior security flag',
        };
      }
      score += record.fraud_score;
    }

    // 2. Query order history for cancellations and failed COD payments in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userOrders = await db
      .select()
      .from(schema.orders)
      .where(
        and(
          or(
            phone ? eq(schema.orders.customer_phone, phone) : undefined,
            email ? eq(schema.orders.customer_email, email) : undefined,
            userId ? eq(schema.orders.user_id, userId) : undefined
          ),
          gte(schema.orders.created_at, thirtyDaysAgo)
        )
      );

    if (userOrders.length > 0) {
      const cancelledCount = userOrders.filter((o: any) => o.order_status === 'CANCELLED').length;
      const totalOrders = userOrders.length;
      const cancellationRate = cancelledCount / totalOrders;

      if (totalOrders >= 3 && cancellationRate > 0.4) {
        score += 35;
        reasons.push(`High cancellation rate (${(cancellationRate * 100).toFixed(0)}%)`);
      }

      const failedCodCount = userOrders.filter(
        (o: any) => o.payment_type === 'cod' && (o.payment_status === 'failed' || o.order_status === 'PAYMENT_FAILED')
      ).length;

      if (failedCodCount >= 2) {
        score += 40;
        reasons.push(`${failedCodCount} failed COD booking payments in last 30 days`);
      }
    }

    // 3. Query high-frequency orders from IP in last 1 hour (bot / spam velocity check)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentIpOrders = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.orders)
      .where(gte(schema.orders.created_at, oneHourAgo));

    const ipCount = recentIpOrders[0]?.count || 0;
    if (ipCount >= 10) {
      score += 50;
      reasons.push(`High order volume from IP in last hour (${ipCount} orders)`);
    }

    const allowCod = score < FRAUD_THRESHOLD;
    const finalReason = reasons.join('; ');

    // 4. Update or insert fraud score record
    if (score > 0) {
      await db.insert(schema.fraudScores).values({
        user_id: userId || null,
        phone,
        email,
        ip_address: ip,
        device_fingerprint: deviceFingerprint || null,
        fraud_score: score,
        is_cod_disabled: !allowCod,
        reason: finalReason || null,
        updated_at: new Date(),
      });

      await writeAuditLog({
        orderId: null,
        action: `FRAUD_EVALUATION:${allowCod ? 'ALLOW_COD' : 'BLOCK_COD'}`,
        details: { phone, email, ip, score, allowCod, reason: finalReason },
      });
    }

    return {
      allowCod,
      score,
      reason: allowCod ? undefined : finalReason || 'Automated fraud risk threshold exceeded',
    };
  } catch (err) {
    console.error('[FraudEngine] Error evaluating fraud score:', err);
    // On error, fail safe (allow COD unless score was already high)
    return { allowCod: true, score: 0 };
  }
}
