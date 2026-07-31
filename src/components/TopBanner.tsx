'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDriftMode } from '@/context/DriftModeContext';

export const TopBanner: React.FC = () => {
  const { isActive, discountPercent } = useDriftMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    // IntersectionObserver to pause animation when banner is scrolled out of view
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

    // Page Visibility API to pause animation when tab is inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  if (!isActive) return null;

  const marqueeMessage = `DRIFT MODE: ON | ${discountPercent}% OFF YOUR FIRST ORDER | FREE SHIPPING | COD AVAILABLE | `;

  return (
    <div
      ref={containerRef}
      aria-label="Drift Mode Announcement"
      className="relative w-full bg-black border-b border-[#1a1a1a] text-white overflow-hidden select-none z-40 py-2"
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
          animation: driftMarquee 36s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-drift-marquee {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <div
        className="animate-drift-marquee text-[11px] font-mono tracking-[0.2em] uppercase font-bold text-zinc-200"
        style={{
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        <span>{marqueeMessage.repeat(6)}</span>
        <span>{marqueeMessage.repeat(6)}</span>
      </div>
    </div>
  );
};

export default TopBanner;
