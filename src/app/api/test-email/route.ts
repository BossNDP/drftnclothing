import { NextResponse } from 'next/server';
import { sendOrderSuccessEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const toEmail = url.searchParams.get('to') || 'drftnclothing@gmail.com';

    console.log(`[Test Email] Initiating test email send to: ${toEmail}`);
    
    // Create a mock order success email send
    await sendOrderSuccessEmail({
      orderNumber: 'DRFTN-TEST-9999',
      customerName: 'Test Customer',
      customerEmail: toEmail,
      items: [
        { name: 'Test Product Tee', size: 'L', quantity: 1, price: 199900 }
      ],
      totalPaise: 199900,
      shippingChargePaise: 0,
      discountAmountPaise: 0,
      fulfillmentType: 'pickup',
      pickupCode: '123456',
      shippingAddress: null,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent command initiated. Check server console or Vercel function logs for any errors. Sent to ${toEmail}.`,
      config: {
        from: process.env.RESEND_FROM_EMAIL || 'DRFTN <onboarding@resend.dev>',
        hasApiKey: !!process.env.RESEND_API_KEY,
        apiKeyPrefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.slice(0, 7) + '...' : 'none',
      }
    });
  } catch (error: any) {
    console.error('[Test Email Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred',
      stack: error.stack
    }, { status: 500 });
  }
}
