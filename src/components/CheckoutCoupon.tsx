'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { gsap } from 'gsap';
import { useCartStore } from '@/lib/cartStore';
import { useDriftMode } from '@/context/DriftModeContext';

interface CheckoutCouponProps {
  subtotal: number; // in paise
}

export const CheckoutCoupon: React.FC<CheckoutCouponProps> = ({ subtotal }) => {
  const { discountCode, applyDiscount } = useCartStore();
  const { isActive, userCode, codeUsed, fetchOrCreateUserCode } = useDriftMode();
  const { isSignedIn } = useAuth();

  const [inputCode, setInputCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const appliedRowRef = useRef<HTMLDivElement>(null);
  const totalNumberRef = useRef<HTMLSpanElement>(null);

  // Auto-fill (not auto-apply) if authenticated user has unused drift mode code
  useEffect(() => {
    if (discountCode) return; // Already applied a code

    if (isActive && isSignedIn && !codeUsed) {
      if (userCode) {
        setInputCode(userCode);
      } else {
        fetchOrCreateUserCode().then((code) => {
          if (code) setInputCode(code);
        });
      }
    }
  }, [isActive, isSignedIn, codeUsed, userCode, discountCode, fetchOrCreateUserCode]);

  const handleApplyCoupon = useCallback(async () => {
    if (!inputCode.trim()) return;
    setErrorMsg(null);
    setIsValidating(true);

    try {
      const clean = inputCode.trim().toUpperCase();
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: clean,
          subtotal: subtotal,
        }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        const isDriftCouponCode = clean === 'DRFTNMODEON20' || clean.startsWith('DRIFT');
        const discountObj = {
          id: isDriftCouponCode ? 'drift-mode-coupon' : `coupon-${clean}`,
          code: clean,
          discount_type: (data.discount_type || 'percent') as 'percent' | 'flat',
          discount_value: Number(data.discount_value || 20),
          min_order_value: 0,
          used_count: 0,
          is_active: true,
        };

        applyDiscount(discountObj);

        // GSAP collapse/fade confirmation animation
        setTimeout(() => {
          if (appliedRowRef.current) {
            const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!isReduced) {
              gsap.fromTo(
                appliedRowRef.current,
                { opacity: 0, y: -4 },
                { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
              );
            }
          }
        }, 50);
      } else {
        setErrorMsg(data.message || data.reason || 'Invalid coupon code');
      }
    } catch (err) {
      console.error('[CheckoutCoupon error]:', err);
      setErrorMsg('Failed to validate coupon');
    } finally {
      setIsValidating(false);
    }
  }, [inputCode, subtotal, applyDiscount]);

  const handleRemoveDiscount = useCallback(() => {
    applyDiscount(null);
    setErrorMsg(null);
  }, [applyDiscount]);

  // If a coupon is applied (DRIFT MODE or standard)
  if (discountCode) {
    const isDrift = discountCode.code === 'DRFTNMODEON20' || discountCode.code.startsWith('DRIFT');
    return (
      <div
        ref={appliedRowRef}
        className="my-4 border border-zinc-800 bg-zinc-950/60 p-3.5 flex items-center justify-between font-mono text-xs text-white"
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="flex items-center gap-2">
          {/* Minimal Checkmark Icon */}
          <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold">
            ✓
          </span>
          <span className="tracking-[0.15em] uppercase font-bold text-white">
            {isDrift ? `DRIFT MODE — ${discountCode.discount_value}% OFF APPLIED` : `${discountCode.code} — APPLIED`}
          </span>
        </div>

        <button
          onClick={handleRemoveDiscount}
          className="text-zinc-500 hover:text-white transition-colors text-[10px] tracking-widest uppercase font-mono ml-3 underline"
        >
          REMOVE
        </button>
      </div>
    );
  }

  return (
    <div className="my-4 space-y-2 font-mono">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="DISCOUNT CODE"
          className="flex-1 bg-black border border-zinc-800 px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 uppercase tracking-[0.15em]"
        />
        <button
          onClick={handleApplyCoupon}
          disabled={isValidating || !inputCode.trim()}
          className="bg-white text-black px-5 py-2.5 text-xs font-bold font-mono tracking-[0.15em] uppercase hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white"
        >
          {isValidating ? '...' : 'APPLY'}
        </button>
      </div>

      {errorMsg && (
        <p className="text-[11px] text-red-400 font-mono tracking-wide uppercase">{errorMsg}</p>
      )}
    </div>
  );
};

export default CheckoutCoupon;
