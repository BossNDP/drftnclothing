'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDriftMode } from '@/context/DriftModeContext';
import { useAuthSession } from '@/context/AuthContext';
import { X } from 'lucide-react';

const DISMISS_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours

export const DriftModePopup: React.FC = () => {
  const { isActive, discountPercent, userCode, codeUsed, fetchOrCreateUserCode } = useDriftMode();
  const { isSignedIn, openAuthModal } = useAuthSession();

  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  const closePopup = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleDismiss = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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

  const handleSignInClick = useCallback(() => {
    closePopup();
    setTimeout(() => {
      openAuthModal('phone');
    }, 200);
  }, [closePopup, openAuthModal]);

  const copyCodeOnly = useCallback(() => {
    if (!userCode) return;
    navigator.clipboard.writeText(userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [userCode]);

  useEffect(() => {
    if (!isActive || codeUsed) return;

    try {
      const dismissedAt = localStorage.getItem('drftn_drift_popup_dismissed');
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < DISMISS_TTL_MS) {
          // Can show for testing
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
  }, [isOpen, isSignedIn, userCode, fetchOrCreateUserCode]);

  // Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  if (!isOpen || !isActive || codeUsed) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleDismiss(e);
        }
      }}
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 text-white border border-zinc-800 rounded-2xl p-6 md:p-8 w-full max-w-[400px] relative font-sans shadow-2xl overflow-hidden my-auto select-none"
      >
        {/* Subtle Ambient Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-black pointer-events-none" />

        {/* High Priority Close × Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close Offer"
          className="absolute top-4 right-4 z-50 text-zinc-400 hover:text-white transition-colors w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700/80 flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content Body */}
        <div className="relative z-10 flex flex-col items-start text-left pt-2">
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
              <div className="bg-zinc-900/90 border border-dashed border-zinc-700 rounded-xl p-3 flex items-center justify-between font-mono font-bold text-sm tracking-[0.18em] text-white">
                <span className="select-all text-white font-mono">{userCode || 'DRFTNMODEON20'}</span>

                <button
                  type="button"
                  onClick={copyCodeOnly}
                  className="bg-zinc-800 hover:bg-white hover:text-black text-white transition-colors px-2.5 py-1.5 rounded text-[10px] font-mono tracking-widest uppercase border border-zinc-700 flex items-center gap-1 cursor-pointer"
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
              <button
                type="button"
                onClick={handleSignInClick}
                className="w-full bg-white hover:bg-zinc-200 text-black py-3.5 px-5 text-xs font-mono font-extrabold tracking-[0.18em] uppercase transition-colors rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>SIGN IN TO CLAIM {discountPercent}% OFF</span>
                <span className="text-sm">→</span>
              </button>
            </div>
          )}

          {/* Single Primary Action CTA Button for Signed In */}
          {isSignedIn && (
            <button
              type="button"
              onClick={handleCopyAndShop}
              className="w-full bg-white hover:bg-zinc-200 text-black py-3.5 px-6 text-xs font-mono font-extrabold tracking-[0.2em] uppercase transition-colors rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <span>✓ COPIED! REDIRECTING...</span>
              ) : (
                <>
                  <span>SHOP THE COLLECTION</span>
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
