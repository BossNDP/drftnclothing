'use client';

import React, { useRef, useEffect } from 'react';
import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Product } from '@/types';
import DRFTNButton from '@/components/DRFTNButton';

interface HeroHoodieSceneProps {
  products?: Product[];
}

export default function HeroHoodieScene({ products }: HeroHoodieSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const heroWrapperRef = useRef<HTMLDivElement>(null);
  const heroImageWrapperRef = useRef<HTMLDivElement>(null);
  const hoodieLightRef = useRef<HTMLDivElement>(null);
  const hoodieDarkRef = useRef<HTMLDivElement>(null);
  const lightSweepRef = useRef<HTMLDivElement>(null);
  
  const textBlockRef = useRef<HTMLDivElement>(null);
  const subheadingRef = useRef<HTMLDivElement>(null);
  const headlineBlockRef = useRef<HTMLDivElement>(null);
  const headlineLine1Ref = useRef<HTMLHeadingElement>(null);
  const headlineLine2Ref = useRef<HTMLHeadingElement>(null);
  const ctaContainerRef = useRef<HTMLDivElement>(null);
  const primaryCtaRef = useRef<HTMLDivElement>(null);
  const secondaryCtaRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  
  const dot1Ref = useRef<HTMLDivElement>(null);
  const dot2Ref = useRef<HTMLDivElement>(null);

  // Performance guards (eliminate continuous per-frame DOM re-assignments)
  const isBlackRef = useRef<boolean | null>(null);
  const textClampStateRef = useRef<'visible' | 'hidden' | 'fading' | null>(null);
  const cueClampStateRef = useRef<'visible' | 'hidden' | 'fading' | null>(null);
  const lastLightPRef = useRef<number>(-1);
  const lastCropPRef = useRef<number>(-1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Configure GSAP & ScrollTrigger settings
    gsap.registerPlugin(ScrollTrigger);

    const containerEl = containerRef.current;
    const pinnedEl = pinnedRef.current;
    const hoodieDarkEl = hoodieDarkRef.current;

    if (!containerEl || !pinnedEl) return;

    const ctx = gsap.context(() => {
      // 1. Load-in Entrance Sequence (Plain GSAP timeline, no scrub)
      const entranceTl = gsap.timeline({
        defaults: { ease: 'power3.out' },
      });

      // Fixed initial scale for hoodie (no bounce/scale shifts)
      if (heroImageWrapperRef.current) {
        entranceTl.fromTo(
          heroImageWrapperRef.current,
          { scale: 1.0 },
          { scale: 1.0, duration: 0.1 },
          0
        );
      }

      // Subheading Label Fade & Subtle Motion
      if (subheadingRef.current) {
        entranceTl.fromTo(
          subheadingRef.current,
          { opacity: 0.85, y: 6 },
          { opacity: 1, y: 0, duration: 0.4 },
          0.1
        );
      }

      // Headline Text Mask Reveal
      if (headlineBlockRef.current) {
        entranceTl.fromTo(
          headlineBlockRef.current,
          { opacity: 0.9, y: 8 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
          0.15
        );
      }

      // Headline Line 1 & Line 2 Clipped Mask Reveal (translateY 100% -> 0%)
      const lines = [headlineLine1Ref.current, headlineLine2Ref.current].filter(Boolean);
      if (lines.length > 0) {
        entranceTl.fromTo(
          lines,
          { y: '100%' },
          { y: '0%', duration: 0.7, stagger: 0.08, ease: 'power3.out' },
          0.45
        );
      }

      // CTAs Fade + translateY(20px -> 0)
      if (ctaContainerRef.current) {
        const ctaBtns = ctaContainerRef.current.children;
        entranceTl.fromTo(
          ctaBtns,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
          0.65
        );
      }

      // Scroll Cue Indicator Fade In
      if (scrollIndicatorRef.current) {
        entranceTl.fromTo(
          scrollIndicatorRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5 },
          0.85
        );
      }

      // 2. Pinned Master Scroll Scrub Sequence (Optimized: zero React state updates, threshold-guarded DOM mutations)
      ScrollTrigger.create({
        trigger: containerEl,
        start: 'top top',
        end: 'bottom bottom',
        pin: pinnedEl,
        scrub: 1.0,
        fastScrollEnd: true,
        preventOverlaps: true,
        onUpdate: (self) => {
          const p = self.progress;

          // Hoodie scale remains fixed (no bounce/scale distortion)
          if (heroImageWrapperRef.current) {
            gsap.set(heroImageWrapperRef.current, { scale: 1.0 });
          }

          // Outfit color shift material progress: -20% to 130% (White -> Black Hoodie)
          if (hoodieDarkEl) {
            const matProgress = -20 + p * 150;
            hoodieDarkEl.style.setProperty('--material-progress', `${matProgress}%`);
          }

          // Scroll-Driven Ambient Light Sweep — position-only update (GPU-composited, no repaint)
          if (lightSweepRef.current && Math.abs(p - lastLightPRef.current) > 0.005) {
            lastLightPRef.current = p;
            // Move the pre-baked radial gradient using transform instead of repainting background
            const lightX = Math.round((p * 60) * 10) / 10;
            const lightY = Math.round((p * 40) * 10) / 10;
            gsap.set(lightSweepRef.current, { xPercent: lightX, yPercent: lightY });
          }

          // Progress Indicator Dots Highlight (Guarded: runs ONLY when crossing 0.45 threshold)
          const isBlack = p > 0.45;
          if (isBlackRef.current !== isBlack) {
            isBlackRef.current = isBlack;
            if (dot1Ref.current && dot2Ref.current) {
              if (isBlack) {
                dot1Ref.current.className = 'w-1.5 h-2 rounded-full bg-white/30 transition-all duration-300';
                dot2Ref.current.className = 'w-1.5 h-6 rounded-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)]';
              } else {
                dot1Ref.current.className = 'w-1.5 h-6 rounded-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)]';
                dot2Ref.current.className = 'w-1.5 h-2 rounded-full bg-white/30 transition-all duration-300';
              }
            }
          }

          // Text block stays permanently visible (does NOT fade out on scroll)
          if (textBlockRef.current) {
            gsap.set(textBlockRef.current, {
              opacity: 1,
              y: 0,
              visibility: 'visible',
              pointerEvents: 'auto',
            });
          }

          // Scroll cue indicator scrub: fade out early (0 -> 12% scroll distance) (Guarded)
          if (scrollIndicatorRef.current) {
            if (p <= 0) {
              if (cueClampStateRef.current !== 'visible') {
                cueClampStateRef.current = 'visible';
                gsap.set(scrollIndicatorRef.current, {
                  opacity: 1,
                  visibility: 'visible',
                  pointerEvents: 'auto',
                });
              }
            } else if (p >= 0.12) {
              if (cueClampStateRef.current !== 'hidden') {
                cueClampStateRef.current = 'hidden';
                gsap.set(scrollIndicatorRef.current, {
                  opacity: 0,
                  visibility: 'hidden',
                  pointerEvents: 'none',
                });
              }
            } else {
              cueClampStateRef.current = 'fading';
              const cueProgress = p / 0.12;
              const cueOpacity = Math.max(0, 1 - cueProgress);
              gsap.set(scrollIndicatorRef.current, {
                opacity: cueOpacity,
                visibility: cueOpacity <= 0.01 ? 'hidden' : 'visible',
                pointerEvents: cueOpacity < 0.1 ? 'none' : 'auto',
              });
            }
          }
        },
      });

      // 3. Desktop Cursor-Reactive Hero Model Parallax
      if (window.innerWidth >= 768 && heroImageWrapperRef.current) {
        const xTo = gsap.quickTo(heroImageWrapperRef.current, 'x', { duration: 0.8, ease: 'power2.out' });
        const yTo = gsap.quickTo(heroImageWrapperRef.current, 'y', { duration: 0.8, ease: 'power2.out' });

        const handleParallax = (e: MouseEvent) => {
          const { innerWidth, innerHeight } = window;
          const xOffset = (e.clientX - innerWidth / 2) * -0.012;
          const yOffset = (e.clientY - innerHeight / 2) * -0.012;
          xTo(xOffset);
          yTo(yOffset);
        };

        window.addEventListener('mousemove', handleParallax, { passive: true });
      }

      // 4. Mobile Gyroscope Tilt Parallax (clamped hard)
      if (window.innerWidth < 768 && 'DeviceOrientationEvent' in window) {
        const handleTilt = (e: DeviceOrientationEvent) => {
          if (e.gamma === null || e.beta === null) return;
          const tiltX = Math.max(-12, Math.min(12, e.gamma)) * 0.25;
          const tiltY = Math.max(-12, Math.min(12, e.beta - 45)) * 0.25;
          if (heroImageWrapperRef.current) {
            gsap.set(heroImageWrapperRef.current, { x: tiltX, y: tiltY });
          }
        };

        window.addEventListener('deviceorientation', handleTilt, { passive: true });
      }

      // 5. Magnetic Hover Effect on CTAs
      const attachMagnetic = (btnEl: HTMLElement | null) => {
        if (!btnEl) return;
        const handleMouseMove = (e: MouseEvent) => {
          const rect = btnEl.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const deltaX = (e.clientX - centerX) * 0.18;
          const deltaY = (e.clientY - centerY) * 0.18;
          gsap.to(btnEl, {
            x: deltaX,
            y: deltaY,
            scale: 1.02,
            duration: 0.3,
            ease: 'power2.out',
          });
        };
        const handleMouseLeave = () => {
          gsap.to(btnEl, {
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.5,
            ease: 'power2.out',
          });
        };

        btnEl.addEventListener('mousemove', handleMouseMove);
        btnEl.addEventListener('mouseleave', handleMouseLeave);

        return () => {
          btnEl.removeEventListener('mousemove', handleMouseMove);
          btnEl.removeEventListener('mouseleave', handleMouseLeave);
        };
      };

      const cleanPrimary = attachMagnetic(primaryCtaRef.current);
      const cleanSecondary = attachMagnetic(secondaryCtaRef.current);

      return () => {
        if (cleanPrimary) cleanPrimary();
        if (cleanSecondary) cleanSecondary();
      };
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      id="hero-scene"
      className="relative w-full bg-black select-none h-[160vh]"
    >
      <div
        ref={pinnedRef}
        className="sticky top-0 w-full h-[100dvh] overflow-hidden bg-black"
      >
        <div
          ref={heroWrapperRef}
          className="relative w-full h-full overflow-hidden bg-black"
        >
          {/* Full-Bleed Model Image Viewport (Initial Crop-and-Reveal scale: 1.18 -> 1.0 on scroll) */}
          <div
            ref={heroImageWrapperRef}
            className="absolute inset-0 w-full h-full overflow-hidden transform-gpu"
            style={{ transformOrigin: '75% 20%' }}
          >
            {/* Background image (bg.png) behind hoodie — dimmed for maximum text & garment contrast */}
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <Image
                src="/bg.jpg"
                alt="Hero Background"
                fill
                priority
                fetchPriority="high"
                sizes="100vw"
                quality={75}
                className="object-cover object-center brightness-[0.55] contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* White Base Outfit Layer */}
            <div
              ref={hoodieLightRef}
              className="absolute inset-0 w-full h-full z-1"
            >
              {/* Mobile Viewport Outfit Photo */}
              <div className="relative w-full h-full md:hidden">
                <Image
                  src="/mobilewhite-mobile.webp"
                  alt="DRFTN Full-Body Outfit — White Edition"
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(max-width: 767px) 100vw, 750px"
                  quality={80}
                  className="object-cover object-[75%_20%] filter contrast-[1.02]"
                />
              </div>
              {/* Desktop Viewport Original Hoodie Graphic */}
              <div className="relative w-full h-full hidden md:flex items-center justify-center p-8 md:p-16">
                <Image
                  src="/hero/hoodie-light.webp"
                  alt="DRFTN Stitch Hoodie — White Edition"
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 768px) 100vw, 1200px"
                  quality={80}
                  className="object-contain filter drop-shadow-[0_24px_60px_rgba(0,0,0,0.9)] max-w-4xl mx-auto"
                />
              </div>
            </div>

            {/* Black Outfit Layer with Soft Mask Wipe */}
            <div
              ref={hoodieDarkRef}
              className="absolute inset-0 w-full h-full bg-transparent pointer-events-none z-10"
              style={{
                WebkitMaskImage:
                  'linear-gradient(180deg, #000 0%, #000 var(--material-progress, -20%), transparent calc(var(--material-progress, -20%) + 25%), transparent 100%)',
                maskImage:
                  'linear-gradient(180deg, #000 0%, #000 var(--material-progress, -20%), transparent calc(var(--material-progress, -20%) + 25%), transparent 100%)',
              }}
            >
              {/* Mobile Viewport Outfit Photo */}
              <div className="relative w-full h-full md:hidden">
                <Image
                  src="/mobileblack-mobile.webp"
                  alt="DRFTN Full-Body Outfit — Black Edition"
                  fill
                  sizes="(max-width: 767px) 100vw, 750px"
                  quality={80}
                  className="object-cover object-[75%_20%] filter contrast-[1.02]"
                />
              </div>
              {/* Desktop Viewport Original Hoodie Graphic */}
              <div className="relative w-full h-full hidden md:flex items-center justify-center p-8 md:p-16">
                <Image
                  src="/hero/hoodie-dark.webp"
                  alt="DRFTN Stitch Hoodie — Black Edition"
                  fill
                  sizes="(min-width: 768px) 100vw, 1200px"
                  quality={80}
                  className="object-contain filter drop-shadow-[0_24px_60px_rgba(0,0,0,0.95)] max-w-4xl mx-auto"
                />
              </div>
            </div>

            {/* Scroll-Driven Ambient Light Sweep Glint Overlay (z-14) — fixed gradient, position-only animation */}
            <div
              ref={lightSweepRef}
              className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 pointer-events-none z-14 opacity-[0.11] mix-blend-overlay transform-gpu"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.85) 0%, transparent 45%)',
                willChange: 'transform',
              }}
              aria-hidden="true"
            />

            {/* Stronger Radial Studio Vignette (rgba(0,0,0,0.55) edges) */}
            <div
              className="absolute inset-0 pointer-events-none z-12 bg-[radial-gradient(circle_at_70%_35%,transparent_35%,rgba(0,0,0,0.55)_100%)]"
              aria-hidden="true"
            />

            {/* Natural Scrim Gradient Overlays for Pure Editorial Text Contrast */}
            <div
              className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-15"
              aria-hidden="true"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-[55%] md:h-[45%] bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none z-15"
              aria-hidden="true"
            />
          </div>

          {/* Colorway Sequence Progress Dots (Shifted Right to `right-2 sm:right-3 md:right-4`, z-35) */}
          <div
            className="absolute right-2 sm:right-3 md:right-4 bottom-24 md:bottom-28 z-35 flex flex-col items-center gap-2 pointer-events-none"
            aria-hidden="true"
          >
            <div ref={dot1Ref} className="w-1.5 h-6 rounded-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            <div ref={dot2Ref} className="w-1.5 h-2 rounded-full bg-white/30 transition-all duration-300" />
          </div>

          {/* Hero Copy, Headlines & CTAs (Positioned Bottom-Left Overlay, z-30) */}
          <div
            ref={textBlockRef}
            className="absolute z-30 left-6 right-6 md:left-[7vw] md:right-auto bottom-[calc(80px+env(safe-area-inset-bottom))] md:bottom-[10vh] md:max-w-xl flex flex-col items-start text-left space-y-3 md:space-y-4 pointer-events-auto"
          >
            {/* Subheading Label with Explicit Margin Clearance (mb-3 md:mb-5) */}
            <div ref={subheadingRef} className="flex flex-col items-start space-y-1 mb-3 md:mb-5 w-full">
              <span className="text-[11px] md:text-[13px] font-mono font-bold tracking-[0.15em] uppercase text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                HEAVYWEIGHT D2C STREETWEAR • BORN IN YELAHANKA
              </span>
            </div>

            {/* Oversized Headline with Soft Feathered Dark Radial Vignette Pool (NO box, NO straight lines, NO corners) */}
            <div
              ref={headlineBlockRef}
              className="headline-wrap relative flex flex-col space-y-0 text-left select-none"
            >
              {/* Soft radial dark pool extending beyond text bounds, fading out 100% to transparent before any edge */}
              <div
                className="absolute -inset-x-8 -inset-y-6 bg-[radial-gradient(ellipse_70%_70%_at_center,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.25)_45%,rgba(0,0,0,0)_75%)] pointer-events-none z-[-1]"
                aria-hidden="true"
              />

              {/* Line 1: DRIFT IN */}
              <div className="overflow-hidden">
                <h1
                  ref={headlineLine1Ref}
                  className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black uppercase tracking-tight text-white leading-[0.95] drop-shadow-[0_12px_30px_rgba(0,0,0,0.95)]"
                >
                  DRIFT <span className="italic font-serif font-normal text-white/90">IN</span>
                </h1>
              </div>

              {/* Line 2: STYLE. */}
              <div className="overflow-hidden">
                <h1
                  ref={headlineLine2Ref}
                  className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-black uppercase tracking-tight text-white leading-[0.9] drop-shadow-[0_14px_35px_rgba(0,0,0,0.98)]"
                >
                  STYLE.
                </h1>
              </div>
            </div>

            {/* Intentionally Paired Responsive CTA Buttons */}
            <div
              ref={ctaContainerRef}
              className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full sm:w-auto max-w-full"
            >
              <div ref={primaryCtaRef} className="hero-cta-btn w-full sm:w-auto flex-1 min-w-0">
                <DRFTNButton
                  href="/shop"
                  variant="primary"
                >
                  SHOP NEW DROP
                </DRFTNButton>
              </div>

              <div ref={secondaryCtaRef} className="hero-cta-btn w-full sm:w-auto flex-1 min-w-0">
                <DRFTNButton
                  href="/shop?category=sweatshirts"
                  variant="secondary"
                >
                  EXPLORE DROPS
                </DRFTNButton>
              </div>
            </div>
          </div>

          {/* Scroll Cue Indicator */}
          <div
            ref={scrollIndicatorRef}
            className="absolute z-30 bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-0 pointer-events-auto"
          >
            <a
              href="#collections"
              className="flex flex-col items-center gap-1 text-[9px] font-mono font-bold tracking-[0.2em] uppercase text-white/70 hover:text-white transition-colors animate-pulse"
              aria-label="Scroll to explore"
            >
              <span>SCROLL</span>
              <ArrowDown className="w-3.5 h-3.5 stroke-[2]" />
            </a>
          </div>

          {/* Section Transition Texture Seam */}
          <div
            className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent via-black/80 to-black pointer-events-none z-40"
            aria-hidden="true"
          />

        </div>
      </div>
    </div>
  );
}
