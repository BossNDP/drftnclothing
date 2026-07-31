'use client';

/**
 * AnnouncementTicker — Option A: Rotating single-message ticker
 *
 * One centered value-prop displayed at a time.
 * Crossfades + slides to the next message every 3.5 seconds.
 * A thin amber progress bar fills left-to-right and resets on each rotation —
 * gives a pacing indicator so the transition never feels random or glitchy.
 *
 * Messages are kept 1:1 with the old marquee content (COD, free shipping,
 * Born in Yelahanka, etc.) — only the presentation mechanism changes.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDriftMode } from '@/context/DriftModeContext';
import TopBanner from './TopBanner';

/* ─── Ticker messages ─────────────────────────────────────────────────── */
const MESSAGES = [
  { label: 'FREE COD AVAILABLE', detail: 'Cash on delivery across India' },
  { label: 'FREE SHIPPING', detail: 'On all orders across India' },
  { label: 'SHOP ABOVE ₹999', detail: 'Get ₹100 OFF at checkout' },
];

const DURATION = 3500; // ms per message

/* ─── Progress bar animation key trick ───────────────────────────────── */
// Increment a key on each rotation so React remounts the bar,
// restarting the CSS animation cleanly without a JS timer.

/* ─── Variants ────────────────────────────────────────────────────────── */
const msgVariants = {
  enter: { opacity: 0, y: 8 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.28, ease: 'easeIn' as const },
  },
};

/* ─── Component ───────────────────────────────────────────────────────── */
export default function AnnouncementTicker() {
  const { isActive } = useDriftMode();
  const [idx, setIdx] = useState(0);
  const [barKey, setBarKey] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const containerRef = React.useRef<HTMLElement>(null);

  if (isActive) {
    return <TopBanner />;
  }

  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    const el = containerRef.current;

    const start = () => {
      setIsRunning(true);
      if (!t && !document.hidden) {
        t = setInterval(() => {
          setIdx((p) => (p + 1) % MESSAGES.length);
          setBarKey((k) => k + 1);
        }, DURATION);
      }
    };

    const stop = () => {
      setIsRunning(false);
      if (t) {
        clearInterval(t);
        t = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    if (typeof IntersectionObserver !== 'undefined' && el) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) start();
          else stop();
        },
        { threshold: 0.1 }
      );
      observer.observe(el);
      return () => {
        stop();
        observer.disconnect();
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    } else {
      start();
      return () => {
        stop();
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, []);

  const msg = MESSAGES[idx];

  return (
    <section
      ref={containerRef}
      className="w-full bg-black h-6 border-b border-zinc-900 flex items-center justify-center relative select-none overflow-hidden"
      aria-label="Announcement"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Dot nav — left side */}
      <div
        className="absolute left-3 inset-y-0 flex items-center gap-1 z-10"
        aria-hidden="true"
      >
        {MESSAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => { setIdx(i); setBarKey((k) => k + 1); }}
            className={`w-1 rounded-full transition-all duration-300 ${i === idx
                ? 'h-2 bg-brand-offwhite'
                : 'h-1 bg-brand-stone/30 hover:bg-brand-stone/60'
              }`}
            aria-label={`Go to message ${i + 1}`}
          />
        ))}
      </div>

      {/* Message area */}
      <div className="flex items-center justify-center px-8 h-full relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            variants={msgVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex items-center gap-2 text-center"
          >
            <span className="font-mono text-[10px] font-medium tracking-widest text-zinc-300 uppercase leading-none">
              {msg.label}
            </span>

            {/* Divider — simple vertical line */}
            <span className="hidden sm:inline-block text-zinc-700 font-mono text-[10px]" aria-hidden="true">•</span>

            <span className="text-zinc-400 text-[10px] tracking-wider uppercase font-mono hidden sm:inline leading-none">
              {msg.detail}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar — fills left-to-right, resets on each rotation */}
      <div className="absolute bottom-0 inset-x-0 h-[1.5px] bg-zinc-900 overflow-hidden" aria-hidden="true">
        <div
          key={barKey}
          className="h-full bg-white/20 origin-left animate-ticker-progress"
          style={{ animationPlayState: isRunning ? 'running' : 'paused' }}
        />
      </div>
    </section>
  );
}
