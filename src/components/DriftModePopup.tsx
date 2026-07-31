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
      duration: 0.3,
      ease: 'power2.out',
    });

    gsap.to(modalRef.current, {
      opacity: 0,
      y: 12,
      duration: 0.3,
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

  const handleCopyAndShop = useCallback(() => {
    if (userCode) {
      navigator.clipboard.writeText(userCode).catch(() => {});
      setCopied(true);
    }

    setTimeout(() => {
      closePopup();
      setTimeout(() => {
        const target = document.getElementById('shop') || document.getElementById('products') || document.querySelector('main');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    }, 600);
  }, [userCode, closePopup]);

  const copyCodeOnly = useCallback(() => {
    if (!userCode) return;
    navigator.clipboard.writeText(userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [userCode]);

  useEffect(() => {
    if (!isActive || codeUsed) return;

    // Check 12-hour dismiss state
    try {
      const dismissedAt = localStorage.getItem('drftn_drift_popup_dismissed');
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < DISMISS_TTL_MS) {
          // Allowed for local testing
        }
      }
    } catch {}

    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isActive, codeUsed]);

  // Entrance animation: overlay 0.35s fade, modal 0.5s fade + translateY(12px -> 0)
  useEffect(() => {
    if (!isOpen) return;

    if (isSignedIn && !userCode) {
      fetchOrCreateUserCode();
    }

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced) return;

    const ctx = gsap.context(() => {
      if (overlayRef.current) {
        gsap.fromTo(
          overlayRef.current,
          { opacity: 0 },
          { opacity: 0.94, duration: 0.35, ease: 'power2.out' }
        );
      }
      if (modalRef.current) {
        gsap.fromTo(
          modalRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.08 }
        );
      }
    });

    return () => ctx.revert();
  }, [isOpen, isSignedIn, userCode, fetchOrCreateUserCode]);

  if (!isOpen || !isActive || codeUsed) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] bg-black/94 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
      style={{ willChange: 'opacity' }}
    >
      <div
        ref={modalRef}
        className="bg-black text-white border border-zinc-800 rounded-2xl p-6 md:p-8 w-full max-w-[400px] relative font-sans shadow-2xl overflow-hidden my-auto select-none"
        style={{ willChange: 'transform, opacity' }}
      >
        {/* Subtle Ambient Background Scrim */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 to-black pointer-events-none" />

        {/* Dismiss × button */}
        <button
          onClick={handleDismiss}
          aria-label="Close Offer"
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono focus:outline-none z-10"
        >
          ✕
        </button>

        {/* Content Body with Tight Vertical Rhythm */}
        <div className="relative z-10 flex flex-col items-start text-left">
          <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-zinc-400 uppercase block mb-1.5">
            NEW CUSTOMER OFFER
          </span>

          <h2 className="text-2xl md:text-3xl font-mono font-black tracking-tight text-white uppercase leading-tight mb-2">
            GET {discountPercent}% OFF YOUR FIRST ORDER
          </h2>

          <p className="text-xs text-zinc-400 font-normal leading-relaxed mb-4">
            Enjoy a flat {discountPercent}% discount on your first DRFTN purchase. Single-use code per customer.
          </p>

          {/* Code Display Box */}
          {isSignedIn ? (
            <div className="w-full mb-3">
              <div className="bg-zinc-950 border border-dashed border-zinc-700 rounded-xl p-3 flex items-center justify-between font-mono font-bold text-sm tracking-[0.18em] text-white">
                <span className="select-all text-white font-mono">{userCode || 'GENERATING...'}</span>

                <button
                  onClick={copyCodeOnly}
                  disabled={!userCode}
                  className="bg-zinc-800 hover:bg-white hover:text-black text-white transition-colors px-2.5 py-1 rounded text-[10px] font-mono tracking-widest uppercase border border-zinc-700 flex items-center gap-1"
                >
                  {copied ? (
                    <span className="text-white font-bold">✓ COPIED</span>
                  ) : (
                    <span>COPY CODE</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full mb-3">
              <SignInButton mode="modal">
                <button className="w-full bg-white hover:bg-zinc-200 text-black py-3 px-5 text-xs font-mono font-extrabold tracking-[0.18em] uppercase transition-colors rounded-xl shadow-md flex items-center justify-center gap-2">
                  <span>SIGN IN TO CLAIM {discountPercent}% OFF</span>
                  <span className="text-sm">→</span>
                </button>
              </SignInButton>
            </div>
          )}

          {/* Single Primary Action CTA Button */}
          {isSignedIn && (
            <button
              onClick={handleCopyAndShop}
              className="w-full bg-white hover:bg-zinc-200 text-black py-3.5 px-6 text-xs font-mono font-extrabold tracking-[0.2em] uppercase transition-colors rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <span>✓ COPIED! REDIRECTING...</span>
                </>
              ) : (
                <>
                  <span>COPY CODE & SHOP NOW</span>
                  <span className="text-sm">→</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriftModePopup;
