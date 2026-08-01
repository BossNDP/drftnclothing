import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbSettings = await db.select().from(schema.settings);
    let freeShippingThreshold = 99900; // default ₹999 in paise
    let defaultShippingCharge = 9900;  // default ₹99 in paise
    let codFee = 5000;                  // default ₹50 in paise
    let blrPincodeRanges = '560001-560300';
    let borzoSurcharge = 15000;         // default ₹150 in paise
    let borzoFreeThreshold = 149900;    // default ₹1499 in paise
    let borzoCutoffStart = '11:00';
    let borzoCutoffEnd = '16:00';
    let borzoPickupAddress = '';

    dbSettings.forEach((row: any) => {
      if (row.key === 'free_shipping_threshold') freeShippingThreshold = Number(row.value);
      if (row.key === 'default_shipping_charge') defaultShippingCharge = Number(row.value);
      if (row.key === 'cod_fee') codFee = Number(row.value);
      if (row.key === 'blr_pincode_ranges') blrPincodeRanges = row.value;
      if (row.key === 'borzo_surcharge') borzoSurcharge = Number(row.value);
      if (row.key === 'borzo_free_threshold') borzoFreeThreshold = Number(row.value);
      if (row.key === 'borzo_cutoff_start') borzoCutoffStart = row.value;
      if (row.key === 'borzo_cutoff_end') borzoCutoffEnd = row.value;
      if (row.key === 'borzo_pickup_address') borzoPickupAddress = row.value;
    });

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    const hasSecret = !!process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_SECRET.includes('placeholder');
    const razorpayActive = !!razorpayKeyId && !razorpayKeyId.includes('placeholder') && hasSecret;

    return NextResponse.json({
      razorpayActive,
      razorpayKeyId: razorpayActive ? razorpayKeyId : '',
      freeShippingThreshold: 0, // Free Shipping Sale (₹0)
      defaultShippingCharge: 0, // Free Shipping Sale (₹0)
      codFee: 0,                // Free Shipping Sale (₹0)
      whatsappNumber: '+917406164512',
      blrPincodeRanges,
      borzoSurcharge,
      borzoFreeThreshold,
      borzoCutoffStart,
      borzoCutoffEnd,
      borzoPickupAddress,
    });
  } catch (error) {
    console.error('Config fetch API error:', error);
    return NextResponse.json({ error: 'Failed to fetch public store config' }, { status: 500 });
  }
}
