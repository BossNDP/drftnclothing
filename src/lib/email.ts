import { Resend } from 'resend';
import * as React from 'react';
import { OrderConfirmationEmail } from '@/components/OrderConfirmationEmail';
import { RefundConfirmationEmail } from '@/components/RefundConfirmationEmail';
import { PickupSuccessEmail } from '@/components/PickupSuccessEmail';
import { DeliverySuccessEmail } from '@/components/DeliverySuccessEmail';
import { DepositConfirmationEmail } from '@/components/DepositConfirmationEmail';
import { PaymentPendingReminderEmail } from '@/components/PaymentPendingReminderEmail';
import { DeliveryStatusEmail } from '@/components/DeliveryStatusEmail';
import { WishlistReminderEmail, WishlistEmailItem } from '@/components/WishlistReminderEmail';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_for_build');

// The verified "from" address must match a domain you've added in Resend.
// e.g. RESEND_FROM_EMAIL="DRFTN <orders@drftnclothing.in>"
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'DRFTN <onboarding@resend.dev>';
const REPLY_TO_EMAIL = 'drftnclothing@gmail.com';
const ADMIN_CC_EMAIL = 'drftnclothing@gmail.com';

/**
 * Sends a refund notification email to the customer by rendering a React component to static HTML.
 */
export async function sendRefundEmail({
  orderNumber,
  customerName,
  customerEmail,
  productName,
  refundAmountPaise,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null | undefined;
  productName: string;
  refundAmountPaise: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping refund email.');
    return;
  }

  if (!customerEmail) {
    console.warn(`[Email] No customer email on order ${orderNumber} — skipping refund email.`);
    return;
  }

  try {
    // Dynamic import to bypass Next.js static build checks for react-dom/server in route handlers
    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(RefundConfirmationEmail, {
        orderNumber,
        customerName,
        productName,
        refundAmountPaise,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      cc: [ADMIN_CC_EMAIL],
      replyTo: REPLY_TO_EMAIL,
      subject: `Refund Issued – Order ${orderNumber} | DRFTN`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for refund email on order ${orderNumber}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message} (Code: ${(error as any).code || 'N/A'})`);
    } else {
      console.log(`[Email] Refund email sent successfully for order ${orderNumber} to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send refund email for order ${orderNumber}:`, err);
    throw err;
  }
}

/**
 * Sends an order confirmation email to the customer by rendering a React component to static HTML.
 */
export async function sendOrderSuccessEmail({
  orderNumber,
  customerName,
  customerEmail,
  items,
  totalPaise,
  shippingChargePaise,
  discountAmountPaise,
  fulfillmentType,
  pickupCode,
  shippingAddress,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null | undefined;
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  totalPaise: number;
  shippingChargePaise: number;
  discountAmountPaise: number;
  fulfillmentType: string;
  pickupCode: string | null;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping order success email.');
    return;
  }

  if (!customerEmail) {
    console.warn(`[Email] No customer email on order ${orderNumber} — skipping order success email.`);
    return;
  }

  try {
    const lockKey = `email:confirmed:${orderNumber}`;
    const { redis } = await import('@/lib/redis');
    const alreadySent = await redis.get(lockKey);
    if (alreadySent) {
      console.log(`[Email] Order success email already sent for order ${orderNumber} - skipping.`);
      return;
    }

    // Dynamic import to bypass Next.js static build checks for react-dom/server in route handlers
    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(OrderConfirmationEmail, {
        orderNumber,
        customerName,
        items,
        totalPaise,
        shippingChargePaise,
        discountAmountPaise,
        fulfillmentType,
        pickupCode,
        shippingAddress,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      cc: [ADMIN_CC_EMAIL],
      replyTo: REPLY_TO_EMAIL,
      subject: `Order Confirmed – Order ${orderNumber} | DRFTN`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for success email on order ${orderNumber}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message} (Code: ${(error as any).code || 'N/A'})`);
    } else {
      await redis.set(lockKey, 'true');
      console.log(`[Email] Order success email sent successfully for order ${orderNumber} to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send order success email for order ${orderNumber}:`, err);
    throw err;
  }
}

