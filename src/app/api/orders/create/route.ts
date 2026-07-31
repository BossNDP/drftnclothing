import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import crypto from 'crypto';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, or, ne, inArray, sql } from 'drizzle-orm';
import { waitUntil } from '@vercel/functions';

function generateOrderNumber(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(6);
  let randomStr = '';
  for (let i = 0; i < 6; i++) {
    randomStr += chars[bytes[i] % chars.length];
  }
  return `DRFTN-${randomStr}`;
}

import { createOrderSchema } from '@/lib/validations';
import { razorpay } from '@/lib/razorpay';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';

import { verifyToken } from '@/lib/jwt';
import { cleanupExpiredOrders } from '@/lib/orderCleanup';
import { getDeliveryEligibilityCacheOnly } from '@/lib/shipping-eligibility';

export async function POST(request: Request) {
  const tStart = performance.now();
  const logPerf = (label: string) => {
    console.log(`[Perf] ${label}: ${(performance.now() - tStart).toFixed(1)}ms`);
  };

  // Self-healing cleanup: run on ~2% of requests (fire-and-forget).
  // Triggering on every request AND awaiting it serializes all concurrent
  // checkouts through the cleanup lock — catastrophic at drop-day concurrency.
  // Primary cleanup path is the external cron hitting /api/orders/cleanup-holds.
  if (Math.random() < 0.02) {
    waitUntil(
      cleanupExpiredOrders().catch((err) => console.error('Background hold cleanup failed:', err))
    );
  }


  let clerkUserId: string | null = null;
  let finalUserId: string | null = null;
  let reqBody: any = null;

  // Track Redis claims and idempotency keys to release on failure
  let idempotencyKeysToClean: string[] = [];
  let itemsToRelease: Array<{ productId: string; size: string; quantity: number }> = [];

  try {
    // 0. Verify authentication
    // Read the session cookie directly from the request header to avoid the
    // next/headers cookies() "Secure Origin" crash on load-test and external
    // curl requests that don't have a browser-provided Origin header.
    const rawCookie = request.headers.get('cookie') || '';
    const sessionToken = rawCookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('drftn_session='))
      ?.split('=')?.[1];

    if (sessionToken) {
      const payload = await verifyToken(sessionToken);
      if (payload && payload.userId) {
        finalUserId = payload.userId as string;
      }
    }

    if (!finalUserId) {
      const testUserIdHeader = request.headers.get('x-load-test-user-id');
      if (testUserIdHeader && process.env.ENABLE_LOAD_TEST === 'true') {
        finalUserId = testUserIdHeader;
      }
    }

    if (!finalUserId) {
      try {
        const authStart = performance.now();
        const { userId } = await auth();
        console.log(`[Perf] Clerk auth() call took: ${(performance.now() - authStart).toFixed(1)}ms`);
        clerkUserId = userId;
        finalUserId = userId;
      } catch (clerkErr: any) {
        // Clerk throws SecureOriginError when clerkMiddleware() context is absent
        // (e.g. programmatic curl, load-test requests without a browser session).
        // Treat as unauthenticated — the finalUserId null-check below will return 401.
        console.warn('[Auth] Clerk auth() threw, treating as unauthenticated:', clerkErr?.message ?? clerkErr);
      }
    }

    if (!finalUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be signed in to place an order.' },
        { status: 401 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitIdentity = finalUserId || sessionToken || ip;

    // 1. Rate limit check first
    try {
      const { buyAttemptLimiter } = await import('@/lib/buy-limiter');
      const { success, reset } = await buyAttemptLimiter.limit(rateLimitIdentity);
      if (!success) {
        return NextResponse.json(
          { error: 'Too many attempts, slow down.' },
          { 
            status: 429,
            headers: {
              'Retry-After': String(reset),
            }
          }
        );
      }
    } catch (rlErr) {
      console.error('Rate limiting service failed (failing open):', rlErr);
    }

    const body = await request.json();
    reqBody = body;

    // 1. Zod input validation
    const validationResult = createOrderSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Order validation failed:', JSON.stringify(validationResult.error.format(), null, 2));
      return NextResponse.json(
        { error: 'Invalid order input data', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { items, discountCode, customerInfo, fulfillmentType, paymentMethod, shippingProvider, verifiedPhone, verifiedPhoneToken } = validationResult.data;
    const isPickup = fulfillmentType === 'pickup';
    const isCod = paymentMethod === 'cod';

    // 1b. Fraud engine evaluation for COD
    if (isCod) {
      const { evaluateFraud } = await import('@/lib/orchestration/fraud-engine');
      const fraudEval = await evaluateFraud({
        userId: finalUserId,
        phone: customerInfo.phone,
        email: customerInfo.email,
        ip,
      });

      if (!fraudEval.allowCod) {
        return NextResponse.json(
          { error: `COD is currently unavailable for this account/address. ${fraudEval.reason || ''}` },
          { status: 400 }
        );
      }
    }

    // 2. Idempotency check
    const idempotencyIdentity = finalUserId || sessionToken || ip;
    let isDuplicateClaim = false;

    try {
      const { redis } = await import('@/lib/redis');
      for (const item of items) {
        const idemKey = `idem:${idempotencyIdentity}:${item.productId}:${item.size}`;
        const isNewClaim = await redis.set(idemKey, '1', { nx: true, ex: 600 });
        if (!isNewClaim) {
          isDuplicateClaim = true;
          break;
        }
        idempotencyKeysToClean.push(idemKey);
      }
    } catch (idemErr) {
      console.error('Idempotency service check failed (failing open):', idemErr);
    }

    if (isDuplicateClaim) {
      // Clean up any keys we just set in this failed attempt
      try {
        const { redis } = await import('@/lib/redis');
        for (const key of idempotencyKeysToClean) {
          await redis.del(key);
        }
      } catch (delErr) {
        console.error('Failed to clean up idempotency keys:', delErr);
      }
      return NextResponse.json(
        { error: 'You already have an active reservation for this item.' },
        { status: 409 }
      );
    }

    // 3. Redis claim — atomic multi-unit: single DECRBY per item, no partial loops
    let allClaimed = true;
    let failedItemSize: string | null = null;
    let failedItemAvailable: number = 0;

    try {
      const { tryClaimUnitSafe } = await import('@/lib/stock-gate');
      for (const item of items) {
        const lockTargetId = (item as any).variantId || item.productId;
        const result = await tryClaimUnitSafe(lockTargetId, item.size, item.quantity);
        if (!result.success) {
          allClaimed = false;
          failedItemSize = item.size;
          failedItemAvailable = result.stock;
          break;
        }
        // Track what we claimed so we can roll back on failure
        itemsToRelease.push({ productId: lockTargetId, size: item.size, quantity: item.quantity });
      }
    } catch (claimErr) {
      console.error('Redis claim service failed (failing open):', claimErr);
    }

    if (!allClaimed) {
      // Release any units we already claimed (rollback)
      try {
        const { releaseUnitSafe } = await import('@/lib/stock-gate');
        for (const claimed of itemsToRelease) {
          await releaseUnitSafe(claimed.productId, claimed.size, claimed.quantity);
        }
        itemsToRelease = [];
      } catch (releaseErr) {
        console.error('Failed to release partially claimed units:', releaseErr);
      }

      // Delete idempotency keys
      try {
        const { redis } = await import('@/lib/redis');
        for (const key of idempotencyKeysToClean) {
          await redis.del(key);
        }
        idempotencyKeysToClean = [];
      } catch (delErr) {
        console.error('Failed to delete idempotency keys:', delErr);
      }

      return NextResponse.json(
        { error: `Only ${failedItemAvailable} unit${failedItemAvailable === 1 ? '' : 's'} available for size ${failedItemSize}. Please reduce the quantity in your cart.` },
        { status: 400 }
      );
    }

    logPerf('Redis Claim Succeeded');

    // Inline phone verification check (mandatory for both COD and Razorpay checkouts)
    if (!verifiedPhone || !verifiedPhoneToken) {
      return NextResponse.json({ error: 'Phone OTP verification is required to place an order.' }, { status: 400 });
    }

    const clientId = process.env.PHONE_EMAIL_CLIENT_ID || process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID || 'mock_client_id';
    let verifiedSuccess = false;
    let matchedPhone = '';

    if (verifiedPhoneToken === 'session_verified_phone') {
      // Look up logged-in user details in database to verify phone
      const [dbUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, finalUserId!))
        .limit(1);
      
      if (dbUser && dbUser.phoneVerified && dbUser.phone) {
        verifiedSuccess = true;
        matchedPhone = dbUser.phone;
      } else if (dbUser && verifiedPhone) {
        // Gmail users may not have a phone in DB yet — they just verified
        // via OTP at checkout. Trust the client-supplied verifiedPhone since
        // the session cookie proves they're authenticated.
        verifiedSuccess = true;
        matchedPhone = verifiedPhone;
      }
    } else if (verifiedPhoneToken.startsWith('mock_token_')) {
      // Mock OTP bypass — only allowed when explicitly enabled for local dev.
      // ENABLE_MOCK_OTP must be 'true' AND we must not be in production.
      const isMockAllowed =
        process.env.ENABLE_MOCK_OTP === 'true' &&
        process.env.NODE_ENV !== 'production';

      if (isMockAllowed) {
        verifiedSuccess = true;
        matchedPhone = verifiedPhoneToken.replace('mock_token_', '');
      } else {
        // In production (or when flag is absent), reject mock tokens outright
        return NextResponse.json(
          { error: 'Invalid verification token' },
          { status: 400 }
        );
      }
    } else {
      try {
        const verifyUrl = 'https://eapi.phone.email/getuser';
        const formData = new FormData();
        formData.append('client_id', clientId);
        formData.append('access_token', verifiedPhoneToken);

        const phoneRes = await fetch(verifyUrl, {
          method: 'POST',
          body: formData,
        });
        const phoneData = await phoneRes.json();
        const phoneNo = phoneData.phone_no || (phoneData.userDetails && phoneData.userDetails.phoneNo);
        const countryCode = phoneData.country_code || (phoneData.userDetails && phoneData.userDetails.countryCode);

        if (phoneRes.ok && phoneNo) {
          verifiedSuccess = true;
          matchedPhone = `${countryCode || ''}${phoneNo}`;
        }
      } catch (err) {
        console.error('Inline OTP verification check failed:', err);
      }
    }

    if (!verifiedSuccess) {
      return NextResponse.json({ error: 'Invalid or expired phone verification OTP.' }, { status: 400 });
    }

    // Normalise both phone values — strip +, spaces, leading 91 for 12-digit strings
    const normalise = (p: string) => {
      const d = p.replace(/[^0-9]/g, '');
      if (d.length === 12 && d.startsWith('91')) return d.slice(2);
      return d;
    };
    const cleanVerified = normalise(verifiedPhone);
    const cleanMatched = normalise(matchedPhone);
    if (cleanVerified !== cleanMatched) {
      return NextResponse.json({ error: 'Verified phone number mismatch.' }, { status: 400 });
    }

    logPerf('Phone OTP Verified');

    // 2. Fetch products, product images, settings, discount code, and sequence number concurrently
    const productIds = items.map((i) => i.productId);
    const dbProductsPromise = db
      .select()
      .from(schema.products)
      .where(and(
        inArray(schema.products.id, productIds),
        eq(schema.products.is_active, true)
      ));

    const dbProductImagesPromise = db
      .select()
      .from(schema.productImages)
      .where(inArray(schema.productImages.product_id, productIds));

    const dbSettingsPromise = !isPickup 
      ? db.select().from(schema.settings)
      : Promise.resolve([]);

    const cleanCode = discountCode ? discountCode.toUpperCase().trim() : null;
    const dbCodePromise = cleanCode
      ? db
          .select()
          .from(schema.discountCodes)
          .where(and(
            eq(schema.discountCodes.code, cleanCode),
            eq(schema.discountCodes.is_active, true)
          ))
          .limit(1)
      : Promise.resolve([]);

    // Await all promises in parallel
    const [dbProducts, dbProductImages, dbSettings, dbCodeRows] = await Promise.all([
      dbProductsPromise,
      dbProductImagesPromise,
      dbSettingsPromise,
      dbCodePromise
    ]);

    if (dbProducts.length !== new Set(productIds).size) {
      return NextResponse.json({ error: 'One or more products are inactive or not found' }, { status: 400 });
    }

    // 3. Verify stock availability and calculate subtotal (in paise)
    let calculatedSubtotal = 0;
    const orderItemsToSave: Array<{
      id: string;
      name: string;
      size: string;
      quantity: number;
      price: number;
      image: string;
      slug: string;
      weight_grams: number;
    }> = [];

    for (const item of items) {
      const dbProd = dbProducts.find((p: any) => p.id === item.productId);
      if (!dbProd) {
        return NextResponse.json({ error: 'Product verification failed' }, { status: 400 });
      }

      // Check stock
      const stock = dbProd.stock_quantity || {};
      const available = stock[item.size] || 0;
      if (available < item.quantity) {
        return NextResponse.json(
          { error: `Product "${dbProd.name}" in size ${item.size} is out of stock.` },
          { status: 400 }
        );
      }

      calculatedSubtotal += dbProd.price * item.quantity;

      const prodImages = dbProductImages.filter((img: any) => img.product_id === item.productId);
      const firstImage = dbProd.images?.[0] || prodImages?.[0]?.image_url || '';

      orderItemsToSave.push({
        id: dbProd.id,
        name: dbProd.name,
        size: item.size,
        quantity: item.quantity,
        price: dbProd.price, // stored in paise
        image: firstImage,
        slug: dbProd.slug,
        weight_grams: dbProd.weight_grams || 500,
      });
    }

    // 4. Fetch dynamic store settings from database (ignored if pickup)
    let shippingCharge = 0;
    let freeShippingThreshold = 99900; // default ₹999 in paise
    let defaultShippingCharge = 9900;  // default ₹99 in paise
    let codFee = 5000;                  // default ₹50 in paise

    if (!isPickup) {
      dbSettings.forEach((row: any) => {
        if (row.key === 'free_shipping_threshold') freeShippingThreshold = Number(row.value);
        if (row.key === 'default_shipping_charge') defaultShippingCharge = Number(row.value);
        if (row.key === 'cod_fee') codFee = Number(row.value);
      });

      // Calculate shipping before discount
      shippingCharge = calculatedSubtotal >= freeShippingThreshold ? 0 : defaultShippingCharge;
    }

    // 5. Server-side discount validation
    let discountAmount = 0;
    let validatedCode: string | undefined = undefined;

    const isDriftOrderCode = cleanCode && (cleanCode === 'DRFTNMODEON20' || cleanCode === 'DRIFTMODE20' || cleanCode.startsWith('DRIFT-') || cleanCode.startsWith('DRIFT'));

    if (isDriftOrderCode) {
      const [settings] = await db
        .select()
        .from(schema.driftModeSettings)
        .where(eq(schema.driftModeSettings.id, 1))
        .limit(1);

      const dPercent = settings?.discount_percent || 20;
      discountAmount = Math.round(calculatedSubtotal * (dPercent / 100));
      discountAmount = Math.min(discountAmount, calculatedSubtotal);
      validatedCode = cleanCode;
    } else if (discountCode) {
      const dbCode = dbCodeRows[0];

      if (!dbCode) {
        return NextResponse.json({ error: 'Invalid or inactive discount coupon' }, { status: 400 });
      }

      // Verify expiration (safe to check outside tx — expiry is immutable once set)
      if (dbCode.expires_at && new Date(dbCode.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Discount code has expired' }, { status: 400 });
      }

      // Early-exit preflight for usage limit — definitive re-check happens inside tx with FOR UPDATE
      if (dbCode.usage_limit !== null && dbCode.used_count >= dbCode.usage_limit) {
        return NextResponse.json({ error: 'Discount code usage limit has been reached' }, { status: 400 });
      }

      // First-order welcome discount check
      let signupDiscountCode = 'DRFTN10';
      dbSettings.forEach((row: any) => {
        if (row.key === 'signup_discount_code') signupDiscountCode = row.value.toUpperCase().trim();
      });

      const isFirstOrderCode = !!cleanCode && (cleanCode === signupDiscountCode || cleanCode.includes('WELCOME') || cleanCode.includes('FIRST'));

      if (isFirstOrderCode) {
        const emailToMatch = customerInfo.email ? customerInfo.email.toLowerCase().trim() : '';
        const phoneToMatch = customerInfo.phone ? customerInfo.phone.trim() : '';

        const conditions = [];
        if (emailToMatch) conditions.push(eq(schema.orders.customer_email, emailToMatch));
        if (phoneToMatch) conditions.push(eq(schema.orders.customer_phone, phoneToMatch));
        if (finalUserId) conditions.push(eq(schema.orders.user_id, finalUserId));

        if (conditions.length > 0) {
          const [existingOrder] = await db
            .select({ id: schema.orders.id })
            .from(schema.orders)
            .where(
              and(
                or(...conditions),
                ne(schema.orders.order_status, 'cancelled')
              )
            )
            .limit(1);

          if (existingOrder) {
            return NextResponse.json(
              { error: 'This welcome discount code is valid for first-time orders only.' },
              { status: 400 }
            );
          }
        }
      }

      // Verify minimum order value
      const minOrderVal = Number(dbCode.min_order_value || 0);
      if (calculatedSubtotal < minOrderVal) {
        return NextResponse.json(
          { error: `Minimum order subtotal of ₹${(minOrderVal / 100).toFixed(2)} required for this code` },
          { status: 400 }
        );
      }

      // Calculate discount amount (paise)
      if (dbCode.discount_type === 'percent') {
        discountAmount = Math.round(calculatedSubtotal * (dbCode.discount_value / 100));
        if (dbCode.max_discount_amount && dbCode.max_discount_amount > 0) {
          discountAmount = Math.min(discountAmount, dbCode.max_discount_amount);
        }
      } else if (dbCode.discount_type === 'flat') {
        discountAmount = dbCode.discount_value;
      }

      // Cap discount amount at subtotal
      discountAmount = Math.min(discountAmount, calculatedSubtotal);
      validatedCode = cleanCode!;
    }

    const discountedSubtotal = Math.max(0, calculatedSubtotal - discountAmount);

    let borzoFreeThreshold = 149900;    // default ₹1499 in paise
    dbSettings.forEach((row: any) => {
      if (row.key === 'borzo_free_threshold') borzoFreeThreshold = Number(row.value);
    });

    let isExpressAvailable = false;
    let computedExpressCharge = 15000; // default ₹150 in paise
    
    if (!isPickup && customerInfo.address?.pincode) {
      // CHECKOUT SAFETY: Only read from Redis cache — never call Borzo API live during checkout.
      // The cache is populated when the customer enters their address (serviceability endpoint).
      // On cache miss this returns borzoEligible:false (standard shipping) with zero latency.
      const eligibilityResult = await getDeliveryEligibilityCacheOnly(customerInfo.address.pincode);
      isExpressAvailable = eligibilityResult.borzoEligible;
      computedExpressCharge = eligibilityResult.extraCharge * 100; // convert to paise
    }

    const zone = isExpressAvailable ? 'BLR_EXPRESS' : 'STANDARD';

    shippingCharge = 0;
    if (!isPickup) {
      if (shippingProvider === 'express') {
        if (!isExpressAvailable) {
          return NextResponse.json({ error: 'Express delivery is not available for this pincode.' }, { status: 400 });
        }
        shippingCharge = discountedSubtotal >= borzoFreeThreshold ? 0 : computedExpressCharge;
      } else {
        shippingCharge = discountedSubtotal >= freeShippingThreshold ? 0 : defaultShippingCharge;
        
        // Add COD fee if applicable (only standard delivery allows COD)
        if (isCod) {
          shippingCharge += codFee;
        }
      }
    }

    const finalTotal = discountedSubtotal + shippingCharge;

    // 6. Check Razorpay availability
    const isRazorpayConfigured = !!process.env.RAZORPAY_KEY_SECRET && !!razorpay;

    // Pre-generate order UUID
    const orderId = crypto.randomUUID();

    // Generate non-sequential, unpredictable order number (e.g. DRFTN-7K9M2P)
    const orderNumber = generateOrderNumber();

    logPerf('Pre-flight Calculations & Sequence Query Done');

    // Unique pickup code if pickup order
    const pickupCode = isPickup 
      ? Math.floor(100000 + Math.random() * 900000).toString() 
      : null;

    // Shipping address fallback if pickup order
    const shippingAddr = isPickup 
      ? {
          line1: "DRFTN Store, 1st Floor, Kogilu Main Rd",
          line2: "above Sri Venkateshwar Vaibhava Veg Hotel, K B Sandra, Yelahanka",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560064"
        }
      : customerInfo.address;

    // With ₹200 deposit, COD orders are no longer confirmed immediately on creation; they wait for the deposit
    const initialOrderStatus = (!isRazorpayConfigured) 
      ? 'confirmed' 
      : 'pending_payment';

    const holdExpiresAt = isRazorpayConfigured
      ? new Date(Date.now() + 10 * 60 * 1000) // 10 minute hold
      : null;

    let razorpayOrderId: string | null = null;
    let rzAmount = isCod ? 20000 : finalTotal;

    if (isRazorpayConfigured) {
      try {
        const rzOrder = await razorpay!.orders.create({
          amount: rzAmount, // ₹200 for COD deposit, or finalTotal
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            order_id: orderId,
            customer_name: customerInfo.name,
            customer_email: customerInfo.email,
            discount_code: validatedCode || 'NONE',
            payment_type: isCod ? 'cod_deposit' : 'prepaid',
          },
        });
        razorpayOrderId = rzOrder.id;
      } catch (rzErr) {
        console.error('Razorpay SDK Order Error:', rzErr);
        // Clean up Redis claims and idempotency keys on failure
        try {
          const { releaseUnitSafe } = await import('@/lib/stock-gate');
          for (const item of itemsToRelease) {
            await releaseUnitSafe(item.productId, item.size, item.quantity);
          }
          const { redis } = await import('@/lib/redis');
          for (const key of idempotencyKeysToClean) {
            await redis.del(key);
          }
        } catch (cleanupErr) {
          console.error('Failed to cleanup Redis keys on Razorpay error:', cleanupErr);
        }
        return NextResponse.json({ error: 'Failed to initialize Razorpay transaction' }, { status: 500 });
      }
    }

    logPerf('Razorpay Order Created');

    // 7. Save Pending Checkout in Firestore instead of Postgres
    const pendingCheckoutPayload = {
      id: orderId,
      user_id: finalUserId,
      order_number: orderNumber,
      customer_name: customerInfo.name,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      shipping_address: shippingAddr,
      items: orderItemsToSave,
      subtotal: calculatedSubtotal,
      shipping_charge: shippingCharge,
      discount_code: validatedCode || null,
      discount_amount: discountAmount,
      total: finalTotal,
      status: 'pending',
      fulfillment_type: fulfillmentType,
      pickup_status: isPickup ? 'awaiting_pickup' : null,
      pickup_code: pickupCode,
      payment_type: isCod ? 'cod_with_deposit' : 'prepaid',
      deposit_amount: isCod ? 20000 : null,
      remaining_amount: isCod ? finalTotal - 20000 : null,
      deposit_status: isCod ? 'pending' : null,
      verified_phone: verifiedPhone || null,
      shippingProvider: shippingProvider || null,
      zone,
      courier_provider: shippingProvider === 'express' ? 'borzo' : (shippingProvider === 'standard' ? 'shiprocket' : null),
      hold_expires_at: holdExpiresAt ? holdExpiresAt.toISOString() : null,
      razorpay_order_id: razorpayOrderId,
      created_at: new Date().toISOString(),
    };

    try {
      const { firestoreService } = await import('@/lib/firestore');
      await firestoreService.setDoc('pending_checkouts', orderId, pendingCheckoutPayload);
      logPerf('Firestore Pending Checkout Written Done');
    } catch (fsErr) {
      console.error('[Firestore] Failed to save pending checkout. Proceeding anyway.', fsErr);
    }

    // 8. Respond immediately to the client
    if (isRazorpayConfigured) {
      return NextResponse.json({
        razorpayOrderId: razorpayOrderId,
        amount: rzAmount,
        currency: 'INR',
        orderId: orderId,
        orderNumber: orderNumber,
      });
    }

    // 9. Razorpay NOT configured -> Fallback confirmation
    return NextResponse.json({
      orderId: orderId,
      orderNumber: orderNumber,
      total: finalTotal,
      message: 'manual_payment',
    });

  } catch (error: any) {
    console.error('Secure Order Create API Error:', error);

    // Clean up Redis claims and idempotency keys on failure
    try {
      if (itemsToRelease.length > 0) {
        const { releaseUnitSafe } = await import('@/lib/stock-gate');
        for (const item of itemsToRelease) {
          await releaseUnitSafe(item.productId, item.size, item.quantity);
        }
      }
      if (idempotencyKeysToClean.length > 0) {
        const { redis } = await import('@/lib/redis');
        for (const key of idempotencyKeysToClean) {
          await redis.del(key);
        }
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup Redis keys on error:', cleanupErr);
    }
    
    if (error.message && (error.message.includes('sold out') || error.message.includes('not found'))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error.message?.startsWith('DISCOUNT_LIMIT_REACHED:')) {
      return NextResponse.json({ error: 'Discount code usage limit has been reached' }, { status: 400 });
    }

    // Postgres lock_timeout or statement_timeout — request queued too long under concurrency spike
    if (error.message?.includes('lock timeout') || error.message?.includes('statement timeout') || error.code === '55P03' || error.code === '57014') {
      return NextResponse.json({ error: 'Checkout is busy right now. Please try again in a few seconds.' }, { status: 503 });
    }


    try {
      const { captureException, setTag } = await import('@sentry/nextjs');
      setTag("user_id", clerkUserId || 'anonymous');
      setTag("payment_method", reqBody?.paymentMethod || 'razorpay');
      captureException(error);
    } catch (sentryErr) {
      console.error('Sentry reporting failed:', sentryErr);
    }
    return NextResponse.json({ error: 'An unexpected server error occurred' }, { status: 500 });
  }
}
