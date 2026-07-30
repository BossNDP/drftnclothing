import { redis } from '@/lib/redis';

export interface RateLimitRequest {
  endpoint: 'checkout' | 'verify_payment' | 'track' | 'cancel' | 'cod';
  userId?: string | null;
  sessionToken?: string | null;
  ip: string;
  deviceId?: string | null;
}

const LIMIT_RULES: Record<string, { max: number; windowSec: number }> = {
  checkout: { max: 10, windowSec: 60 },
  verify_payment: { max: 10, windowSec: 60 },
  cancel: { max: 5, windowSec: 60 },
  track: { max: 30, windowSec: 60 },
  cod: { max: 5, windowSec: 60 },
};

export async function checkRateLimit(req: RateLimitRequest): Promise<{ success: boolean; resetSec: number }> {
  const rule = LIMIT_RULES[req.endpoint] || { max: 10, windowSec: 60 };
  const identity = req.userId || req.sessionToken || req.deviceId || req.ip;
  const key = `rl:${req.endpoint}:${identity}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, rule.windowSec);
    }
    const ttl = await redis.ttl(key);

    if (current > rule.max) {
      return { success: false, resetSec: ttl > 0 ? ttl : rule.windowSec };
    }

    return { success: true, resetSec: ttl > 0 ? ttl : 0 };
  } catch (err) {
    console.error(`[RateLimiter] Redis error for endpoint ${req.endpoint} (failing open):`, err);
    return { success: true, resetSec: 0 };
  }
}
