import { writeAuditLog } from '../audit-service';

export interface BorzoCreateOrderPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
}

export interface ShippingProviderResult {
  provider: 'borzo' | 'shiprocket';
  shipmentId: string;
  awbCode: string;
  courierName: string;
  trackingUrl: string;
  labelUrl?: string;
  rawResponse: any;
}

const BORZO_API_URL = process.env.BORZO_API_URL || 'https://robot.borzodelivery.com/api/business/1.2';
const BORZO_AUTH_TOKEN = process.env.BORZO_AUTH_TOKEN || '';

export class BorzoAdapter {
  static isEligible(city?: string, pincode?: string, shippingProvider?: string): boolean {
    if (!city || !pincode) return false;
    const cleanCity = city.trim().toLowerCase();
    const isBangalore = cleanCity.includes('bangalore') || cleanCity.includes('bengaluru');
    const is560Pincode = pincode.trim().startsWith('560');
    const isExpress = shippingProvider === 'express';

    // Borzo daily order cutoff at 18:00 IST
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentHour = nowIST.getHours();
    const isBeforeCutoff = currentHour < 18;

    return isBangalore && is560Pincode && isExpress && isBeforeCutoff;
  }

  static async createOrder(payload: BorzoCreateOrderPayload): Promise<ShippingProviderResult> {
    if (process.env.DRY_RUN_SHIPPING === 'true') {
      console.log('[BorzoAdapter] DRY_RUN_SHIPPING=true active. Simulating dry-run Borzo order creation.', payload);
      const mockShipmentId = `DRY-BORZO-${payload.orderNumber}`;
      return {
        provider: 'borzo',
        shipmentId: mockShipmentId,
        awbCode: mockShipmentId,
        courierName: 'Borzo Express Same-Day (Dry Run)',
        trackingUrl: `https://borzodelivery.com/in/tracking?order=${mockShipmentId}`,
        labelUrl: `https://borzodelivery.com/in/label?order=${mockShipmentId}`,
        rawResponse: { status: 'dry_run_created', orderId: mockShipmentId, dryRun: true },
      };
    }

    if (!BORZO_AUTH_TOKEN) {
      console.warn('[BorzoAdapter] BORZO_AUTH_TOKEN missing, simulating mock Borzo order creation for development.');
      const mockShipmentId = `BORZO-${payload.orderNumber}`;
      return {
        provider: 'borzo',
        shipmentId: mockShipmentId,
        awbCode: mockShipmentId,
        courierName: 'Borzo Express Same-Day',
        trackingUrl: `https://borzodelivery.com/in/tracking?order=${mockShipmentId}`,
        labelUrl: `https://borzodelivery.com/in/label?order=${mockShipmentId}`,
        rawResponse: { status: 'mock_created', orderId: mockShipmentId },
      };
    }

    const requestBody = {
      matter: `DRFTN Apparel Order ${payload.orderNumber}`,
      points: [
        {
          address: 'DRFTN Store, 1st Floor, Kogilu Main Rd, Yelahanka, Bengaluru 560064',
          contact_person: { name: 'DRFTN Fulfillment', phone: '918045678900' },
        },
        {
          address: `${payload.shippingAddress.line1}, ${payload.shippingAddress.line2 || ''}, ${payload.shippingAddress.city} ${payload.shippingAddress.pincode}`,
          contact_person: { name: payload.customerName, phone: payload.customerPhone },
        },
      ],
    };

    const res = await fetch(`${BORZO_API_URL}/create-order`, {
      method: 'POST',
      headers: {
        'X-DV-Auth-Token': BORZO_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await res.json();
    if (!res.ok || data.is_closed || data.error) {
      throw new Error(`BORZO_API_ERROR: ${data.error?.message || JSON.stringify(data)}`);
    }

    const borzoOrderId = String(data.order?.order_id || data.order_id || payload.orderNumber);
    const trackingUrl = data.order?.tracking_url || `https://borzodelivery.com/in/tracking?order=${borzoOrderId}`;

    await writeAuditLog({
      orderId: payload.orderId,
      action: 'BORZO_ORDER_CREATED',
      details: { borzoOrderId, trackingUrl },
    });

    return {
      provider: 'borzo',
      shipmentId: borzoOrderId,
      awbCode: borzoOrderId,
      courierName: 'Borzo Express',
      trackingUrl,
      labelUrl: trackingUrl,
      rawResponse: data,
    };
  }
}
