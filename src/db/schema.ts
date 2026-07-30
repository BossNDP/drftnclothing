import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, pgEnum, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 0. Order Status Enum
export const orderStatusEnum = pgEnum('order_status_enum', [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'pending_payment',
  'payment_verifying',
  'failed',
  'expired',
  'preparing',
  'ready_for_pickup',
  'collected',
  'payment_mismatch'
]);

// 1. Categories Table
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  image_url: text('image_url'),
  description: text('description'),
  parent_id: uuid('parent_id').references((): any => categories.id, { onDelete: 'cascade' }),
  is_active: boolean('is_active').notNull().default(true),
  display_order: integer('display_order').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 2. Products Table
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // stored in paise, e.g. 129900 for ₹1299
  compare_price: integer('compare_price'), // strikethrough MRP in paise
  category: text('category').notNull(), // main category slug, e.g. 't-shirts'
  subcategory: text('subcategory'), // subcategory slug, e.g. 'boxy-fit-t-shirts'
  gender: text('gender').notNull(), // 'unisex' | 'men' | 'women'
  images: text('images').array().notNull().default(sql`'{}'::text[]`), // Array of Cloudinary URLs
  sizes: text('sizes').array().notNull().default(sql`'{"XS", "S", "M", "L", "XL", "XXL"}'::text[]`),
  stock_quantity: jsonb('stock').$type<Record<string, number>>().notNull().default(sql`'{"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0}'::jsonb`),
  is_featured: boolean('is_featured').notNull().default(false),
  paired_with: text('paired_with'),
  is_active: boolean('is_active').notNull().default(true),
  weight_grams: integer('weight_grams').notNull().default(0),
  length_cm: integer('length_cm'),
  breadth_cm: integer('breadth_cm'),
  height_cm: integer('height_cm'),
  units_sold: integer('units_sold').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('products_category_idx').on(t.category),
  index('products_slug_idx').on(t.slug),
  index('products_units_sold_idx').on(t.units_sold),
]);