/**
 * Sends a pickup success notification email to the customer.
 */
export async function sendPickupSuccessEmail({
  orderNumber,
  customerName,
  customerEmail,
  items,
  totalPaise,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null | undefined;
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  totalPaise: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping pickup success email.');
    return;
  }

  if (!customerEmail) {
    console.warn(`[Email] No customer email on order ${orderNumber} — skipping pickup success email.`);
    return;
  }

  try {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(PickupSuccessEmail, {
        orderNumber,
        customerName,
        items,
        totalPaise,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      cc: [ADMIN_CC_EMAIL],
      replyTo: REPLY_TO_EMAIL,
      subject: `Collected: Order ${orderNumber} | DRFTN`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for pickup success email on order ${orderNumber}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message}`);
    } else {
      console.log(`[Email] Pickup success email sent successfully for order ${orderNumber} to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send pickup success email for order ${orderNumber}:`, err);
    throw err;
  }
}

/**
 * Sends a delivery success notification email to the customer.
 */
export async function sendDeliverySuccessEmail({
  orderNumber,
  customerName,
  customerEmail,
  items,
  totalPaise,
  courierPartner,
  trackingNumber,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null | undefined;
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  totalPaise: number;
  courierPartner?: string | null;
  trackingNumber?: string | null;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping delivery success email.');
    return;
  }

  if (!customerEmail) {
    console.warn(`[Email] No customer email on order ${orderNumber} — skipping delivery success email.`);
    return;
  }

  try {
    const lockKey = `email:delivery:${orderNumber}:delivered`;
    const { redis } = await import('@/lib/redis');
    const alreadySent = await redis.get(lockKey);
    if (alreadySent) {
      console.log(`[Email] Delivery success email already sent for order ${orderNumber} - skipping.`);
      return;
    }

    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(DeliverySuccessEmail, {
        orderNumber,
        customerName,
        items,
        totalPaise,
        courierPartner,
        trackingNumber,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      cc: [ADMIN_CC_EMAIL],
      replyTo: REPLY_TO_EMAIL,
      subject: `Delivered: Order ${orderNumber} | DRFTN`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for delivery success email on order ${orderNumber}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message}`);
    } else {
      await redis.set(lockKey, 'true');
      console.log(`[Email] Delivery success email sent successfully for order ${orderNumber} to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send delivery success email for order ${orderNumber}:`, err);
    throw err;
  }
}

/**
 * Sends a COD deposit receipt & order confirmation email to the customer.
 */
export async function sendDepositConfirmationEmail({
  orderNumber,
  customerName,
  customerEmail,
  items,
  totalPaise,
  shippingChargePaise,
  discountAmountPaise,
  fulfillmentType,
  pickupCode,
  shippingAddress,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null | undefined;
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  totalPaise: number;
  shippingChargePaise: number;
  discountAmountPaise: number;
  fulfillmentType: string;
  pickupCode: string | null;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping deposit success email.');
    return;
  }

  if (!customerEmail) {
    console.warn(`[Email] No customer email on order ${orderNumber} — skipping deposit success email.`);
    return;
  }

  try {
    const lockKey = `email:confirmed:${orderNumber}`;
    const { redis } = await import('@/lib/redis');
    const alreadySent = await redis.get(lockKey);
    if (alreadySent) {
      console.log(`[Email] Deposit success email already sent for order ${orderNumber} - skipping.`);
      return;
    }

    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(DepositConfirmationEmail, {
        orderNumber,
        customerName,
        items,
        totalPaise,
        shippingChargePaise,
        discountAmountPaise,
        fulfillmentType,
        pickupCode,
        shippingAddress,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      cc: [ADMIN_CC_EMAIL],
      replyTo: REPLY_TO_EMAIL,
      subject: `COD Order Confirmed – Order ${orderNumber} | DRFTN`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for deposit success email on order ${orderNumber}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message}`);
    } else {
      await redis.set(lockKey, 'true');
      console.log(`[Email] Deposit success email sent successfully for order ${orderNumber} to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send deposit success email for order ${orderNumber}:`, err);
    throw err;
  }
}

/**
 * Sends an incomplete prepaid order payment pending reminder email.
 */
export async function sendPaymentPendingReminderEmail({
  orderNumber,
  customerName,
  customerEmail,
  items,
  totalPaise,
  minutesRemaining,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null | undefined;
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  totalPaise: number;
  minutesRemaining: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping payment reminder email.');
    return;
  }

  if (!customerEmail) {
    console.warn(`[Email] No customer email on order ${orderNumber} — skipping payment reminder email.`);
    return;
  }

  try {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(PaymentPendingReminderEmail, {
        orderNumber,
        customerName,
        items,
        totalPaise,
        minutesRemaining,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      replyTo: REPLY_TO_EMAIL,
      subject: `Action Required: Complete your order ${orderNumber} | DRFTN`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for payment reminder email on order ${orderNumber}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message}`);
    } else {
      console.log(`[Email] Payment reminder email sent successfully for order ${orderNumber} to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send payment reminder email for order ${orderNumber}:`, err);
    throw err;
  }
}

