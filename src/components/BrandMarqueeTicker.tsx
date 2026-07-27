'use client';

import React, { useEffect, useState, useRef } from 'react';

const MARQUEE_ITEMS = [
  'HEAVYWEIGHT COTTON',
  'SMALL BATCH',
  'BUILT IN BENGALURU',
  'DROP 02',
  'LIMITED QUANTITIES',
  '300+ GSM FABRIC',
];

export default function BrandMarqueeTicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let isVisible = true;
    let isTabActive = typeof document !== 'undefined' ? !document.hidden : true;

    const updateState = () => {
      setIsPlaying(isVisible && isTabActive);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        updateState();
      },
      { threshold: 0.05 }
    );
    observer.observe(el);

    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
      updateState();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const repeatedItems = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden border-y border-white/10 bg-zinc-950/90 py-3 relative z-20 backdrop-blur-md select-none"
    >
      <div
        className="flex w-max animate-marquee-continuous whitespace-nowrap"
        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
      >
        {repeatedItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 px-4">
            <span className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.25em] uppercase text-zinc-300">
              {item}
            </span>
            <span className="text-zinc-600 text-xs">•</span>
          </div>
        ))}
      </div>
    </div>
  );
}
