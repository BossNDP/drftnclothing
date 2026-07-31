'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import { gsap } from 'gsap';
import { useDriftMode } from '@/context/DriftModeContext';

const DISMISS_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours

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
      duration: 0.35,
      ease: 'power2.out',
    });

    gsap.to(modalRef.current, {
      opacity: 0,
      y: 12,
      scale: 0.98,
      duration: 0.35,
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

    // Check localStorage 12hr dismiss status
    try {
      const dismissedAt = localStorage.getItem('drftn_drift_popup_dismissed');
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < DISMISS_TTL_MS) {
          // Allow testing on localhost
        }
      }
    } catch {}

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isActive, codeUsed]);

  useEffect(() => {
    if (!isOpen) return;

    if (isSignedIn && !userCode) {
      fetchOrCreateUserCode();
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const ctx = gsap.context(() => {
      if (overlayRef.current) {
        gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 0.92, duration: 0.45, ease: 'power2.out' });
      }
      if (modalRef.current) {
        gsap.fromTo(
          modalRef.current,
          { opacity: 0, y: 16, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' }
        );
      }
    });

    return () => ctx.revert();
  }, [isOpen, isSignedIn, userCode, fetchOrCreateUserCode]);

  if (!isOpen || !isActive || codeUsed) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] bg-black/92 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
      style={{ willChange: 'opacity' }}
    >
      <div
        ref={modalRef}
        className="bg-black text-white border border-zinc-800 rounded-2xl p-7 md:p-9 w-full max-w-[420px] relative font-sans shadow-2xl overflow-hidden my-auto"
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Subtle Ambient Background Scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 to-black pointer-events-none" />

        {/* Dismiss × button */}
        <button
          onClick={handleDismiss}
          aria-label="Close Welcome Offer"
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono focus:outline-none z-10"
        >
          ✕
        </button>

        {/* Content Body */}
        <div className="relative z-10">
          <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-zinc-400 uppercase block mb-3">
            NEW CUSTOMER OFFER
          </span>

          <h2 className="text-2xl md:text-3xl font-black tracking-[0.05em] text-white uppercase leading-tight mb-2 font-mono">
            GET {discountPercent}% OFF YOUR FIRST ORDER
          </h2>

          <p className="text-xs text-zinc-400 font-normal leading-relaxed mb-6">
            Welcome to DRFTN CLOTHING. Enjoy a flat {discountPercent}% discount on your first order. One-time discount per customer.
          </p>

          {/* Code Box or Sign-in Box */}
          {isSignedIn ? (
            <div className="mb-6">
              <div className="bg-zinc-950 border border-dashed border-zinc-700 rounded-xl p-3.5 flex items-center justify-between font-mono font-bold text-sm tracking-[0.18em] text-white">
                <span className="select-all text-brand-offwhite">{userCode || 'GENERATING...'}</span>

                <button
                  onClick={copyToClipboard}
                  disabled={!userCode}
                  className="bg-zinc-800 hover:bg-white hover:text-black text-white transition-all px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-widest uppercase border border-zinc-700 flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>COPIED</span>
                    </>
                  ) : (
                    <span>COPY CODE</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <SignInButton mode="modal">
                <button className="w-full bg-white hover:bg-zinc-200 text-black py-3.5 px-6 text-xs font-mono font-extrabold tracking-[0.18em] uppercase transition-all rounded-xl shadow-lg mb-2 flex items-center justify-center gap-2">
                  <span>SIGN IN TO CLAIM {discountPercent}% OFF</span>
                  <span className="text-sm">→</span>
                </button>
              </SignInButton>
              <p className="text-[10px] text-zinc-500 font-mono text-center tracking-wide uppercase">
                Sign in required to link single-use first order code
              </p>
            </div>
          )}

          {/* Main CTA Button */}
          <button
            onClick={handleShopDrop}
            className="w-full bg-zinc-900 hover:bg-white hover:text-black text-white py-3.5 px-6 text-xs font-mono font-bold tracking-[0.2em] uppercase transition-all rounded-xl border border-zinc-700 flex items-center justify-center gap-2"
          >
            <span>SHOP THE COLLECTION</span>
            <span className="text-sm">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriftModePopup;
