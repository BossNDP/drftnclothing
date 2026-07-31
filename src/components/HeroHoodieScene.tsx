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
  const ctaContainerRef = useRef<HTMLDivElement>(null);
  const primaryCtaRef = useRef<HTMLDivElement>(null);
  const secondaryCtaRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  const dot1Ref = useRef<HTMLDivElement>(null);
  const dot2Ref = useRef<HTMLDivElement>(null);

  // Performance guards
  const isBlackRef = useRef<boolean | null>(null);
  const cueClampStateRef = useRef<'visible' | 'hidden' | 'fading' | null>(null);
  const lastLightPRef = useRef<number>(-1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const containerEl = containerRef.current;
    const pinnedEl = pinnedRef.current;
    const hoodieDarkEl = hoodieDarkRef.current;

    if (!containerEl || !pinnedEl) return;

    const ctx = gsap.context(() => {
      const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 1. Ken Burns Slow Idle Scale (1.0 -> 1.05 over 18s)
      if (heroImageWrapperRef.current && !isReduced) {
        gsap.fromTo(
          heroImageWrapperRef.current,
          { scale: 1.0 },
          { scale: 1.05, duration: 18, ease: 'power1.inOut' }
        );
      }

      // 2. Headline Character Stagger Entrance (power3.out, 0.03s stagger)
      const chars = headlineBlockRef.current?.querySelectorAll('.hero-char');
      if (chars && chars.length > 0) {
        if (isReduced) {
          gsap.set(chars, { opacity: 1, y: 0 });
        } else {
          gsap.to(chars, {
            opacity: 1,
            y: 0,
            duration: 0.75,
            stagger: 0.03,
            ease: 'power3.out',
          });
        }
      }

      // 3. Subtext Reveal (Fades in 0.6s after headline starts)
      if (subheadingRef.current) {
        if (isReduced) {
          gsap.set(subheadingRef.current, { opacity: 0.7, y: 0 });
        } else {
          gsap.fromTo(
            subheadingRef.current,
            { opacity: 0, y: 10 },
            { opacity: 0.7, y: 0, duration: 0.6, delay: 0.55, ease: 'power2.out' }
          );
        }
      }

      // 4. CTAs Entrance Reveal
      if (ctaContainerRef.current) {
        const ctaBtns = ctaContainerRef.current.children;
        if (isReduced) {
          gsap.set(ctaBtns, { opacity: 1, y: 0 });
        } else {
          gsap.fromTo(
            ctaBtns,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.5, delay: 0.75, stagger: 0.08, ease: 'power2.out' }
          );
        }
      }

      // 5. Scroll Indicator Entrance
      if (scrollIndicatorRef.current) {
        gsap.fromTo(
          scrollIndicatorRef.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.5, delay: 0.9, ease: 'power2.out' }
        );
      }

      // 6. Cinematic Hero Scroll Reveal
      const isMobile = window.innerWidth < 768;

      if (hoodieDarkEl) {
        gsap.set(hoodieDarkEl, { '--material-progress': '-100%', opacity: 0 });

        const scrollTl = gsap.timeline({
          scrollTrigger: {
            trigger: containerEl,
            start: 'top top',
            end: 'bottom bottom',
            pin: pinnedEl,
            scrub: isMobile ? 1.5 : 1.0,
            fastScrollEnd: false,
            preventOverlaps: true,
            onUpdate: (self) => {
              const p = self.progress;

              if (hoodieDarkEl) {
                if (p > 0.001) {
                  const targetOpacity = Math.min(1, p * 4);
                  gsap.set(hoodieDarkEl, { opacity: targetOpacity });
                } else {
                  gsap.set(hoodieDarkEl, { opacity: 0 });
                }
              }

              if (lightSweepRef.current && Math.abs(p - lastLightPRef.current) > 0.005) {
                lastLightPRef.current = p;
                const lightX = Math.round((p * 60) * 10) / 10;
                const lightY = Math.round((p * 40) * 10) / 10;
                gsap.set(lightSweepRef.current, { xPercent: lightX, yPercent: lightY });
              }

              const isBlack = p > 0.45;
              if (isBlackRef.current !== isBlack) {
                isBlackRef.current = isBlack;
                if (dot1Ref.current && dot2Ref.current) {
                  if (isBlack) {
                    dot1Ref.current.classList.remove('bg-white', 'scale-125');
                    dot1Ref.current.classList.add('bg-white/30');
                    dot2Ref.current.classList.remove('bg-white/30');
                    dot2Ref.current.classList.add('bg-white', 'scale-125');
                  } else {
                    dot2Ref.current.classList.remove('bg-white', 'scale-125');
                    dot2Ref.current.classList.add('bg-white/30');
                    dot1Ref.current.classList.remove('bg-white/30');
                    dot1Ref.current.classList.add('bg-white', 'scale-125');
                  }
                }
              }

              if (textBlockRef.current) {
                gsap.set(textBlockRef.current, {
                  opacity: 1,
                  y: 0,
                  visibility: 'visible',
                  pointerEvents: 'auto',
                });
              }

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
                    visibility: 'visible',
                    pointerEvents: 'none',
                  });
                }
              }
            },
          },
        });

        scrollTl.to(hoodieDarkEl, {
          '--material-progress': '130%',
          opacity: 1,
          ease: 'none',
        });
      }
    });

    return () => ctx.revert();
  }, []);

  const renderAnimatedChars = (text: string) => {
    return text.split('').map((char, i) => (
      <span
        key={i}
        className="hero-char inline-block"
        style={{ opacity: 0, transform: 'translateY(20px)', willChange: 'transform, opacity' }}
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[220vh] md:h-[250vh] bg-black text-white"
    >
      <style jsx>{`
        @keyframes floatCue {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(5px);
          }
        }
        .animate-float-cue {
          animation: floatCue 2s ease-in-out infinite;
        }
      `}</style>

      <div
        ref={pinnedRef}
        className="sticky top-0 w-full h-screen overflow-hidden flex flex-col justify-between"
      >
        <div ref={heroWrapperRef} className="relative w-full h-full">
          {/* Ken Burns Animated Hero Container */}
          <div
            ref={heroImageWrapperRef}
            className="relative w-full h-full transform-gpu"
            style={{ willChange: 'transform' }}
          >
            {/* White Outfit Layer */}
            <div ref={hoodieLightRef} className="absolute inset-0 w-full h-full z-1">
              <div className="relative w-full h-full md:hidden">
                <Image
                  src="/mobilewhite.webp"
                  alt="DRFTN Full-Body Outfit — White Edition"
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(max-width: 767px) 100vw, 1080px"
                  quality={95}
                  className="object-cover object-[75%_20%]"
                />
              </div>
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

            {/* Black Outfit Layer */}
            <div
              ref={hoodieDarkRef}
              className="absolute inset-0 w-full h-full bg-transparent pointer-events-none z-10 opacity-0"
              style={{
                '--material-progress': '-100%',
                WebkitMaskImage:
                  'linear-gradient(180deg, #000 0%, #000 var(--material-progress, -100%), transparent calc(var(--material-progress, -100%) + 25%), transparent 100%)',
                maskImage:
                  'linear-gradient(180deg, #000 0%, #000 var(--material-progress, -100%), transparent calc(var(--material-progress, -100%) + 25%), transparent 100%)',
              } as React.CSSProperties}
            >
              <div className="relative w-full h-full md:hidden">
                <Image
                  src="/mobileblack.webp"
                  alt="DRFTN Full-Body Outfit — Black Edition"
                  fill
                  sizes="(max-width: 767px) 100vw, 1080px"
                  quality={95}
                  className="object-cover object-[75%_20%]"
                />
              </div>
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

            {/* Ambient Light Sweep */}
            <div
              ref={lightSweepRef}
              className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 pointer-events-none z-14 opacity-[0.11] mix-blend-overlay transform-gpu"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.85) 0%, transparent 45%)',
                willChange: 'transform',
              }}
              aria-hidden="true"
            />

            {/* Contrast Gradient Overlay: Transparent at top, fading to ~60% black opacity at bottom third */}
            <div
              className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-15"
              aria-hidden="true"
            />
          </div>

          {/* Colorway Progress Indicator */}
          <div
            className="absolute right-3 sm:right-4 bottom-24 md:bottom-28 z-35 flex flex-col items-center gap-2 pointer-events-none"
            aria-hidden="true"
          >
            <div ref={dot1Ref} className="w-1.5 h-6 rounded-full bg-white transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            <div ref={dot2Ref} className="w-1.5 h-2 rounded-full bg-white/30 transition-all duration-300" />
          </div>

          {/* Hero Copy & Headlines Overlay */}
          <div
            ref={textBlockRef}
            className="absolute z-30 left-6 right-6 md:left-[7vw] md:right-auto bottom-[calc(80px+env(safe-area-inset-bottom))] md:bottom-[10vh] md:max-w-xl flex flex-col items-start text-left space-y-3 md:space-y-4 pointer-events-auto"
          >
            {/* Headline Entrance (Character Stagger) */}
            <div ref={headlineBlockRef} className="relative flex flex-col space-y-0 text-left select-none">
              <div className="overflow-hidden">
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black uppercase tracking-tight text-white leading-[0.95] drop-shadow-[0_12px_30px_rgba(0,0,0,0.95)]">
                  {renderAnimatedChars('DRIFT IN')}
                </h1>
              </div>

              <div className="overflow-hidden">
                <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-black uppercase tracking-tight text-white leading-[0.9] drop-shadow-[0_14px_35px_rgba(0,0,0,0.98)]">
                  {renderAnimatedChars('STYLE.')}
                </h1>
              </div>
            </div>

            {/* Eyebrow Subtext Reveal (Tracked-out uppercase, thin weight, low-opacity gray, 2-stage reveal) */}
            <div ref={subheadingRef} className="opacity-0 flex flex-col items-start w-full pt-1">
              <span className="text-[10px] md:text-[12px] font-mono font-light tracking-[0.25em] uppercase text-zinc-400">
                HEAVYWEIGHT D2C STREETWEAR — BORN IN YELAHANKA
              </span>
            </div>

            {/* Responsive CTAs */}
            <div
              ref={ctaContainerRef}
              className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full sm:w-auto max-w-full"
            >
              <div ref={primaryCtaRef} className="hero-cta-btn w-full sm:w-auto flex-1 min-w-0">
                <DRFTNButton href="/shop" variant="primary">
                  SHOP NEW DROP
                </DRFTNButton>
              </div>

              <div ref={secondaryCtaRef} className="hero-cta-btn w-full sm:w-auto flex-1 min-w-0">
                <DRFTNButton href="/shop?category=sweatshirts" variant="secondary">
                  EXPLORE DROPS
                </DRFTNButton>
              </div>
            </div>
          </div>

          {/* Scroll Cue Indicator */}
          <div
            ref={scrollIndicatorRef}
            className="absolute z-30 bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-0 pointer-events-auto"
          >
            <a
              href="#collections"
              className="flex flex-col items-center gap-1 text-[9px] font-mono font-light tracking-[0.25em] uppercase text-white/80 hover:text-white transition-colors animate-float-cue"
              aria-label="Scroll to explore"
            >
              <span>SCROLL</span>
              <ArrowDown className="w-3.5 h-3.5 stroke-[1.5]" />
            </a>
          </div>

          {/* Bottom Seam */}
          <div
            className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent via-black/80 to-black pointer-events-none z-40"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
