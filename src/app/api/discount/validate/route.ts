import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, or, ne } from 'drizzle-orm';
import { discountValidateSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validationResult = discountValidateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid validation payload' }, { status: 400 });
    }

    const { code, subtotal, email, phone } = validationResult.data;
    const cleanCode = code.toUpperCase().trim();

    // Check if Drift Mode coupon (DRIFTMODEON30, DRIFT-*)
    const isDriftCode = cleanCode === 'DRIFTMODEON30' || cleanCode.startsWith('DRIFT-') || cleanCode.startsWith('DRIFT');

    if (isDriftCode) {
      const [settings] = await db
        .select()
        .from(schema.driftModeSettings)
        .where(eq(schema.driftModeSettings.id, 1))
        .limit(1);

      if (!settings || !settings.is_active) {
        return NextResponse.json({ valid: false, message: 'Drift Mode is currently inactive.' });
      }

      // Check if email/phone already redeemed a first-order discount
      if (email || phone) {
        const conditions = [];
        if (email) conditions.push(eq(schema.orders.customer_email, email.toLowerCase().trim()));
        if (phone) conditions.push(eq(schema.orders.customer_phone, phone.trim()));

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
            return NextResponse.json({
              valid: false,
              message: 'This first-order Drift Mode discount has already been used on a previous order.',
            });
          }
        }
      }

      return NextResponse.json({
        valid: true,
        discount_type: 'percent',
        discount_value: settings.discount_percent || 30,
        max_discount_amount: null,
        message: `DRIFT MODE — ${settings.discount_percent || 30}% OFF APPLIED`,
      });
    }

    const [discount] = await db
      .select()
      .from(schema.discountCodes)
      .where(and(
        eq(schema.discountCodes.code, cleanCode),
        eq(schema.discountCodes.is_active, true)
      ))
      .limit(1);

    if (!discount) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid discount code',
      });
    }

    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
      return NextResponse.json({
        valid: false,
        message: 'This coupon code has expired',
      });
    }

    if (discount.usage_limit !== null && discount.used_count >= discount.usage_limit) {
      return NextResponse.json({
        valid: false,
        message: 'This coupon code usage limit has been reached',
      });
    }

    const [signupSetting] = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'signup_discount_code'))
      .limit(1);
    
    const signupCode = (signupSetting?.value || 'DRFTN10').toUpperCase().trim();
    const isFirstOrderCode = cleanCode === signupCode || cleanCode.includes('WELCOME') || cleanCode.includes('FIRST');

    if (isFirstOrderCode && (email || phone)) {
      const conditions = [];
      if (email) conditions.push(eq(schema.orders.customer_email, email.toLowerCase().trim()));
      if (phone) conditions.push(eq(schema.orders.customer_phone, phone.trim()));

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
          return NextResponse.json({
            valid: false,
            message: 'This welcome discount code is valid for first-time orders only.',
          });
        }
      }
    }

    const minOrderVal = Number(discount.min_order_value || 0);
    if (subtotal < minOrderVal) {
      return NextResponse.json({
        valid: false,
        message: `This coupon requires a minimum order of ₹${(minOrderVal / 100).toFixed(0)}`,
      });
    }

    return NextResponse.json({
      valid: true,
      discount_type: discount.discount_type,
      discount_value: Number(discount.discount_value),
      max_discount_amount: discount.max_discount_amount ? Number(discount.max_discount_amount) : null,
      message: 'Discount code applied successfully!',
    });

  } catch (error) {
    console.error('Discount validation API error:', error);
    return NextResponse.json({ error: 'An unexpected validation server error occurred' }, { status: 500 });
  }
}
