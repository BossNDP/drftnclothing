import { NextResponse } from 'next/server';
import { checkDeliveryEligibility } from '@/lib/shipping-eligibility';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get('pincode') || '';

    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return NextResponse.json({ error: 'Valid 6-digit pincode is required' }, { status: 400 });
    }

    const eligibility = await checkDeliveryEligibility(pincode);
    return NextResponse.json(eligibility);
  } catch (error) {
    console.error('[Serviceability API Error]:', error);
    return NextResponse.json({ error: 'Internal server error checking serviceability' }, { status: 500 });
  }
}