/**
 * Sends an abandoned cart recovery email.
 */
export async function sendAbandonedCartEmail({
  customerName,
  customerEmail,
  items,
  totalPaise,
  orderNumber,
}: {
  customerName: string;
  customerEmail: string | null | undefined;
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  totalPaise: number;
  orderNumber: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not set — cannot send abandoned cart email');
  }

  if (!customerEmail) {
    throw new Error(`No customer email specified for abandoned cart email`);
  }

  try {
    const itemsHtml = items.map(item => `
      <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #eaeaea;">
        <p style="margin: 0; font-weight: bold;">${item.name} (${item.size})</p>
        <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Qty: ${item.quantity} | ₹${(item.price / 100).toFixed(2)}</p>
      </div>
    `).join('');

    const htmlString = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid black; padding-bottom: 10px;">Did you leave something behind?</h2>
        <p>Hey ${customerName},</p>
        <p>We noticed you left items in your cart. Your temporary reservation has expired, but you can still grab them before they sell out completely!</p>
        
        <div style="margin: 20px 0;">
          ${itemsHtml}
        </div>

        <p style="font-weight: bold; font-size: 18px;">Total: ₹${(totalPaise / 100).toFixed(2)}</p>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://drftn.in'}/checkout" style="background-color: black; color: white; padding: 15px 30px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em;">Complete Your Purchase</a>
        </div>

        <p style="color: #888; font-size: 12px; margin-top: 40px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          This is an automated shopping cart reminder from DRFTN. Order Ref: ${orderNumber}
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      replyTo: REPLY_TO_EMAIL,
      subject: `Complete your purchase at DRFTN | Order Ref: ${orderNumber}`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for abandoned cart email:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message}`);
    } else {
      console.log(`[Email] Abandoned cart email sent successfully to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send abandoned cart email:`, err);
    throw err;
  }
}

/**
 * Sends a delivery fallback/refund alert to the admin email.
 */
export async function sendAdminFallbackAlertEmail({
  orderNumber,
  customerName,
  deliveryProvider,
  failureReason,
  refundStatus,
  refundAmountPaise,
}: {
  orderNumber: string;
  customerName: string;
  deliveryProvider: string;
  failureReason: string;
  refundStatus: string;
  refundAmountPaise: number;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'nagarjundp12@gmail.com';
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping admin fallback alert email.');
    return;
  }

  try {
    const htmlString = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #e63329; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #e63329; padding-bottom: 10px;">⚠️ Delivery Fallback & Refund Alert</h2>
        <p>An automated delivery downgrade occurred because the express logistics partner failed.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold; width: 180px;">Order Number:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea;">\${orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">Customer:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea;">\${customerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">Failed Provider:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea;">\${deliveryProvider}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">Failure Reason:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; color: #e63329;">\${failureReason}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">Action Taken:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold; color: #22c55e;">Downgraded to Standard Shiprocket</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">Refund Amount:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">₹\${(refundAmountPaise / 100).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">Refund Status:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eaeaea; font-weight: bold;">\${refundStatus}</td>
          </tr>
        </table>

        <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          This is an automated operational alert from the DRFTN Checkout Engine.
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [adminEmail],
      replyTo: REPLY_TO_EMAIL,
      subject: `[ALERT] Express Downgrade & Refund – Order \${orderNumber}`,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for admin alert:`, error);
    } else {
      console.log(`[Email] Admin fallback alert email sent successfully to ${adminEmail}`);
    }
  } catch (err) {
    console.error(`[Email] Failed to send admin alert email:`, err);
  }
}

