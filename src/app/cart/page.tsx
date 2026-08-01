'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { Plus, Minus, Trash2, Tag, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { dbService } from '@/lib/db';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { toast } from '@/lib/toast';
import { StoreSettings } from '@/types';

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const getCartTotal = useCartStore((state) => state.getCartTotal);
  const discountCode = useCartStore((state) => state.discountCode);
  const applyDiscount = useCartStore((state) => state.applyDiscount);

  const [promoInput, setPromoInput] = useState('');
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load store settings (shipping thresholds, etc.)
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await dbService.getSettings();
        setStoreSettings(settings);
      } catch (err) {
        console.error('Failed to load store settings:', err);
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  const subtotal = getCartTotal();
  const freeShippingThreshold = storeSettings?.free_shipping_threshold ?? 0;
  const defaultShippingCharge = storeSettings?.default_shipping_charge ?? 0;

  // Calculate shipping
  const shippingCharge = subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : defaultShippingCharge;

  // Calculate discount amount
  let discountAmount = 0;
  if (discountCode) {
    if (discountCode.discount_type === 'percent') {
      discountAmount = Math.round(subtotal * (discountCode.discount_value / 100));
    } else {
      discountAmount = discountCode.discount_value;
    }
  }

  const finalTotal = Math.max(0, subtotal - discountAmount + shippingCharge);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;

    try {
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput, subtotal }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        toast.error(data.message || 'Invalid promo code!');
        return;
      }

      applyDiscount({
        id: 'applied-coupon',
        code: promoInput.toUpperCase().trim(),
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_order_value: 0,
        used_count: 0,
        is_active: true
      });
      toast.success(data.message || `Promo code applied successfully!`);
      setPromoInput('');
    } catch (err) {
      toast.error('Error applying coupon.');
      console.error(err);
    }
  };

  const handleRemovePromo = () => {
    applyDiscount(null);
    toast.info('Promo code removed.');
  };

  // Shipping progress helper
  const shippingProgress = Math.min((subtotal / freeShippingThreshold) * 100, 100);
  const amountToFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const hasEarnedFreeShipping = subtotal >= freeShippingThreshold;

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-32 px-6 space-y-8 bg-brand-black" role="status" aria-live="polite">
        <div className="w-20 h-20 border border-brand-graphite flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-brand-muted stroke-[1]" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-display uppercase tracking-widest text-brand-offwhite">NO DROPS IN BAG.</h1>
          <p className="text-brand-stone text-xs tracking-wider uppercase max-w-xs mx-auto font-body">
            You haven&apos;t added any items to your shopping bag yet. Explore the drop to get driftin.
          </p>
        </div>
        <Link
          href="/shop"
          className="btn-primary"
        >
          <span>Explore Collection</span>
          <ArrowRight className="w-3.5 h-3.5 relative z-10" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="py-16 px-6 md:px-12 max-w-screen-2xl mx-auto w-full flex-1 flex flex-col bg-brand-black">
      {/* Page Title */}
      <div className="border-b border-brand-graphite pb-8 mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="eyebrow mb-3 block">Your Checkout Selection</span>
          <h1 className="text-brand-offwhite leading-none font-display uppercase" style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)' }}>
            Your Bag
          </h1>
        </div>
        <p className="text-brand-stone text-[10px] tracking-[0.2em] uppercase font-body font-semibold mb-1">
          {items.reduce((acc, item) => acc + item.quantity, 0)} Items Added
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-2 space-y-8">
          <div className="border border-brand-graphite bg-brand-charcoal/30 divide-y divide-brand-graphite" role="list" aria-label="Shopping bag items">
            {items.map((item) => (
              <div key={`${item.id}-${item.size}`} className="p-6 flex flex-col sm:flex-row gap-6" role="listitem">
                {/* Image */}
                <div className="relative w-24 h-32 bg-brand-graphite overflow-hidden flex-shrink-0">
                  <NextImage
                    src={getOptimizedImageUrl(item.image, 200) || 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=300'}
                    alt={`${item.name} — size ${item.size}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[9px] text-brand-amber font-semibold uppercase tracking-[0.2em] font-body">
                          DRFTN STAPLE
                        </span>
                        <h3 className="text-sm font-semibold text-brand-offwhite uppercase tracking-wide mt-1 font-body leading-snug">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-brand-stone font-semibold uppercase tracking-wider mt-1.5 font-body">
                          Size: {item.size}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-brand-offwhite shrink-0 font-body">
                        ₹{((item.price * item.quantity) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    {/* Quantity Controls */}
                    <div className="flex items-center border border-brand-muted bg-brand-graphite" role="group" aria-label="Quantity controls">
                      <button
                        onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center text-brand-stone hover:text-brand-offwhite transition-colors"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs px-3 text-brand-offwhite font-bold w-8 text-center select-none font-body">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center text-brand-stone hover:text-brand-offwhite transition-colors"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        removeItem(item.id, item.size);
                        toast.info(`Removed ${item.name} from bag.`);
                      }}
                      className="text-brand-stone hover:text-white transition-colors flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold"
                      aria-label={`Remove ${item.name} from bag`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Continue shopping link */}
          <div className="text-left">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-brand-stone hover:text-brand-offwhite font-bold transition-colors border-animate pb-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Continue Shopping
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary & Discount Code */}
        <div className="space-y-8">
          <div className="border border-brand-graphite bg-brand-charcoal/30 p-6 space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-offwhite border-b border-brand-graphite pb-4 font-display">
              Order Summary
            </h2>

            {/* Free Shipping Progress bar in Order Summary */}
            {!loadingSettings && (
              <div className="space-y-2 pb-2">
                {hasEarnedFreeShipping ? (
                  <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-brand-amber font-body">
                    ✓ Free Shipping Unlocked!
                  </p>
                ) : (
                  <p className="text-[10px] tracking-[0.15em] uppercase font-body font-medium text-brand-stone">
                    Add <span className="text-brand-offwhite font-bold">
                      ₹{(amountToFreeShipping / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </span> more for free shipping
                  </p>
                )}
                <div className="shipping-progress-bar">
                  <div
                    className="shipping-progress-fill"
                    style={{ width: `${shippingProgress}%` }}
                    role="progressbar"
                    aria-valuenow={shippingProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}

            {/* Calculations lines */}
            <div className="space-y-4 text-xs font-body">
              <div className="flex justify-between items-center text-brand-stone">
                <span>Bag Subtotal</span>
                <span className="font-semibold text-brand-offwhite">
                  ₹{(subtotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </span>
              </div>

              {/* Promo code line */}
              {discountCode && (
                <div className="flex justify-between items-center text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="uppercase font-bold tracking-wider">{discountCode.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">−₹{(discountAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
                    <button
                      onClick={handleRemovePromo}
                      className="text-brand-stone hover:text-white text-[9px] uppercase font-bold tracking-widest transition-colors"
                      aria-label="Remove promo code"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-brand-stone">
                <span>Shipping Fee</span>
                {shippingCharge === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="line-through text-zinc-500 text-xs">₹50</span>
                    <span className="font-extrabold text-emerald-400 uppercase tracking-widest text-[10px]">
                      FREE
                    </span>
                  </div>
                ) : (
                  <span className="font-semibold text-brand-offwhite">
                    ₹{(shippingCharge / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-brand-graphite"></div>

            {/* Total line */}
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase tracking-[0.2em] text-brand-stone font-body font-semibold">Estimated Total</span>
              <span className="text-lg font-extrabold text-brand-offwhite font-display">
                ₹{(finalTotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
            </div>

            {/* Proceed CTA */}
            <Link
              href="/checkout"
              className="btn-electric w-full text-center bg-brand-offwhite text-brand-black hover:bg-white transition-all duration-300 relative border border-transparent font-bold text-xs uppercase tracking-widest py-4 px-6"
            >
              <span>Proceed to Checkout</span>
            </Link>
          </div>

          {/* Promo code box */}
          <div className="border border-brand-graphite bg-brand-charcoal/20 p-6 space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-stone flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-brand-stone" aria-hidden="true" />
              Apply Promo Code
            </h3>
            <form onSubmit={handleApplyPromo} className="flex gap-2" aria-label="Apply promo code">
              <label htmlFor="cart-promo-input" className="sr-only">Promo code</label>
              <input
                id="cart-promo-input"
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="DRFTN10 / BLRSTREET"
                className="flex-1 bg-brand-graphite border border-brand-muted text-brand-offwhite py-2.5 px-4 text-xs uppercase font-bold tracking-wider"
              />
              <button
                type="submit"
                className="bg-brand-graphite border border-brand-muted text-brand-offwhite hover:border-brand-amber hover:text-brand-amber font-bold text-xs uppercase tracking-wider py-2.5 px-4 transition-colors"
              >
                Apply
              </button>
            </form>
            <p className="text-[10px] text-brand-stone leading-relaxed font-body font-light">
              * Promo codes cannot be combined. Min order values apply. Try codes: <strong className="text-brand-stone font-semibold">DRFTN10</strong> (10% off) or <strong className="text-brand-stone font-semibold">BLRSTREET</strong> (₹250 off on orders &gt; ₹1499).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
