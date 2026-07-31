'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import { gsap } from 'gsap';
import { useDriftMode } from '@/context/DriftModeContext';

const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

export const DriftModePopup: React.FC = () => {
  const { isActive, discountPercent, userCode, codeUsed, fetchOrCreateUserCode } = useDriftMode();
  const { isSignedIn } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const closePopup = useCallback(() => {
    if (!overlayRef.current || !modalRef.current) {
      setIsOpen(false);
      return;
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) {
      setIsOpen(false);
      return;
    }

    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.out',
    });

    gsap.to(modalRef.current, {
      opacity: 0,
      y: 12,
      duration: 0.4,
      ease: 'power2.out',
      onComplete: () => {
        setIsOpen(false);
      },
    });
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem('drftn_drift_popup_dismissed', Date.now().toString());
    } catch {}
    closePopup();
  }, [closePopup]);

  const handleShopDrop = useCallback(() => {
    closePopup();
    setTimeout(() => {
      const target = document.getElementById('shop') || document.getElementById('products') || document.querySelector('main');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }, 200);
  }, [closePopup]);

  const copyToClipboard = useCallback(() => {
    if (!userCode) return;
    navigator.clipboard.writeText(userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [userCode]);

  useEffect(() => {
    if (!isActive || codeUsed) return;

    // Check localStorage 24hr dismiss status
    try {
      const dismissedAt = localStorage.getItem('drftn_drift_popup_dismissed');
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < DISMISS_TTL_MS) {
          return; // Still within 24hr window
        }
      }
    } catch {}

    // 3-second delay after page load before opening
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isActive, codeUsed]);

  // Trigger GSAP entrance animation when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (isSignedIn && !userCode) {
      fetchOrCreateUserCode();
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const ctx = gsap.context(() => {
      if (overlayRef.current) {
        gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 0.92, duration: 0.5, ease: 'power2.out' });
      }
      if (modalRef.current) {
        gsap.fromTo(modalRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
      }
    });

    return () => ctx.revert();
  }, [isOpen, isSignedIn, userCode, fetchOrCreateUserCode]);

  if (!isOpen || !isActive || codeUsed) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
      style={{ willChange: 'opacity' }}
    >
      <div
        ref={modalRef}
        className="bg-white text-black border border-black p-8 md:p-10 w-full max-w-[420px] relative font-sans shadow-2xl my-auto"
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Dismiss × button */}
        <button
          onClick={handleDismiss}
          aria-label="Close Drift Mode Popup"
          className="absolute top-4 right-4 text-zinc-400 hover:text-black transition-colors p-2 text-lg font-light leading-none focus:outline-none"
        >
          ✕
        </button>

        {/* Content */}
        <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2">
          LAUNCH EXCLUSIVE
        </span>

        <h2 className="text-2xl md:text-3xl font-black tracking-[0.05em] text-black uppercase leading-tight mb-2">
          DRIFT MODE: ON
        </h2>

        <p className="text-xs text-zinc-600 font-normal leading-relaxed mb-6">
          {discountPercent}% off your first order. One-time only.
        </p>

        {isSignedIn ? (
          <div className="mb-6">
            <div className="border border-dashed border-black bg-zinc-50 p-3.5 flex items-center justify-between font-mono font-bold text-sm tracking-[0.15em] text-black">
              <span>{userCode || 'GENERATING...'}</span>

              <button
                onClick={copyToClipboard}
                disabled={!userCode}
                title="Copy Coupon Code"
                className="ml-3 text-zinc-600 hover:text-black transition-colors focus:outline-none flex items-center justify-center w-6 h-6"
              >
                {copied ? (
                  /* SVG Checkmark */
                  <svg className="w-4 h-4 text-black stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  /* SVG Copy Icon */
                  <svg className="w-4 h-4 text-zinc-600 hover:text-black stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            {copied && (
              <span className="text-[10px] font-mono text-zinc-500 tracking-wider uppercase block mt-1">
                COPIED TO CLIPBOARD
              </span>
            )}
          </div>
        ) : (
          <div className="mb-6">
            <SignInButton mode="modal">
              <button className="w-full bg-black text-white py-3.5 px-6 text-xs font-mono font-bold tracking-[0.15em] uppercase hover:bg-zinc-900 transition-colors border border-black mb-2">
                SIGN IN TO CLAIM
              </button>
            </SignInButton>
            <p className="text-[10px] text-zinc-500 font-mono text-center tracking-wide uppercase">
              Sign in required for single-use first order discount
            </p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleShopDrop}
          className="w-full bg-black text-white py-3.5 px-6 text-xs font-mono font-bold tracking-[0.2em] uppercase hover:bg-zinc-900 transition-colors border border-black"
        >
          SHOP THE DROP
        </button>
      </div>
    </div>
  );
};

export default DriftModePopup;
