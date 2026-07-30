import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  store_name: 'DRFTN CLOTHING',
  contact_number: '+91 7406164512',
  instagram_handle: '@drftnclothing',
  free_shipping_threshold: 99900, // paise (₹999)
  default_shipping_charge: 9900,  // paise (₹99)
  razorpay_key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholderkey',
  razorpay_key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
  nimbuspost_api_key: process.env.SHIPROCKET_EMAIL || 'shiprocket_placeholder',
  blr_pincode_ranges: '560001-560300',
  borzo_surcharge: 15000, // ₹150 in paise
  borzo_free_threshold: 149900, // ₹1499 in paise
  borzo_cutoff_start: '11:00',
  borzo_cutoff_end: '16:00',
  borzo_pickup_address: 'DRFTN Store, 1st Floor, Kogilu Main Rd, above Sri Venkateshwar Vaibhava Veg Hotel, K B Sandra, Yelahanka, Bengaluru, Karnataka, 560064',
  maintenance_mode: 'false',
};

function getEnvStatus() {
  const rpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const rpSec = process.env.RAZORPAY_KEY_SECRET;
  const srEmail = process.env.SHIPROCKET_EMAIL;
  const srPass = process.env.SHIPROCKET_PASSWORD;
  const makeWh = process.env.MAKE_WEBHOOK_URL;

  return {
    razorpay: !!(rpKey && !rpKey.includes('placeholder') && rpSec && !rpSec.includes('placeholder')),
    shiprocket: !!(srEmail && !srEmail.includes('placeholder') && srPass && !srPass.includes('placeholder')),
    makeWebhook: !!(makeWh && !makeWh.includes('placeholder') && makeWh.startsWith('http')),
  };
}

export async function GET() {
  try {
    const rows = await db.select().from(schema.settings);
    const settingsObj: Record<string, any> = { ...DEFAULT_SETTINGS };

    rows.forEach((row: any) => {
      if (row.key === 'free_shipping_threshold') {
        settingsObj.free_shipping_threshold = Number(row.value);
      } else if (row.key === 'default_shipping_charge') {
        settingsObj.default_shipping_charge = Number(row.value);
      } else if (row.key === 'store_whatsapp') {
        settingsObj.contact_number = row.value;
      } else if (row.key === 'blr_pincode_ranges') {
        settingsObj.blr_pincode_ranges = row.value;
      } else if (row.key === 'borzo_surcharge') {
        settingsObj.borzo_surcharge = Number(row.value);
      } else if (row.key === 'borzo_free_threshold') {
        settingsObj.borzo_free_threshold = Number(row.value);
      } else if (row.key === 'borzo_cutoff_start') {
        settingsObj.borzo_cutoff_start = row.value;
      } else if (row.key === 'borzo_cutoff_end') {
        settingsObj.borzo_cutoff_end = row.value;
      } else if (row.key === 'borzo_pickup_address') {
        settingsObj.borzo_pickup_address = row.value;
      } else if (row.key === 'maintenance_mode') {
        settingsObj.maintenance_mode = row.value;
      }
    });

    return NextResponse.json({
      settings: settingsObj,
      envStatus: getEnvStatus(),
    });
  } catch (error) {
    console.error('Admin settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch store settings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const promises = Object.entries(body).map(async ([key, value]) => {
      let dbKey = key;
      if (key === 'contact_number') dbKey = 'store_whatsapp';

      return db
        .insert(schema.settings)
        .values({ key: dbKey, value: String(value), updated_at: new Date() })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: String(value), updated_at: new Date() },
        });
    });

    await Promise.all(promises);

    // Re-fetch settings
    const rows = await db.select().from(schema.settings);
    const settingsObj: Record<string, any> = { ...DEFAULT_SETTINGS };

    rows.forEach((row: any) => {
      if (row.key === 'free_shipping_threshold') {
        settingsObj.free_shipping_threshold = Number(row.value);
      } else if (row.key === 'default_shipping_charge') {
        settingsObj.default_shipping_charge = Number(row.value);
      } else if (row.key === 'store_whatsapp') {
        settingsObj.contact_number = row.value;
      } else if (row.key === 'blr_pincode_ranges') {
        settingsObj.blr_pincode_ranges = row.value;
      } else if (row.key === 'borzo_surcharge') {
        settingsObj.borzo_surcharge = Number(row.value);
      } else if (row.key === 'borzo_free_threshold') {
        settingsObj.borzo_free_threshold = Number(row.value);
      } else if (row.key === 'borzo_cutoff_start') {
        settingsObj.borzo_cutoff_start = row.value;
      } else if (row.key === 'borzo_cutoff_end') {
        settingsObj.borzo_cutoff_end = row.value;
      } else if (row.key === 'borzo_pickup_address') {
        settingsObj.borzo_pickup_address = row.value;
      } else if (row.key === 'maintenance_mode') {
        settingsObj.maintenance_mode = row.value;
      }
    });

    return NextResponse.json({
      success: true,
      settings: settingsObj,
      envStatus: getEnvStatus(),
    });
  } catch (error) {
    console.error('Admin settings PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update store settings' }, { status: 500 });
  }
}
