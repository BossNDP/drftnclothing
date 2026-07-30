export interface ProductVariant {
  id: string;
  product_id: string;
  colour_name: string;
  colour_hex?: string | null;
  images: string[];
  sizes: string[];
  stock_quantity: Record<string, number>;
  stock_qty?: number;
  sku: string;
  price_override?: number | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number; // base price in paise (aliased to base_price)
  base_price?: number;
  compare_price?: number;
  category: string; // tees, hoodies, joggers, accessories
  subcategory?: string;
  gender: string; // unisex, men, women
  images: string[];
  hidden_detail_image?: string;
  sizes: string[];
  stock_quantity: Record<string, number>; // e.g., { XS: 10, S: 5 }
  is_featured: boolean;
  paired_with?: string | null;
  is_active: boolean;
  weight_grams: number;
  length_cm?: number | null;
  breadth_cm?: number | null;
  height_cm?: number | null;
  units_sold?: number;
  created_at?: string;
  variants?: ProductVariant[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  description?: string | null;
  parent_id?: string | null;
  is_active: boolean;
  display_order: number;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
  items: CartItem[];
  subtotal: number;
  shipping_charge: number;
  discount_code?: string | null;
  discount_amount?: number | null;
  total: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id?: string;
  razorpay_order_id?: string | null;
  order_status: 'placed' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'pending_payment' | 'payment_verifying' | 'failed' | 'expired' | 'preparing' | 'ready_for_pickup' | 'collected' | 'payment_mismatch';
  fulfillment_type?: 'delivery' | 'pickup';
  pickup_status?: 'awaiting_pickup' | 'ready_for_pickup' | 'collected' | null;
  pickup_code?: string | null;
  tracking_number?: string | null;
  courier_partner?: string | null;
  courier_name?: string | null;
  awb_code?: string | null;
  tracking_url?: string | null;
  cancel_allowed_until?: string | Date | null;
  needs_manual_refund?: boolean;
  shiprocket_order_id?: string | null;
  courier_provider?: 'borzo' | 'shiprocket' | null;
  zone?: 'BLR_EXPRESS' | 'STANDARD' | null;
  invoice_number?: string | null;
  payment_type?: 'prepaid' | 'cod_with_deposit';
  deposit_amount?: number | null;
  remaining_amount?: number | null;
  deposit_status?: 'pending' | 'paid' | 'failed' | null;
  verified_phone?: string | null;
  created_at?: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_value: number;
  max_discount_amount?: number;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
  expires_at?: string;
}

export interface StoreSettings {
  store_name: string;
  contact_number: string;
  instagram_handle: string;
  free_shipping_threshold: number;
  default_shipping_charge: number;
  razorpay_key_id: string;
  razorpay_key_secret: string;
  nimbuspost_api_key: string;
  blr_pincode_ranges: string;
  borzo_surcharge: number;
  borzo_free_threshold: number;
  borzo_cutoff_start: string;
  borzo_cutoff_end: string;
  borzo_pickup_address: string;
  maintenance_mode?: string | boolean;
}

export interface CartItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_price?: number;
  image: string;
  size: string;
  quantity: number;
  stock_quantity?: Record<string, number>; // per-size stock caps for client-side clamping
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at?: string;
}
