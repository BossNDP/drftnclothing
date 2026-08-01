'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

const PHRASES = [
  { text: 'LIVE', fontSize: 'text-[11px] sm:text-[12px] tracking-widest' },
  { text: 'DRIFT WITH US', fontSize: 'text-[8.5px] sm:text-[9.5px] tracking-wider' },
  { text: '20% OFF', fontSize: 'text-[11px] sm:text-[12px] tracking-widest' },
];

export default function SaleLiveBadge() {
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState<'in' | 'out'>('in');
  const [isTabActive, setIsTabActive] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const isExcluded = pathname?.startsWith('/admin') || pathname === '/checkout';

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, []);

  // Pause cycle when user switches browser tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Text crossfade cycle timer (hold 2.6s, fade out 0.4s, swap, fade in 0.4s)
  useEffect(() => {
    if (isExcluded || prefersReducedMotion || !isTabActive) return;

    const interval = setInterval(() => {
      setFade('out');

      setTimeout(() => {
        setIndex((prev) => (prev + 1) % PHRASES.length);
        setFade('in');
      }, 400);
    }, 3000);

    return () => clearInterval(interval);
  }, [isExcluded, prefersReducedMotion, isTabActive]);

  if (isExcluded) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('open-drift-popup'));
  };

  const currentPhrase = PHRASES[index];

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Sale is Live - View Drift Mode Offer"
      className="fixed bottom-20 left-4 sm:bottom-8 sm:left-6 z-[2400] w-[64px] h-[64px] sm:w-[68px] sm:h-[68px] bg-[#0A0A0A] border border-zinc-800 hover:border-zinc-600 rounded-full shadow-2xl shadow-black/80 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center p-2 cursor-pointer select-none group shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
    >
      {/* ── Centered Crossfading Text Container ── */}
      <div className="w-full flex items-center justify-center pointer-events-none px-1 overflow-hidden">
        <span
          className={`font-mono font-bold uppercase text-white text-center leading-tight transition-opacity duration-400 ease-in-out ${
            currentPhrase.fontSize
          } ${fade === 'in' ? 'opacity-100' : 'opacity-0'}`}
        >
          {currentPhrase.text}
        </span>
      </div>
    </button>
  );
}
