import { BorzoAdapter } from './borzo-adapter';
import { ShiprocketAdapter, ShippingProviderResult } from './shiprocket-adapter';
import { writeAuditLog } from '../audit-service';

export interface DispatchShipmentInput {
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
  remainingAmount: number;
  shippingProviderPreference?: string | null;
}

export class ShippingRouter {
  static async dispatchShipment(input: DispatchShipmentInput): Promise<ShippingProviderResult> {
    const { shippingAddress, shippingProviderPreference, orderId, orderNumber } = input;
    const isBorzoEligible = BorzoAdapter.isEligible(
      shippingAddress?.city,
      shippingAddress?.pincode,
      shippingProviderPreference || undefined
    );

    if (isBorzoEligible) {
      try {
        console.log(`[ShippingRouter] Attempting Borzo dispatch for order ${orderNumber}...`);
        const borzoResult = await BorzoAdapter.createOrder({
          orderId,
          orderNumber,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          shippingAddress: input.shippingAddress,
          items: input.items,
          total: input.total,
        });

        await writeAuditLog({
          orderId,
          action: 'SHIPPING_ROUTER:DISPATCH_BORZO_SUCCESS',
          details: { shipmentId: borzoResult.shipmentId },
        });

        return borzoResult;
      } catch (borzoErr: any) {
        console.warn(
          `[ShippingRouter] Borzo dispatch failed for order ${orderNumber}. Automatically failing over to Shiprocket:`,
          borzoErr?.message || borzoErr
        );

        await writeAuditLog({
          orderId,
          action: 'SHIPPING_ROUTER:BORZO_FAILOVER_TO_SHIPROCKET',
          details: { error: borzoErr?.message || String(borzoErr) },
        });
      }
    }

    // Default or Failover: Shiprocket
    console.log(`[ShippingRouter] Dispatching order ${orderNumber} via Shiprocket...`);
    const shiprocketResult = await ShiprocketAdapter.createOrder({
      orderId,
      orderNumber,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      shippingAddress: input.shippingAddress,
      items: input.items,
      subtotal: input.subtotal,
      total: input.total,
      paymentType: input.paymentType,
      remainingAmount: input.remainingAmount,
    });

    await writeAuditLog({
      orderId,
      action: 'SHIPPING_ROUTER:DISPATCH_SHIPROCKET_SUCCESS',
      details: { shipmentId: shiprocketResult.shipmentId, awbCode: shiprocketResult.awbCode },
    });

    return shiprocketResult;
  }
}
