'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDriftMode } from '@/context/DriftModeContext';

export const TopBanner: React.FC = () => {
  const { isActive, discountPercent } = useDriftMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsPaused(!entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const handleVisibilityChange = () => {
      setIsPaused(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  if (!isActive) return null;

  const item = `DRIFT MODE ACTIVE • FLAT ${discountPercent}% OFF FIRST ORDER • FREE SHIPPING & COD ACROSS INDIA • `;

  return (
    <div
      ref={containerRef}
      aria-label="Drift Mode Announcement"
      className="relative w-full bg-black h-6 border-b border-zinc-900 text-white flex items-center overflow-hidden select-none z-40"
    >
      <style jsx>{`
        @keyframes driftMarquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .animate-drift-marquee {
          display: inline-flex;
          white-space: nowrap;
          will-change: transform;
          animation: driftMarquee 90s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-drift-marquee {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <div
        className="animate-drift-marquee text-[10px] font-mono tracking-[0.25em] uppercase font-medium text-zinc-300"
        style={{
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        <span>{item.repeat(8)}</span>
        <span>{item.repeat(8)}</span>
      </div>
    </div>
  );
};

export default TopBanner;