// 2b. Product Variants Table
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  product_id: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  colour_name: text('colour_name').notNull(),
  colour_hex: text('colour_hex'), // optional hex code, e.g. '#000000'
  images: text('images').array().notNull().default(sql`'{}'::text[]`), // Cloudinary URLs for this variant
  sizes: text('sizes').array().notNull().default(sql`'{"XS", "S", "M", "L", "XL", "XXL"}'::text[]`),
  stock_quantity: jsonb('stock_quantity').$type<Record<string, number>>().notNull().default(sql`'{"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0}'::jsonb`),
  stock_qty: integer('stock_qty').notNull().default(0),
  sku: text('sku').unique().notNull(),
  price_override: integer('price_override'), // in paise, nullable (falls back to products.price / base_price if null)
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 3. Orders Table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id'), // Clerk User ID
  order_number: text('order_number').unique().notNull(), // format: DRFTN-1001
  customer_name: text('customer_name').notNull(),
  customer_email: text('customer_email').notNull(),
  customer_phone: text('customer_phone').notNull(), // 10-digit Indian mobile
  shipping_address: jsonb('shipping_address').$type<{
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  }>(), // Nullable for store pickup orders
  items: jsonb('items').$type<Array<{
    id: string; // product ID
    name: string;
    size: string;
    quantity: number;
    price: number; // in paise
    image: string;
    slug: string;
  }>>().notNull(),
  subtotal: integer('subtotal').notNull(),
  shipping_charge: integer('shipping_charge').notNull().default(0),
  discount_amount: integer('discount_amount').notNull().default(0),
  discount_code: text('discount_code'),
  total: integer('total').notNull(),
  payment_method: text('payment_method').$type<'cod' | 'online'>(),
  payment_status: text('payment_status').$type<'pending' | 'verifying' | 'paid' | 'failed' | 'refunded'>().notNull().default('pending'),
  payment_id: text('payment_id'),
  razorpay_order_id: text('razorpay_order_id'),
  order_status: text('order_status').notNull().default('CREATED'),
  fulfillment_type: text('fulfillment_type').$type<'shiprocket' | 'borzo' | 'store_pickup'>().notNull().default('shiprocket'),
  pickup_status: text('pickup_status'),
  pickup_code: text('pickup_code'),
  payment_type: text('payment_type').$type<'cod' | 'prepaid'>(),
  booking_amount: integer('booking_amount').notNull().default(0), // in paise, e.g. 20000 for ₹200 COD booking
  remaining_amount: integer('remaining_amount').notNull().default(0), // in paise
  deposit_amount: integer('deposit_amount'),
  deposit_status: text('deposit_status'),
  verified_phone: text('verified_phone'),
  courier_partner: text('courier_partner'),
  courier_name: text('courier_name'),
  courier_provider: text('courier_provider'),
  tracking_number: text('tracking_number'),
  awb_code: text('awb_code'),
  label_url: text('label_url'),
  tracking_url: text('tracking_url'),
  provider_request_id: text('provider_request_id'),
  provider_shipment_id: text('provider_shipment_id'),
  shiprocket_order_id: text('shiprocket_order_id'),
  borzo_order_id: text('borzo_order_id'),
  paid_at: timestamp('paid_at', { withTimezone: true }),
  cancel_allowed_until: timestamp('cancel_allowed_until', { withTimezone: true }),
  hold_expires_at: timestamp('hold_expires_at', { withTimezone: true }),
  zone: text('zone'),
  invoice_number: text('invoice_number'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4. Discount Codes Table
export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').unique().notNull(),
  discount_type: text('discount_type').$type<'percentage' | 'fixed_amount'>().notNull(),
  discount_value: integer('discount_value').notNull(), // e.g. 10 for 10%, or 20000 for ₹200
  min_order_value: integer('min_order_value').default(0),
  max_discount_amount: integer('max_discount_amount'),
  usage_limit: integer('usage_limit'),
  used_count: integer('used_count').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 5a. Settings Table — application key/value configuration (shipping, COD, Razorpay, Borzo, etc.)
export const settings = pgTable('settings', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 5b. Store Settings Table — invoice & store profile (legal name, GST, address, invoice sequence)
export const storeSettings = pgTable('store_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  store_name: text('store_name').notNull().default('DRFTN CLOTHING'),
  legal_name: text('legal_name'),
  gstin: text('gstin'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  state_code: text('state_code'),
  pincode: text('pincode'),
  phone: text('phone'),
  email: text('email'),
  invoice_prefix: text('invoice_prefix').notNull().default('DRFTN'),
  current_fy: text('current_fy').notNull().default('2025-26'),
  current_sequence: integer('current_sequence').notNull().default(1000),
  terms_footer: text('terms_footer'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 6. Contact Messages Table
export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 7. Product Images Table
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  product_id: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  image_url: text('image_url').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  alt_text: text('alt_text'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8. Push Subscriptions Table
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpoint: text('endpoint').unique().notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  product_id: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  notified_at: timestamp('notified_at', { withTimezone: true }),
});

// 9. Notification Logs Table
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  url: text('url'),
  audience_type: text('audience_type').$type<'general' | 'product'>().notNull(),
  product_id: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  sent_count: integer('sent_count').notNull().default(0),
  failed_count: integer('failed_count').notNull().default(0),
  sent_at: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});

// 10. Auth Provider Enum
export const authProviderEnum = pgEnum('auth_provider_enum', ['phone', 'google']);

// 11. Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk ID or custom generated ID
  phone: text('phone').unique(),
  phone_verified: boolean('phone_verified').notNull().default(false),
  email: text('email').unique(),
  email_verified: boolean('email_verified').notNull().default(false),
  name: text('name').notNull(),
  notifications_opt_in: boolean('notifications_opt_in').notNull().default(true),
  terms_accepted_at: timestamp('terms_accepted_at', { withTimezone: true }),
  auth_provider: authProviderEnum('auth_provider').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  last_active_at: timestamp('last_active_at', { withTimezone: true }),
});

// 12. Wishlist Table (Lightweight, scalable, single row per item, zero duplicated product data)
export const wishlist = pgTable('wishlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull(), // Clerk User ID
  product_id: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  last_reminder_sent_at: timestamp('last_reminder_sent_at', { withTimezone: true }),
  reminder_count: integer('reminder_count').notNull().default(0),
}, (t) => [
  unique('wishlist_user_product_unique').on(t.user_id, t.product_id),
  index('wishlist_user_id_idx').on(t.user_id),
  index('wishlist_product_id_idx').on(t.product_id),
]);