/**
 * Sends a dynamic delivery status update email to the customer with an Upstash Redis idempotency check.
 */
export async function sendDeliveryStatusEmail({
  orderNumber,
  customerName,
  customerEmail,
  status,
  items,
  totalPaise,
  courierPartner,
  trackingNumber,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail: string | null | undefined;
  status: 'shipped' | 'out_for_delivery' | 'cancelled';
  items: Array<{ name: string; size: string; quantity: number; price: number }>;
  totalPaise: number;
  courierPartner?: string | null;
  trackingNumber?: string | null;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[Email] RESEND_API_KEY not set — skipping delivery status email for ${status}.`);
    return;
  }

  if (!customerEmail) {
    console.warn(`[Email] No customer email on order ${orderNumber} — skipping delivery status email for ${status}.`);
    return;
  }

  try {
    const lockKey = `email:delivery:${orderNumber}:${status}`;
    const { redis } = await import('@/lib/redis');
    const alreadySent = await redis.get(lockKey);
    if (alreadySent) {
      console.log(`[Email] Delivery status email for ${status} already sent for order ${orderNumber} - skipping.`);
      return;
    }

    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(DeliveryStatusEmail, {
        orderNumber,
        customerName,
        status,
        items,
        totalPaise,
        courierPartner,
        trackingNumber,
      })
    );

    let subject = `Order Update – Order ${orderNumber} | DRFTN`;
    if (status === 'shipped') {
      subject = `Your order has shipped! – Order ${orderNumber} | DRFTN`;
    } else if (status === 'out_for_delivery') {
      subject = `Out for delivery ⚡ – Order ${orderNumber} | DRFTN`;
    } else if (status === 'cancelled') {
      subject = `Cancelled: Order ${orderNumber} | DRFTN`;
    }

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      cc: [ADMIN_CC_EMAIL],
      replyTo: REPLY_TO_EMAIL,
      subject,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for delivery status email (${status}) on order ${orderNumber}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message}`);
    } else {
      await redis.set(lockKey, 'true');
      console.log(`[Email] Delivery status email (${status}) sent successfully for order ${orderNumber} to ${customerEmail}`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send delivery status email (${status}) for order ${orderNumber}:`, err);
    throw err;
  }
}

/**
 * Sends a consolidated Wishlist Reminder email to the customer using Resend.
 */
export async function sendWishlistReminderEmail({
  customerEmail,
  customerName = 'Valued Customer',
  items,
}: {
  customerEmail: string;
  customerName?: string;
  items: WishlistEmailItem[];
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping wishlist reminder email.');
    return;
  }

  if (!customerEmail || items.length === 0) {
    console.warn('[Email] Invalid email or empty wishlist items — skipping wishlist reminder email.');
    return;
  }

  try {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const htmlString = renderToStaticMarkup(
      React.createElement(WishlistReminderEmail, {
        customerName,
        items,
        siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://drftnclothing.in',
      })
    );

    const isMulti = items.length > 1;
    const firstItemName = items[0].name;
    const subject = isMulti
      ? `Still thinking about it? ${items.length} items waiting in your Wishlist | DRFTN`
      : `Still thinking about it? Your ${firstItemName} is waiting | DRFTN`;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [customerEmail],
      replyTo: REPLY_TO_EMAIL,
      subject,
      html: htmlString,
    });

    if (error) {
      console.error(`[Email] Resend error for wishlist reminder email to ${customerEmail}:`, error);
      throw new Error(`Resend API Error: ${error.name} - ${error.message}`);
    } else {
      console.log(`[Email] Wishlist reminder email sent successfully to ${customerEmail} for ${items.length} items.`);
    }
  } catch (err: any) {
    console.error(`[Email] Failed to send wishlist reminder email to ${customerEmail}:`, err);
    throw err;
  }
}
