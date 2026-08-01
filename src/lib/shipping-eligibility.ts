import { redis } from './redis';
import { db } from '@/db';
import * as schema from '@/db/schema';

export interface EligibilityResult {
  borzoEligible: boolean;
  extraCharge: number; // in Rupees (e.g. 150)
  shiprocketAvailable: boolean;
  estimatedStandardDays: number;
  codAvailable: boolean;
}

/**
 * Single shared helper to check shipping serviceability for a PIN code.
 * Checks Redis cache first (TTL: 20 minutes). If cache miss, queries Borzo & Shiprocket serviceability.
 */
export async function checkDeliveryEligibility(pincode: string): Promise<EligibilityResult> {
  const cleanPincode = pincode.trim();
  if (!/^\d{6}$/.test(cleanPincode)) {
    return {
      borzoEligible: false,
      extraCharge: 0,
      shiprocketAvailable: false,
      estimatedStandardDays: 5,
      codAvailable: false,
    };
  }

  const cacheKey = `delivery:pincode:${cleanPincode}`;

  try {
    // 1. Check Redis cache hit
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return parsed as EligibilityResult;
    }
  } catch (err) {
    console.error('[Shipping Eligibility] Redis cache read failed:', err);
  }

  // 2. Cache Miss: Execute eligibility calculation
  console.log(`[Shipping Eligibility] Cache MISS for pincode ${cleanPincode} - computing status`);

  let borzoEligible = false;
  let extraCharge = 150; // Default flat ₹150 for express local delivery
  let shiprocketAvailable = true; // Default standard serviceability
  let codAvailable = true;

  // Determine standard Shiprocket delivery days
  let estimatedStandardDays = 5; // Default 4-6 days
  if (cleanPincode.startsWith('560')) {
    estimatedStandardDays = 2; // Bangalore local 1-2 days
  } else if (cleanPincode.startsWith('5')) {
    estimatedStandardDays = 3; // Karnataka 2-3 days
  }

  const borzoKey = process.env.BORZO_API_KEY;
  const isMock = !borzoKey || borzoKey.includes('placeholder') || borzoKey.includes('mock');

  if (isMock) {
    // Mock Mode boundary check: Bangalore municipal limits (560001 to 560300)
    const pinVal = Number(cleanPincode);
    if (pinVal >= 560001 && pinVal <= 560300) {
      borzoEligible = true;
      extraCharge = 150;
    } else {
      borzoEligible = false;
      extraCharge = 0;
    }
    console.log(`[Shipping Eligibility] [Mock Mode] Pincode ${cleanPincode} Borzo eligibility: ${borzoEligible}`);
  } else {
    // Real API Call Mode
    try {
      // Retrieve pickup location from settings or fallback to standard store address
      const dbSettings = await db.select().from(schema.settings);
      let pickupAddr = 'DRFTN Store, Yelahanka, Bengaluru - 560064';
      dbSettings.forEach((row: any) => {
        if (row.key === 'borzo_pickup_address') pickupAddr = row.value;
      });

      const endpoint = process.env.BORZO_API_URL || 'https://robot.borzodelivery.com/api/business/1.8/calculate-order';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DV-Auth-Token': borzoKey,
        },
        body: JSON.stringify({
          points: [
            {
              address: pickupAddr,
              contact_person: { phone: '917406164512' },
            },
            {
              address: `Bengaluru, Karnataka - ${cleanPincode}`,
              contact_person: { phone: '919999999999' },
            },
          ],
          matter: 'Clothing Delivery serviceability check',
          total_weight_kg: 0.5,
          vehicle_type: 8, // Motorcycle
        }),
      });

      const resData = await response.json();

      if (response.ok && resData.is_successful !== false && resData.order?.payment_amount) {
        borzoEligible = true;
        const rawAmount = parseFloat(resData.order.payment_amount);
        extraCharge = isNaN(rawAmount) ? 150 : Math.max(120, Math.ceil(rawAmount));
        console.log(`[Shipping Eligibility] Real Borzo API check SUCCESS for ${cleanPincode}. Cost: ${extraCharge}`);
      } else {
        console.warn(`[Shipping Eligibility] Real Borzo API check FAILED for ${cleanPincode}:`, resData.parameter_errors || resData);
        borzoEligible = false;
        extraCharge = 0;
      }
    } catch (apiErr) {
      console.error(`[Shipping Eligibility] Exception calling Borzo API for ${cleanPincode}:`, apiErr);
      borzoEligible = false;
      extraCharge = 0;
    }
  }

  const result: EligibilityResult = {
    borzoEligible,
    extraCharge,
    shiprocketAvailable,
    estimatedStandardDays,
    codAvailable,
  };

  // 3. Cache the computed result in Redis for 20 minutes (1200 seconds)
  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: 1200 });
  } catch (cacheErr) {
    console.error('[Shipping Eligibility] Failed to write cache to Redis:', cacheErr);
  }

  return result;
}

/**
 * getDeliveryEligibilityCacheOnly
 *
 * CHECKOUT-SAFE variant of checkDeliveryEligibility.
 * Reads ONLY from Redis cache — never calls external APIs.
 */
export async function getDeliveryEligibilityCacheOnly(pincode: string): Promise<EligibilityResult> {
  const cleanPincode = pincode.trim();

  let estimatedStandardDays = 5;
  if (cleanPincode.startsWith('560')) estimatedStandardDays = 2;
  else if (cleanPincode.startsWith('5')) estimatedStandardDays = 3;

  const safeDefault: EligibilityResult = {
    borzoEligible: false,
    extraCharge: 0,
    shiprocketAvailable: true,
    estimatedStandardDays,
    codAvailable: true,
  };

  if (!/^\d{6}$/.test(cleanPincode)) return { ...safeDefault, shiprocketAvailable: false, codAvailable: false };

  const cacheKey = `delivery:pincode:${cleanPincode}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return parsed as EligibilityResult;
    }
  } catch (err) {
    console.error('[Shipping Eligibility] Redis cache read failed (cache-only path):', err);
  }

  return safeDefault;
}
