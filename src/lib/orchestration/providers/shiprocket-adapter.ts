import { writeAuditLog } from '../audit-service';

export interface ShiprocketCreateOrderPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: Array<{ name: string; quantity: number; price: number; slug?: string }>;
  subtotal: number;
  total: number;
  paymentType: 'cod' | 'prepaid';
  remainingAmount: number; // in paise
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

const SHIPROCKET_API_URL = 'https://apiv2.shiprocket.in/v1/external';
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getShiprocketToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error('SHIPROCKET_CREDENTIALS_MISSING: SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD not configured');
  }

  const res = await fetch(`${SHIPROCKET_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`SHIPROCKET_AUTH_FAILED: ${data.message || JSON.stringify(data)}`);
  }

  // Token is valid for 10 days; cache for 9 days
  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000,
  };

  return data.token;
}

export function clearShiprocketTokenCache() {
  cachedToken = null;
}

export class ShiprocketAdapter {
  static async createOrder(payload: ShiprocketCreateOrderPayload): Promise<ShippingProviderResult> {
    if (process.env.DRY_RUN_SHIPPING === 'true') {
      console.log('[ShiprocketAdapter] DRY_RUN_SHIPPING=true active. Simulating dry-run shipment creation.', payload);
      const mockAwb = `DRY-AWB-${payload.orderNumber}`;
      return {
        provider: 'shiprocket',
        shipmentId: `DRY-SR-${payload.orderNumber}`,
        awbCode: mockAwb,
        courierName: 'Delhivery Surface (Dry Run)',
        trackingUrl: `https://shiprocket.co/tracking/${mockAwb}`,
        labelUrl: `https://shiprocket.co/label/${mockAwb}`,
        rawResponse: { status: 'dry_run_success', dryRun: true },
      };
    }

    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
      console.warn('[ShiprocketAdapter] Shiprocket credentials missing. Generating mock Shiprocket shipment for dev.');
      const mockAwb = `SR-AWB-${payload.orderNumber}`;
      return {
        provider: 'shiprocket',
        shipmentId: `SR-${payload.orderNumber}`,
        awbCode: mockAwb,
        courierName: 'Delhivery Surface',
        trackingUrl: `https://shiprocket.co/tracking/${mockAwb}`,
        labelUrl: `https://shiprocket.co/label/${mockAwb}`,
        rawResponse: { status: 'mock_shiprocket_created' },
      };
    }

    const token = await getShiprocketToken();
    const isCod = payload.paymentType === 'cod';

    // For COD: collect ONLY remainingAmount (in rupees)
    const collectibleAmountRupees = isCod
      ? Math.round(payload.remainingAmount / 100)
      : Math.round(payload.total / 100);

    const shiprocketPayload = {
      order_id: payload.orderNumber,
      order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
      billing_customer_name: payload.customerName,
      billing_last_name: '',
      billing_address: payload.shippingAddress.line1,
      billing_address_2: payload.shippingAddress.line2 || '',
      billing_city: payload.shippingAddress.city,
      billing_pincode: payload.shippingAddress.pincode,
      billing_state: payload.shippingAddress.state,
      billing_country: 'India',
      billing_email: payload.customerEmail,
      billing_phone: payload.customerPhone,
      shipping_is_billing: true,
      order_items: payload.items.map((i) => ({
        name: i.name,
        sku: i.slug || i.name,
        units: i.quantity,
        selling_price: Math.round(i.price / 100),
      })),
      payment_method: isCod ? 'COD' : 'Prepaid',
      sub_total: Math.round(payload.subtotal / 100),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    // 1. Create Order in Shiprocket
    const createRes = await fetch(`${SHIPROCKET_API_URL}/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shiprocketPayload),
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.order_id) {
      throw new Error(`SHIPROCKET_CREATE_ORDER_FAILED: ${createData.message || JSON.stringify(createData)}`);
    }

    const shiprocketOrderId = createData.order_id;
    const shipmentId = String(createData.shipment_id || shiprocketOrderId);

    // 2. Generate AWB
    let awbCode = '';
    let courierName = 'Standard Shipping';

    try {
      const awbRes = await fetch(`${SHIPROCKET_API_URL}/courier/assign/awb`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipment_id: shipmentId }),
      });
      const awbData = await awbRes.json();

      if (awbRes.ok && awbData.response?.data?.awb_code) {
        awbCode = awbData.response.data.awb_code;
        courierName = awbData.response.data.courier_name || courierName;
      }
    } catch (awbErr) {
      console.warn('[ShiprocketAdapter] AWB assignment deferred:', awbErr);
    }

    // 3. Generate Label
    let labelUrl = '';
    try {
      const labelRes = await fetch(`${SHIPROCKET_API_URL}/courier/generate/label`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });
      const labelData = await labelRes.json();
      if (labelRes.ok && labelData.label_url) {
        labelUrl = labelData.label_url;
      }
    } catch (lblErr) {
      console.warn('[ShiprocketAdapter] Label generation deferred:', lblErr);
    }

    // 4. Request Pickup
    try {
      await fetch(`${SHIPROCKET_API_URL}/orders/show/fulfillment/pickup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });
    } catch (pickupErr) {
      console.warn('[ShiprocketAdapter] Pickup scheduling deferred:', pickupErr);
    }

    const trackingUrl = awbCode
      ? `https://shiprocket.co/tracking/${awbCode}`
      : `https://shiprocket.co/tracking/${shiprocketOrderId}`;

    await writeAuditLog({
      orderId: payload.orderId,
      action: 'SHIPROCKET_ORDER_CREATED',
      details: { shiprocketOrderId, shipmentId, awbCode, courierName, collectibleAmountRupees },
    });

    return {
      provider: 'shiprocket',
      shipmentId: String(shipmentId),
      awbCode: awbCode || String(shipmentId),
      courierName,
      trackingUrl,
      labelUrl: labelUrl || undefined,
      rawResponse: createData,
    };
  }
}