// 13. Wishlist Campaigns Log Table (Admin Campaign Tracking)
export const wishlistCampaigns = pgTable('wishlist_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaign_name: text('campaign_name').notNull(),
  email_type: text('email_type').notNull(),
  recipient_count: integer('recipient_count').notNull().default(0),
  subject: text('subject').notNull(),
  sent_at: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  created_by: text('created_by'),
});

// 14. Payments Table
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  order_id: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  razorpay_order_id: text('razorpay_order_id'),
  razorpay_payment_id: text('razorpay_payment_id').unique(),
  razorpay_signature: text('razorpay_signature'),
  amount: integer('amount').notNull(), // in paise
  status: text('status').$type<'pending' | 'captured' | 'failed' | 'refunded'>().notNull().default('pending'),
  payment_type: text('payment_type').$type<'prepaid' | 'cod_booking'>().notNull(),
  is_booking_payment: boolean('is_booking_payment').notNull().default(false),
  raw_payload: jsonb('raw_payload'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('payments_order_id_idx').on(t.order_id),
  index('payments_razorpay_payment_id_idx').on(t.razorpay_payment_id),
]);

// 15. Durable Shipping Jobs Table
export const shippingJobs = pgTable('shipping_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  order_id: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  run_after: timestamp('run_after', { withTimezone: true }).notNull(),
  status: text('status').$type<'PENDING' | 'LOCKED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>().notNull().default('PENDING'),
  attempts: integer('attempts').notNull().default(0),
  locked_at: timestamp('locked_at', { withTimezone: true }),
  worker_id: text('worker_id'),
  last_error: text('last_error'),
  qstash_message_id: text('qstash_message_id'),       // Upstash QStash message ID after successful publish
  qstash_published_at: timestamp('qstash_published_at', { withTimezone: true }), // When QStash message was published
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('shipping_jobs_status_run_after_idx').on(t.status, t.run_after),
  index('shipping_jobs_order_id_idx').on(t.order_id),
]);

// 16. Dead Shipping Jobs Table (DLQ)
export const deadShippingJobs = pgTable('dead_shipping_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job_id: uuid('job_id').notNull(),
  order_id: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  failed_at: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
  last_error: text('last_error'),
  attempts: integer('attempts').notNull().default(5),
  payload: jsonb('payload'),
}, (t) => [
  index('dead_shipping_jobs_order_id_idx').on(t.order_id),
]);

// 17. Fraud Scores Table
export const fraudScores = pgTable('fraud_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id'),
  phone: text('phone'),
  email: text('email'),
  ip_address: text('ip_address'),
  device_fingerprint: text('device_fingerprint'),
  spam_score: integer('spam_score').notNull().default(0),
  fraud_score: integer('fraud_score').notNull().default(0),
  is_cod_disabled: boolean('is_cod_disabled').notNull().default(false),
  reason: text('reason'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('fraud_scores_phone_idx').on(t.phone),
  index('fraud_scores_user_id_idx').on(t.user_id),
  index('fraud_scores_email_idx').on(t.email),
]);

// 18. Webhook Events Table (Idempotency log)
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').$type<'razorpay' | 'shiprocket' | 'borzo'>().notNull(),
  event_type: text('event_type').notNull(),
  event_id: text('event_id').notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  processed_at: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('webhook_events_provider_event_id_unique').on(t.provider, t.event_id),
]);

// 19. Shipment Events Table
export const shipmentEvents = pgTable('shipment_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  order_id: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  courier: text('courier'),
  location: text('location'),
  description: text('description'),
  event_timestamp: timestamp('event_timestamp', { withTimezone: true }).notNull().defaultNow(),
  raw_data: jsonb('raw_data'),
}, (t) => [
  index('shipment_events_order_id_idx').on(t.order_id),
]);

// 20. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  order_id: uuid('order_id'),
  correlation_id: text('correlation_id').notNull(),
  action: text('action').notNull(), // Payment, Shipment, Retry, Webhook, Cancellation, Refund, Courier Assignment, Admin Actions
  worker_id: text('worker_id'),
  details: jsonb('details'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('audit_logs_order_id_idx').on(t.order_id),
  index('audit_logs_correlation_id_idx').on(t.correlation_id),
]);

