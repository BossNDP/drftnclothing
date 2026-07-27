'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { X, Plus, Minus, Trash2, ShoppingBag, Tag, ArrowRight } from 'lucide-react';
import { useCartStore } from '../lib/cartStore';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { toast } from '@/lib/toast';
import { motion } from 'framer-motion';

const FREE_SHIPPING_THRESHOLD = 99900; // ₹999 in paise

export default function MiniCart() {
  const pathname = usePathname();
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isOpen);
  const setIsOpen = useCartStore((state) => state.setIsOpen);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const getCartTotal = useCartStore((state) => state.getCartTotal);
  const discountCode = useCartStore((state) => state.discountCode);
  const applyDiscount = useCartStore((state) => state.applyDiscount);

  const [promoInput, setPromoInput] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);

  const subtotal = getCartTotal();

  let discountAmount = 0;
  if (discountCode) {
    if (discountCode.discount_type === 'percent') {
      discountAmount = Math.round(subtotal * (discountCode.discount_value / 100));
    } else {
      discountAmount = discountCode.discount_value;
    }
  }
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Shipping progress — % toward ₹999 free shipping
  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const hasEarnedFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

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
      if (!res.ok || !data.valid) { toast.error(data.message || 'Invalid promo code!'); return; }
      applyDiscount({
        id: 'applied-coupon',
        code: promoInput.toUpperCase().trim(),
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_order_value: 0,
        used_count: 0,
        is_active: true,
      });
      toast.success(data.message || 'Promo code applied!');
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

  // iOS-safe scroll lock
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY) * -1);
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // ESC close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Do not render MiniCart on admin pages
  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-[4000] bg-black/70 backdrop-blur-sm transition-opacity duration-400 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Cart Drawer */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-full sm:w-[460px] bg-[#0d0d0d] border-l border-white/10 text-white z-[4500] shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Shopping Cart Drawer"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-white stroke-[1.8]" />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Your Bag</h2>
            <span className="bg-white/10 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/5"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Bar */}
        <div className="bg-zinc-950/80 px-5 py-3 border-b border-white/5">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1.5 uppercase tracking-wider">
            {hasEarnedFreeShipping ? (
              <span className="text-white font-bold flex items-center gap-1.5">
                🎉 YOU&apos;VE UNLOCKED FREE EXPRESS SHIPPING!
              </span>
            ) : (
              <span className="text-zinc-400">
                ADD <strong className="text-white font-bold">₹{(amountToFreeShipping / 100).toFixed(0)}</strong> MORE FOR FREE SHIPPING
              </span>
            )}
            <span className="text-zinc-500 font-bold">{Math.round(shippingProgress)}%</span>
          </div>

          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                hasEarnedFreeShipping ? 'bg-white' : 'bg-gradient-to-r from-zinc-500 to-white'
              }`}
              style={{ width: `${shippingProgress}%` }}
            />
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 divide-y divide-white/5">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-500">
                <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-white">Your bag is empty</p>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                  Explore the drop collection to get started.
                </p>
              </div>
              <Link
                href="/shop"
                onClick={() => setIsOpen(false)}
                className="mt-4 inline-flex items-center gap-2 bg-white text-black px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
              >
                Explore Shop <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const itemTotalPaise = item.price * item.quantity;
              const optimizedImg = getOptimizedImageUrl(item.image, 160);
              return (
                <div key={`${item.id}-${item.size}`} className="pt-4 first:pt-0 flex gap-4">
                  {/* Image */}
                  <div className="relative w-20 h-24 bg-zinc-900 border border-white/10 flex-shrink-0 overflow-hidden">
                    <Image
                      src={optimizedImg}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/shop/${item.slug || item.id}`}
                          onClick={() => setIsOpen(false)}
                          className="text-xs font-bold uppercase tracking-wider text-white hover:text-zinc-300 transition-colors line-clamp-1"
                        >
                          {item.name}
                        </Link>

                        <button
                          onClick={() => removeItem(item.id, item.size)}
                          className="text-zinc-500 hover:text-brand-red transition-colors p-1"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400 mt-1">
                        <span>SIZE: <strong className="text-white">{item.size}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Controller */}
                      <div className="flex items-center border border-white/20 rounded bg-black">
                        <button
                          onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                          className="p-1 text-zinc-400 hover:text-white transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-[11px] font-mono font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                          className="p-1 text-zinc-400 hover:text-white transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Price */}
                      <span className="text-xs font-mono font-bold text-white">
                        ₹{(itemTotalPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Summary */}
        {items.length > 0 && (
          <div className="p-5 border-t border-white/10 bg-black/60 space-y-4">
            {/* Promo Code Input */}
            <div>
              {discountCode ? (
                <div className="flex items-center justify-between bg-white/5 border border-white/10 px-3 py-2 rounded text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold text-white">{discountCode.code}</span>
                    <span className="text-emerald-400 text-[10px]">
                      (-₹{(discountAmount / 100).toFixed(2)})
                    </span>
                  </div>
                  <button
                    onClick={handleRemovePromo}
                    className="text-zinc-400 hover:text-white text-[10px] underline uppercase"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="PROMO CODE"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    className="flex-1 bg-black border border-white/20 px-3 py-2 text-xs font-mono uppercase text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
                  />
                  <button
                    type="submit"
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold transition-colors border border-white/20"
                  >
                    Apply
                  </button>
                </form>
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-1.5 text-xs font-mono pt-1">
              <div className="flex justify-between text-zinc-400">
                <span>SUBTOTAL</span>
                <span className="text-white">₹{(subtotal / 100).toFixed(2)}</span>
              </div>

              {discountCode && (
                <div className="flex justify-between text-emerald-400">
                  <span>DISCOUNT</span>
                  <span>-₹{(discountAmount / 100).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-400">
                <span>ESTIMATED SHIPPING</span>
                <span className="text-white">
                  {hasEarnedFreeShipping ? <strong className="text-emerald-400">FREE</strong> : 'CALCULATED AT CHECKOUT'}
                </span>
              </div>

              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                <span>TOTAL</span>
                <span className="text-base font-mono">₹{(finalTotal / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-2 pt-1">
              <Link
                href="/checkout"
                onClick={() => setIsOpen(false)}
                className="w-full bg-white hover:bg-zinc-200 text-black py-4 font-bold uppercase tracking-[0.2em] text-xs transition-colors flex items-center justify-center gap-2 block text-center"
              >
                PROCEED TO CHECKOUT <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/cart"
                onClick={() => setIsOpen(false)}
                className="w-full bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white py-2.5 text-[11px] font-mono uppercase tracking-widest transition-colors block text-center"
              >
                VIEW DETAILED CART
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
