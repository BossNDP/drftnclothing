/**
 * Meta Pixel Analytics Utility
 * Provides secure, sanitized, idempotent tracking helper functions for Meta Pixel standard events.
 */

declare global {
  interface Window {
    fbq?: (
      action: 'track' | 'trackCustom' | 'init',
      eventName: string,
      params?: Record<string, any>
    ) => void;
  }
}

// Whitelisted supported currencies
const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

/**
 * Sanitizes input strings to prevent XSS or DOM injection vulnerabilities
 * when reading properties from dynamic DOM attributes or user inputs.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    if (typeof input === 'number' || typeof input === 'boolean') {
      return String(input);
    }
    return '';
  }
  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[^\w\s\-\.\,\:\/]/gi, '') // Retain safe alphanumeric & standard punctuation
    .trim();
}

/**
 * Parses and sanitizes numeric price/amount parameters.
 * Rejects NaN, infinite, or negative values and normalizes to 2 decimal places.
 */
export function sanitizeNumericValue(val: unknown): number {
  if (typeof val === 'number') {
    return isFinite(val) && val >= 0 ? Math.round(val * 100) / 100 : 0;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9\.]/g, '');
    const parsed = parseFloat(cleaned);
    return !isNaN(parsed) && isFinite(parsed) && parsed >= 0
      ? Math.round(parsed * 100) / 100
      : 0;
  }
  return 0;
}

/**
 * Validates currency parameter against an allowed whitelist. Defaults to 'INR'.
 */
export function validateCurrency(curr: unknown): AllowedCurrency {
  if (typeof curr === 'string') {
    const uppercaseCurr = curr.toUpperCase().trim();
    if ((ALLOWED_CURRENCIES as readonly string[]).includes(uppercaseCurr)) {
      return uppercaseCurr as AllowedCurrency;
    }
  }
  return 'INR';
}

export interface AddToCartParams {
  productId: string;
  productName: string;
  price: number | string; // in INR / rupees
  currency?: string;
}

export interface PurchaseParams {
  orderId: string;
  contentIds: string[];
  totalValue: number | string; // in INR / rupees
  currency?: string;
}

/**
 * Triggers Meta Pixel AddToCart event with sanitized parameters.
 */
export function trackAddToCart(params: AddToCartParams): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return;
  }

  const sanitizedId = sanitizeString(params.productId);
  const sanitizedName = sanitizeString(params.productName);
  const sanitizedValue = sanitizeNumericValue(params.price);
  const validatedCurrency = validateCurrency(params.currency);

  if (!sanitizedId) {
    console.warn('[Meta Pixel] trackAddToCart skipped: Invalid or missing productId');
    return;
  }

  window.fbq('track', 'AddToCart', {
    content_ids: [sanitizedId],
    content_type: 'product',
    content_name: sanitizedName,
    value: sanitizedValue,
    currency: validatedCurrency,
  });
}

/**
 * Triggers Meta Pixel Purchase event with strict client-side idempotency.
 * Prevents double-firing on page refresh or returning visits.
 */
export function trackPurchase(params: PurchaseParams): boolean {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return false;
  }

  const sanitizedOrderId = sanitizeString(params.orderId);
  if (!sanitizedOrderId) {
    console.warn('[Meta Pixel] trackPurchase skipped: Invalid or missing orderId');
    return false;
  }

  // Idempotency check via localStorage
  const storageKey = `meta_pixel_purchase_tracked_${sanitizedOrderId}`;
  try {
    const alreadyTracked = localStorage.getItem(storageKey);
    if (alreadyTracked === 'true') {
      console.log(`[Meta Pixel] Purchase event for order ${sanitizedOrderId} already tracked. Skipping.`);
      return false;
    }
  } catch (e) {
    // Ignore storage errors if localStorage is restricted
  }

  const sanitizedContentIds = (params.contentIds || [])
    .map(sanitizeString)
    .filter(Boolean);
  const sanitizedValue = sanitizeNumericValue(params.totalValue);
  const validatedCurrency = validateCurrency(params.currency);

  window.fbq('track', 'Purchase', {
    content_ids: sanitizedContentIds,
    content_type: 'product',
    value: sanitizedValue,
    currency: validatedCurrency,
  });

  // Mark order as tracked for idempotency
  try {
    localStorage.setItem(storageKey, 'true');
  } catch (e) {
    // Ignore storage quota or disabled errors
  }

  return true;
}
