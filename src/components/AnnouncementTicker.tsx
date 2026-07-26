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

/* ─── Ticker messages ─────────────────────────────────────────────────── */
const MESSAGES = [
  { label: 'COD Available', detail: 'Cash on delivery across India' },
  { label: 'Free Shipping', detail: 'On all orders above ₹999' },
  { label: 'Born in Yelahanka', detail: 'Bengaluru\'s own streetwear label' },
  { label: 'Zero Compromise', detail: 'Heavyweight unisex apparel' },
  { label: 'Easy Returns', detail: '7-day hassle-free exchange' },
  { label: 'Industrial Minimalism', detail: 'Drop-shoulder. Raw DNA.' },
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
  const [idx, setIdx] = useState(0);
  const [barKey, setBarKey] = useState(0);
  const containerRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    const el = containerRef.current;

    const start = () => {
      if (!t && !document.hidden) {
        t = setInterval(() => {
          setIdx((p) => (p + 1) % MESSAGES.length);
          setBarKey((k) => k + 1);
        }, DURATION);
      }
    };

    const stop = () => {
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
      className="relative border-y border-[#2A2A2A] bg-brand-black select-none overflow-hidden"
      aria-label="Announcement"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Dot nav — left side */}
      <div
        className="absolute left-4 sm:left-5 inset-y-0 flex items-center gap-1 sm:gap-1.5 z-10"
        aria-hidden="true"
      >
        {MESSAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => { setIdx(i); setBarKey((k) => k + 1); }}
            className={`w-1 rounded-full transition-all duration-300 ${i === idx
                ? 'h-3.5 bg-brand-offwhite'
                : 'h-1 bg-brand-stone/30 hover:bg-brand-stone/60'
              }`}
            aria-label={`Go to message ${i + 1}`}
          />
        ))}
      </div>

      {/* Message area */}
      <div className="flex items-center justify-center py-3 px-10 sm:px-20 min-h-[44px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            variants={msgVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex items-center gap-2.5 sm:gap-3.5 text-center"
          >
            <span className="font-display uppercase text-brand-offwhite text-[8.5px] sm:text-[11px] tracking-[0.22em] sm:tracking-[0.4em] leading-none font-bold">
              {msg.label}
            </span>

            {/* Divider — simple vertical line */}
            <span className="hidden sm:inline-block text-zinc-700 font-mono text-xs" aria-hidden="true">|</span>

            <span className="text-brand-stone text-[9px] sm:text-[10px] tracking-[0.25em] uppercase font-body hidden sm:inline">
              {msg.detail}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar — fills left-to-right, resets on each rotation */}
      <div className="absolute bottom-0 inset-x-0 h-[2px] bg-brand-graphite overflow-hidden" aria-hidden="true">
        <div
          key={barKey}
          className="h-full bg-brand-offwhite/20 origin-left animate-ticker-progress"
        />
      </div>

      {/* Edge fade-outs so content doesn't hard-cut at screen edge */}
      <div
        className="absolute inset-y-0 left-0 w-12 sm:w-20 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,1) 0%, transparent 100%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 right-0 w-12 sm:w-20 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to left, rgba(0,0,0,1) 0%, transparent 100%)' }}
        aria-hidden="true"
      />
    </section>
  );
}
