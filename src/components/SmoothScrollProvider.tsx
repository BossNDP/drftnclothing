'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface SmoothScrollProviderProps {
  children: React.ReactNode;
}

export default function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    // Detect if primary pointer is coarse (mobile touch)
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    // Initialize Lenis smooth scroll engine with autoRaf so RAF sleeps when idle
    const lenis = new Lenis({
      autoRaf: true,
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.0,
      wheelMultiplier: 1.0,
      infinite: false,
    });

    // Synchronize Lenis scroll updates with GSAP ScrollTrigger only when scroll moves
    lenis.on('scroll', (e) => {
      ScrollTrigger.update();
      window.dispatchEvent(
        new CustomEvent('drftn-scroll', {
          detail: { scrollY: e.scroll, direction: e.direction },
        })
      );
    });

    // Smooth scroll for anchor links (#collections, #hero-scene, etc.)
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.hash && anchor.hash.startsWith('#')) {
        const targetEl = document.querySelector(anchor.hash);
        if (targetEl) {
          e.preventDefault();
          lenis.scrollTo(targetEl as HTMLElement, { offset: 0, duration: 1.0 });
        }
      }
    };
    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      lenis.destroy();
    };
  }, []);

  // Clean up & refresh ScrollTrigger instances on Next.js page route changes to prevent progressive lag
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Small timeout to allow DOM to render new page components before refresh
      const timer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return <>{children}</>;
}

