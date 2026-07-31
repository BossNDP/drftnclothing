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

  const repeatCount = 6;
  const items = Array.from({ length: repeatCount });

  return (
    <div
      ref={containerRef}
      aria-label="Drift Mode Announcement"
      className="relative w-full bg-black h-7 border-b border-zinc-900 text-white flex items-center overflow-hidden select-none z-40"
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
        @keyframes dotPulse {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-drift-marquee {
          display: inline-flex;
          white-space: nowrap;
          will-change: transform;
          animation: driftMarquee 70s linear infinite;
        }
        .animate-dot-pulse {
          animation: dotPulse 1.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-drift-marquee {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <div
        className="animate-drift-marquee text-[10px] sm:text-[11px] font-mono tracking-[0.12em] uppercase font-bold text-white"
        style={{
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        <div className="inline-flex items-center">
          {items.map((_, i) => (
            <span key={`a-${i}`} className="inline-flex items-center mx-4">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-dot-pulse mr-2.5" />
              <span>DRIFT MODE: ON</span>
              <span className="mx-3 text-zinc-600 font-normal">•</span>
              <span>FLAT {discountPercent}% OFF YOUR FIRST ORDER</span>
              <span className="mx-3 text-zinc-600 font-normal">•</span>
              <span>FREE SHIPPING & COD ACROSS INDIA</span>
              <span className="mx-3 text-zinc-600 font-normal">•</span>
            </span>
          ))}
        </div>
        <div className="inline-flex items-center">
          {items.map((_, i) => (
            <span key={`b-${i}`} className="inline-flex items-center mx-4">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-dot-pulse mr-2.5" />
              <span>DRIFT MODE: ON</span>
              <span className="mx-3 text-zinc-600 font-normal">•</span>
              <span>FLAT {discountPercent}% OFF YOUR FIRST ORDER</span>
              <span className="mx-3 text-zinc-600 font-normal">•</span>
              <span>FREE SHIPPING & COD ACROSS INDIA</span>
              <span className="mx-3 text-zinc-600 font-normal">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopBanner;
