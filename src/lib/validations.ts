import { z } from 'zod';

// Sizes allowed in the system
export const SizeEnum = z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']);

// Product ID pattern (enforces valid UUID to prevent DB casting crashes)
export const ProductIdSchema = z.string().uuid('Invalid product ID format');

// POST /api/orders/create Schema
export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: ProductIdSchema,
    size: SizeEnum,
    quantity: z.number().int().min(1).max(10)
  })).min(1).max(20),
  discountCode: z.string().optional(),
  fulfillmentType: z.enum(['delivery', 'pickup']).default('delivery'),
  paymentMethod: z.enum(['razorpay', 'cod']).default('razorpay'),
  shippingProvider: z.enum(['standard', 'express']).optional(),
  verifiedPhone: z.string().optional().nullable(),
  verifiedPhoneToken: z.string().optional().nullable(),
  customerInfo: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email(),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
    address: z.object({
      line1: z.string().trim().max(200).optional().nullable(),
      line2: z.string().trim().optional().nullable(),
      city: z.string().trim().max(100).optional().nullable(),
      state: z.string().trim().max(100).optional().nullable(),
      pincode: z.string().trim().optional().nullable(),
    }).optional().nullable()
  })
}).superRefine((data, ctx) => {
  if (data.fulfillmentType === 'delivery') {
    const addr = data.customerInfo.address;
    if (!addr) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customerInfo', 'address'], message: 'Shipping address is required for home delivery' });
      return;
    }
    if (!addr.line1 || addr.line1.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customerInfo', 'address', 'line1'], message: 'Address line 1 is required' });
    }
    if (!addr.city || addr.city.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customerInfo', 'address', 'city'], message: 'City is required' });
    }
    if (!addr.state || addr.state.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customerInfo', 'address', 'state'], message: 'State is required' });
    }
    if (!addr.pincode || !/^\d{6}$/.test(addr.pincode)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customerInfo', 'address', 'pincode'], message: 'Must be a 6-digit Indian PIN code' });
    }
  }

  if (data.paymentMethod === 'cod') {
    if (!data.verifiedPhone || !/^[6-9]\d{9}$/.test(data.verifiedPhone.replace('+91', '').trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['verifiedPhone'], message: 'Verified phone number is required for Cash on Delivery orders' });
    }
    if (!data.verifiedPhoneToken || data.verifiedPhoneToken.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['verifiedPhoneToken'], message: 'Phone verification token is required for Cash on Delivery orders' });
    }
  }
});

// POST /api/orders/verify-payment Schema
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1)
});

// GET /api/orders/track Schema
export const trackOrderSchema = z.object({
  orderNumber: z.string().min(1),
  phone: z.string().min(4) // support partial/full phone matches safely
});

// POST /api/stock/check Schema
export const stockCheckSchema = z.object({
  productId: ProductIdSchema,
  size: SizeEnum
});

// POST /api/discount/validate Schema
export const discountValidateSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().nonnegative()
});

// POST /api/shipping/calculate Schema
export const shippingCalculateSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Must be a 6-digit Indian PIN code'),
  subtotal: z.number().nonnegative()
});

// GET /api/shipping/track-shipment Schema
export const trackShipmentSchema = z.object({
  awb: z.string().min(1)
});

// Product Variant Schema
export const productVariantSchema = z.object({
  id: z.string().optional(),
  colour_name: z.string().min(1, 'Colour name is required'),
  colour_hex: z.string().optional().nullable(),
  images: z.array(z.string().min(1)).min(1, 'At least one image is required per variant'),
  sizes: z.array(SizeEnum).min(1),
  stock_quantity: z.record(SizeEnum, z.number().int().nonnegative()),
  sku: z.string().min(1, 'SKU is required'),
  price_override: z.number().nonnegative().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

// Admin Product Create/Update Schema
export const adminProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  slug: z.string().min(2).max(150).transform((val) => val.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be greater than 0'),
  base_price: z.number().positive().optional(),
  compare_price: z.number().nonnegative().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional().nullable(),
  gender: z.string().min(1, 'Gender is required'),
  images: z.array(z.string().min(1)).default([]),
  sizes: z.array(SizeEnum).default(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  stock_quantity: z.record(SizeEnum, z.number().int().nonnegative()).default({ XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 }),
  is_featured: z.boolean().default(false),
  paired_with: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
  weight_grams: z.number().int().min(1, 'Product weight is required and must be at least 1g'),
  length_cm: z.number().int().min(1).optional().nullable(),
  breadth_cm: z.number().int().min(1).optional().nullable(),
  height_cm: z.number().int().min(1).optional().nullable(),
  variants: z.array(productVariantSchema).optional(),
});

// Admin Order Status Update Schema
export const adminUpdateStatusSchema = z.object({
  status: z.enum([
    'placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled',
    'pending_payment', 'payment_verifying', 'failed', 'expired',
    'preparing', 'ready_for_pickup', 'collected', 'payment_mismatch'
  ])
});

// Admin Push Announcement Schema
export const adminPushAnnouncementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(80, 'Title must be under 80 characters'),
  body: z.string().trim().min(1, 'Body is required').max(200, 'Body must be under 200 characters'),
  url: z.string().trim().max(500).optional().nullable(),
  productId: z.string().uuid('Invalid product ID').optional().nullable(),
});
