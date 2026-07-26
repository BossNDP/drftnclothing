'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthSession } from '@/context/AuthContext';
import { X, Smartphone } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginIncentivePopup() {
  const { isSignedIn, isLoaded, openAuthModal } = useAuthSession();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [offerText, setOfferText] = useState('GET 10% OFF YOUR FIRST ORDER');
  const [isPushPromptOpen, setIsPushPromptOpen] = useState(false);

  const isAllowedPage = pathname === '/' || pathname === '/shop';

  useEffect(() => { setMounted(true); }, []);

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Auto-close when user signs in
  useEffect(() => {
    if (isSignedIn && isOpen) setIsOpen(false);
  }, [isSignedIn, isOpen]);

  // Fetch active promo discount
  useEffect(() => {
    if (!isAllowedPage || isSignedIn) return;
    const fetchDiscount = async () => {
      try {
        const res = await fetch('/api/auth/signup-discount');
        if (res.ok) {
          const data = await res.json();
          if (data.type === 'percent') setOfferText(`GET ${data.value}% OFF YOUR FIRST ORDER`);
          else setOfferText(`GET ₹${(data.value / 100).toFixed(0)} OFF YOUR FIRST ORDER`);
        }
      } catch { /* ignore */ }
    };
    fetchDiscount();
  }, [pathname, isSignedIn, isAllowedPage]);

  // Detect if push notification prompt is open (avoid stacking popups)
  useEffect(() => {
    if (!isAllowedPage || isSignedIn) return;
    const checkPushPrompt = () => {
      const elements = document.getElementsByTagName('h4');
      let found = false;
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].textContent === 'Get Notified') { found = true; break; }
      }
      setIsPushPromptOpen(found);
    };
    checkPushPrompt();
    const timer = setTimeout(checkPushPrompt, 1000);
    return () => clearTimeout(timer);
  }, [isAllowedPage, isSignedIn]);

  // Show after 15 seconds or when scrolled 40% into page (via IntersectionObserver sentinel)
  useEffect(() => {
    if (!isAllowedPage || !isLoaded || isSignedIn) return;
    if (sessionStorage.getItem('login_incentive_dismissed') === 'true') return;

    let timer: NodeJS.Timeout;
    let shown = false;

    const showPopup = () => {
      if (shown || isPushPromptOpen) return;
      shown = true;
      setIsOpen(true);
      clearTimeout(timer);
    };

    timer = setTimeout(showPopup, 15000);

    // Create a virtual sentinel element at 40% height of page or use IntersectionObserver on page container
    let observer: IntersectionObserver | null = null;
    const targetEl = document.getElementById('hero-scene') || document.querySelector('main') || document.body;

    if (typeof IntersectionObserver !== 'undefined' && targetEl) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // Trigger when top section scrolls 40% out of view
            if (!entry.isIntersecting || entry.intersectionRatio < 0.6) {
              showPopup();
            }
          });
        },
        { threshold: [0, 0.6] }
      );
      observer.observe(targetEl);
    }

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [isAllowedPage, isLoaded, isSignedIn, isPushPromptOpen]);

  // Escape key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) handleDismiss(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleDismiss = () => {
    sessionStorage.setItem('login_incentive_dismissed', 'true');
    setIsOpen(false);
  };

  const handlePhoneContinue = () => {
    handleDismiss();
    openAuthModal('phone');
  };

  const handleGoogleContinue = () => {
    handleDismiss();
    openAuthModal('google');
  };

  return (
    <>
      {isOpen && (
        <style dangerouslySetInnerHTML={{
          __html: `div.fixed.bottom-24.left-4.right-4.md\\:left-1\\/2 { display: none !important; }`
        }} />
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleDismiss}
              style={{ zIndex: 99990 }}
              className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[420px] bg-zinc-950 border border-white/10 p-6 md:p-8 flex flex-col items-center gap-6 shadow-[0_0_80px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto"
                style={{ boxShadow: '0 0 40px rgba(255,255,255,0.07)' }}
              >
                {/* Close */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-2 right-2 text-zinc-500 hover:text-white transition-colors w-12 h-12 flex items-center justify-center cursor-pointer z-50"
                  aria-label="Dismiss offer"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Logo */}
                <div className="relative w-64 md:w-72 h-14 select-none flex items-center justify-center">
                  <img
                    src="/logo.png?v=3"
                    alt="DRFTN"
                    className="object-contain w-full h-full grayscale brightness-[100]"
                  />
                </div>

                {/* Offer copy */}
                <div className="text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-zinc-500 font-mono">
                    Exclusive Drop Offer
                  </span>
                  <h2 className="text-lg md:text-xl font-black uppercase text-white tracking-widest leading-snug">
                    {offerText}
                  </h2>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider leading-relaxed font-light">
                    Join the drop list for early access, restock alerts &amp; exclusive member pricing.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="w-full space-y-3">
                  <button
                    onClick={handlePhoneContinue}
                    className="w-full bg-white hover:bg-zinc-200 text-black py-4 font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    Continue with Phone
                  </button>

                  <div className="relative text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <span className="relative bg-zinc-950 px-3 text-[9px] uppercase tracking-widest font-mono text-zinc-500">
                      Or
                    </span>
                  </div>

                  <button
                    onClick={handleGoogleContinue}
                    className="w-full bg-transparent hover:bg-white/5 text-white border border-white/10 py-3.5 font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Continue with Google
                  </button>
                </div>

                <p className="text-center text-[9px] text-zinc-600 uppercase tracking-widest font-mono leading-relaxed">
                  By continuing you agree to our{' '}
                  <a href="/policies/terms-and-conditions" target="_blank" className="text-zinc-400 underline">Terms</a>
                  {' '}&amp;{' '}
                  <a href="/policies/privacy-policy" target="_blank" className="text-zinc-400 underline">Privacy Policy</a>
                </p>

                <button
                  onClick={handleDismiss}
                  className="text-[10px] text-zinc-600 underline uppercase tracking-widest hover:text-white font-mono transition-colors cursor-pointer"
                >
                  Maybe later
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
