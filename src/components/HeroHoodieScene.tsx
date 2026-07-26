'use client';

import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Product } from '@/types';
import DRFTNButton from '@/components/DRFTNButton';

interface HeroHoodieSceneProps {
  products?: Product[];
}

interface Milestone {
  label: string;
  contrastMode: 'light' | 'dark';
  bgHex: string;
}

const MILESTONES: Milestone[] = [
  {
    label: 'RAW SILHOUETTE',
    contrastMode: 'dark',
    bgHex: '#000000',
  },
  {
    label: 'ON-GRID STEALTH',
    contrastMode: 'dark',
    bgHex: '#060606',
  },
  {
    label: 'ACID WASH STUDIO',
    contrastMode: 'dark',
    bgHex: '#0A0A0A',
  },
  {
    label: 'BUILT DIFFERENT',
    contrastMode: 'dark',
    bgHex: '#000000',
  },
];

const DEFAULT_MARQUEE_IMAGES = [
  'https://ik.imagekit.io/nu87ftsgv/WhatsApp_Image_2026-07-16_at_8.39.44_PM-removebg-preview.png',
  'https://ik.imagekit.io/nu87ftsgv/WhatsApp_Image_2026-07-16_at_8.33.17_PM-removebg-preview.png',
  'https://ik.imagekit.io/nu87ftsgv/WhatsApp_Image_2026-07-16_at_8.38.40_PM-removebg-preview.png',
  'https://ik.imagekit.io/nu87ftsgv/WhatsApp_Image_2026-07-16_at_8.32.58_PM-removebg-preview.png',
];

export default function HeroHoodieScene({ products }: HeroHoodieSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroWrapperRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const hoodieStageRef = useRef<HTMLDivElement>(null);
  const hoodieLightRef = useRef<HTMLDivElement>(null);
  const hoodieDarkRef = useRef<HTMLDivElement>(null);
  const bgDiscRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const textFillRef = useRef<HTMLDivElement>(null);
  const driftInFillRef = useRef<HTMLDivElement>(null);
  const headlineBlockRef = useRef<HTMLDivElement>(null);
  const marqueeColsRef = useRef<(HTMLDivElement | null)[]>([]);

  const currentBucketRef = useRef<number>(0);
  const particle1Ref = useRef<HTMLDivElement>(null);
  const particle2Ref = useRef<HTMLDivElement>(null);
  const particle3Ref = useRef<HTMLDivElement>(null);
  const [isLowEndDevice, setIsLowEndDevice] = useState<boolean>(false);

  const marqueeCols = React.useMemo(() => {
    const cols: string[][] = [[], [], [], []];
    for (let colIdx = 0; colIdx < 4; colIdx++) {
      for (let imgIdx = 0; imgIdx < 3; imgIdx++) {
        const itemIdx = (colIdx * 2 + imgIdx) % DEFAULT_MARQUEE_IMAGES.length;
        cols[colIdx].push(DEFAULT_MARQUEE_IMAGES[itemIdx]);
      }
    }
    return cols;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const concurrency = navigator.hardwareConcurrency || 4;
      const navConn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
      const effectiveType = navConn?.effectiveType || '4g';
      if (concurrency <= 4 || effectiveType === '2g' || effectiveType === '3g') {
        setIsLowEndDevice(true);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    const containerEl = containerRef.current;
    const pinnedEl = pinnedRef.current;
    const hoodieLightEl = hoodieLightRef.current;
    const hoodieDarkEl = hoodieDarkRef.current;
    const bgDiscEl = bgDiscRef.current;
    const scrollIndEl = scrollIndicatorRef.current;
    const textFillEl = textFillRef.current;
    const driftInFillEl = driftInFillRef.current;
    const headlineBlockEl = headlineBlockRef.current;

    if (!containerEl || !pinnedEl || !hoodieLightEl || !hoodieDarkEl) return;

    let cachedScale = 4.5;

    const recalcScale = () => {
      const stageEl = hoodieStageRef.current || containerEl;
      if (!stageEl || !hoodieDarkEl) return;
      const stageRect = stageEl.getBoundingClientRect();
      if (stageRect.width === 0 || stageRect.height === 0) return;

      const originX = stageRect.width * 0.6;
      const originY = stageRect.height * 0.45;
      const corners: [number, number][] = [
        [0, 0],
        [stageRect.width, 0],
        [0, stageRect.height],
        [stageRect.width, stageRect.height],
      ];
      const maxDist = Math.max(
        ...corners.map(([x, y]) => Math.sqrt((x - originX) ** 2 + (y - originY) ** 2))
      );

      const maskW = hoodieDarkEl.offsetWidth || stageRect.width;
      const maskH = hoodieDarkEl.offsetHeight || stageRect.height;
      const maskRadius = Math.min(maskW, maskH) / 2;

      cachedScale = Math.max(3.5, (maxDist / (maskRadius || 1)) * 1.2);
    };

    recalcScale();
    window.addEventListener('resize', recalcScale);

    const mm = gsap.matchMedia();

    // DOM-only contrast bucket update without React re-renders during scroll
    const updateContrastBucket = (progress: number) => {
      let bucket = 0;
      if (progress > 0.75) bucket = 3;
      else if (progress > 0.5) bucket = 2;
      else if (progress > 0.25) bucket = 1;

      if (bucket !== currentBucketRef.current) {
        currentBucketRef.current = bucket;

        if (heroWrapperRef.current) {
          const milestone = MILESTONES[bucket] || MILESTONES[0];
          heroWrapperRef.current.setAttribute('data-contrast-mode', milestone.contrastMode);
          heroWrapperRef.current.style.setProperty('--hero-contrast-bg', milestone.bgHex);
        }
        if (bgDiscEl) {
          bgDiscEl.style.background = bucket === 2 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.22)';
        }
      }
    };

    // DESKTOP TIMELINE (≥768px) - Single Consolidated Timeline
    mm.add('(min-width: 768px)', () => {
      gsap.set(hoodieLightEl, { opacity: 1, scale: 1, yPercent: 0 });
      gsap.set(hoodieDarkEl, {
        opacity: 1,
        scale: 1,
        yPercent: 0,
        clipPath: 'circle(0% at 50% 50%)',
        webkitClipPath: 'circle(0% at 50% 50%)',
      });
      if (driftInFillEl) {
        gsap.set(driftInFillEl, {
          clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
          webkitClipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
        });
      }
      if (textFillEl) {
        gsap.set(textFillEl, {
          clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
          webkitClipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
        });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerEl,
          start: 'top top',
          end: 'bottom bottom',
          pin: pinnedEl,
          scrub: 1.0,
          fastScrollEnd: true,
          onEnter: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl].filter(Boolean), {
              willChange: 'transform, opacity, clip-path',
            });
          },
          onEnterBack: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl].filter(Boolean), {
              willChange: 'transform, opacity, clip-path',
            });
          },
          onLeave: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl].filter(Boolean), {
              clearProps: 'willChange',
            });
          },
          onLeaveBack: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl].filter(Boolean), {
              clearProps: 'willChange',
            });
          },
          onUpdate: (self) => {
            updateContrastBucket(self.progress);
            if (scrollIndEl) {
              const op = Math.max(0, 1 - self.progress * 5);
              scrollIndEl.style.opacity = op.toString();
            }
          },
        },
      });

      // 1. Direct Scroll-Scrubbed Circle Clip-Path Reveal (un-covering to black hoodie)
      tl.to(
        hoodieDarkEl,
        {
          clipPath: 'circle(120% at 50% 50%)',
          webkitClipPath: 'circle(120% at 50% 50%)',
          duration: 0.6,
          ease: 'none',
        },
        0.0
      );

      // 2. DRIFT IN Text Fill Overlay
      if (driftInFillEl) {
        tl.to(
          driftInFillEl,
          {
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            webkitClipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            duration: 0.4,
            ease: 'none',
          },
          0.0
        );
      }

      // 3. STYLE. Text Fill Overlay
      if (textFillEl) {
        tl.to(
          textFillEl,
          {
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            webkitClipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            duration: 0.45,
            ease: 'none',
          },
          0.25
        );
      }

      // 4. Parallax Headline Block
      if (headlineBlockEl) {
        tl.to(headlineBlockEl, { yPercent: -10, ease: 'none', duration: 1.0 }, 0.0);
      }

      // 5. Floating Particle / Depth Elements Parallax
      if (particle1Ref.current) tl.to(particle1Ref.current, { yPercent: -35, ease: 'none', duration: 1.0 }, 0.0);
      if (particle2Ref.current) tl.to(particle2Ref.current, { yPercent: 45, ease: 'none', duration: 1.0 }, 0.0);
      if (particle3Ref.current) tl.to(particle3Ref.current, { yPercent: -25, ease: 'none', duration: 1.0 }, 0.0);

      // 6. Marquee Columns Parallax
      marqueeColsRef.current.forEach((col, idx) => {
        if (!col) return;
        const scrollUp = idx % 2 === 0;
        tl.to(
          col,
          {
            yPercent: scrollUp ? -20 : 20,
            ease: 'none',
            duration: 1.0,
          },
          0.0
        );
      });
    });

    // MOBILE TIMELINE (<768px) - Lightweight Unpinned / Short Pin Timeline
    mm.add('(max-width: 767px)', () => {
      gsap.set(hoodieLightEl, { opacity: 1, scale: 1, yPercent: 0 });
      gsap.set(hoodieDarkEl, {
        opacity: 1,
        scale: 1,
        yPercent: 0,
        clipPath: 'circle(0% at 50% 50%)',
        webkitClipPath: 'circle(0% at 50% 50%)',
      });
      if (driftInFillEl) {
        gsap.set(driftInFillEl, {
          clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
          webkitClipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
        });
      }
      if (textFillEl) {
        gsap.set(textFillEl, {
          clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
          webkitClipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
        });
      }

      const mobileTl = gsap.timeline({
        scrollTrigger: {
          trigger: containerEl,
          start: 'top top',
          end: '+=100%',
          scrub: 0.5,
          fastScrollEnd: true,
          onEnter: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl, particle1Ref.current, particle2Ref.current].filter(Boolean), {
              willChange: 'transform, opacity, clip-path',
            });
          },
          onEnterBack: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl, particle1Ref.current, particle2Ref.current].filter(Boolean), {
              willChange: 'transform, opacity, clip-path',
            });
          },
          onLeave: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl, particle1Ref.current, particle2Ref.current].filter(Boolean), {
              clearProps: 'willChange',
            });
          },
          onLeaveBack: () => {
            gsap.set([hoodieLightEl, hoodieDarkEl, driftInFillEl, textFillEl, headlineBlockEl, particle1Ref.current, particle2Ref.current].filter(Boolean), {
              clearProps: 'willChange',
            });
          },
          onUpdate: (self) => {
            updateContrastBucket(self.progress);
            if (scrollIndEl) {
              const op = Math.max(0, 1 - self.progress * 3);
              scrollIndEl.style.opacity = op.toString();
            }
          },
        },
      });

      // Direct Scroll-Scrubbed Circle Clip-Path Reveal on Mobile
      mobileTl.to(
        hoodieDarkEl,
        {
          clipPath: 'circle(120% at 50% 50%)',
          webkitClipPath: 'circle(120% at 50% 50%)',
          duration: 0.6,
          ease: 'none',
        },
        0.0
      );

      if (driftInFillEl) {
        mobileTl.to(
          driftInFillEl,
          {
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            webkitClipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            duration: 0.4,
            ease: 'none',
          },
          0.0
        );
      }

      if (textFillEl) {
        mobileTl.to(
          textFillEl,
          {
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            webkitClipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
            duration: 0.5,
            ease: 'none',
          },
          0.1
        );
      }

      if (headlineBlockEl) {
        mobileTl.to(
          headlineBlockEl,
          {
            yPercent: -4,
            duration: 0.6,
            ease: 'none',
          },
          0.0
        );
      }

      if (particle1Ref.current) mobileTl.to(particle1Ref.current, { yPercent: -20, ease: 'none', duration: 1.0 }, 0.0);
      if (particle2Ref.current) mobileTl.to(particle2Ref.current, { yPercent: 25, ease: 'none', duration: 1.0 }, 0.0);
    });

    return () => {
      window.removeEventListener('resize', recalcScale);
      mm.revert();
    };
  }, [isLowEndDevice]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black select-none h-[120vh] md:h-[150vh]"
      id="hero-scene"
    >
      <div
        ref={pinnedRef}
        className="sticky top-0 w-full h-screen overflow-hidden bg-black"
      >
        {/* Main contrast wrapper container — Atmospheric Spotlight Background */}
        <div
          ref={heroWrapperRef}
          data-contrast-mode="dark"
          className="hero-contrast-wrapper relative w-full h-full flex flex-col justify-between items-center px-4 sm:px-8 md:px-12 pt-12 pb-6 sm:pb-8 md:py-8 transition-colors duration-300 overflow-hidden bg-black"
        >
          {/* ── ATMOSPHERIC STUDIO SPOTLIGHT BACKGROUND (NO PITCH BLACK VOID) (z-0) ── */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Multi-radial gradient ambient spotlight */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,0.16)_0%,rgba(35,35,45,0.55)_45%,rgba(0,0,0,1)_92%)]" />
            <div
              ref={bgDiscRef}
              className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[320px] sm:w-[500px] md:w-[700px] h-[320px] sm:h-[500px] md:h-[700px] rounded-full bg-white/15 blur-[120px] pointer-events-none"
            />

            {/* Architectural noise texture */}
            <Image
              src="/bg.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-35 mix-blend-overlay"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" />
          </div>

          {/* ── Desktop Background Product Marquee Grid (Desktop only, z-[1]) ── */}
          <div className="absolute inset-0 z-[1] hidden md:grid grid-cols-4 gap-8 px-16 overflow-hidden opacity-25 select-none pointer-events-none">
            {marqueeCols.map((colImages, colIdx) => (
              <div
                key={colIdx}
                ref={(el) => {
                  marqueeColsRef.current[colIdx] = el;
                }}
                className="flex flex-col gap-8 transition-transform duration-700"
              >
                {colImages.map((src, i) => (
                  <div key={i} className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-white/10">
                    <Image src={src} alt="" fill sizes="25vw" className="object-cover filter grayscale contrast-125" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ── CENTRAL HOODIE HERO VIEWPORT ZONE (z-10) ── */}
          <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center pointer-events-none py-2">
            {/* Ambient Backlight Glow Disc */}
            <div
              className="absolute w-[340px] sm:w-[460px] md:w-[600px] h-[340px] sm:h-[460px] md:h-[600px] rounded-full blur-[110px] opacity-35 transition-colors duration-500 bg-white/20"
            />

            {/* Dominant Hoodie Visual Container — Hoodie Stage */}
            <div
              ref={hoodieStageRef}
              className="hoodie-stage relative w-[88vw] sm:w-[84vw] md:w-[520px] lg:w-[580px] max-w-[460px] md:max-w-none h-[46vh] sm:h-[50vh] md:h-full flex items-center justify-center"
            >
              {/* Parallax Depth Particle Accent 1: Top Left Torn Spec Badge */}
              <div
                ref={particle1Ref}
                className="absolute top-2 left-2 sm:left-4 z-20 pointer-events-none transform-gpu"
              >
                <span className="text-[9px] font-mono tracking-[0.2em] text-white/50 bg-black/75 px-2 py-0.5 uppercase border border-white/15 backdrop-blur-xs rounded-sm">
                  SPEC // 380GSM
                </span>
              </div>

              {/* Parallax Depth Particle Accent 2: Top Right Industrial Accent Line */}
              <div
                ref={particle2Ref}
                className="absolute top-4 right-2 sm:right-6 z-20 pointer-events-none transform-gpu flex flex-col items-end space-y-1"
              >
                <div className="w-10 h-[1px] bg-white/30" />
                <span className="text-[8px] font-mono text-white/40 tracking-widest uppercase">
                  D2C CUT
                </span>
              </div>

              {/* Parallax Depth Particle Accent 3: Bottom Right Floating Pill */}
              <div
                ref={particle3Ref}
                className="absolute bottom-10 right-4 hidden sm:block z-20 pointer-events-none transform-gpu"
              >
                <div className="w-3 h-3 rounded-full border border-white/40 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white/70 animate-ping" />
                </div>
              </div>

              {/* Hoodie Base: Light / Cream Edition (ALWAYS opacity: 1) */}
              <div
                ref={hoodieLightRef}
                className="hoodie-base absolute inset-0 w-full h-full flex items-center justify-center"
                style={{ contain: 'layout paint style' }}
              >
                <Image
                  src="/hero/hoodie-light-mobile.png"
                  alt="DRFTN Stitch Hoodie - Light Edition"
                  fill
                  priority
                  sizes="(max-width: 768px) 88vw, 580px"
                  className="object-contain filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
                />
              </div>

              {/* Hoodie Reveal Mask: Direct 1:1 Scroll Scrubbed Circle Reveal */}
              <div
                ref={hoodieDarkRef}
                className="hoodie-reveal-mask absolute inset-0 w-full h-full flex items-center justify-center bg-transparent pointer-events-none"
                style={{
                  clipPath: 'circle(0% at 50% 50%)',
                  WebkitClipPath: 'circle(0% at 50% 50%)',
                  willChange: 'clip-path',
                  contain: 'layout paint style',
                }}
              >
                <Image
                  src="/hero/hoodie-dark-mobile.png"
                  alt="DRFTN Stitch Hoodie - Dark Edition"
                  fill
                  priority
                  sizes="(max-width: 768px) 88vw, 580px"
                  className="hoodie-reveal object-contain filter drop-shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
                  style={{ contain: 'layout paint style' }}
                />
              </div>
            </div>
          </div>

          {/* ── HERO COPY, OVERSIZED HEADLINE & CTA BUTTONS (z-20) ── */}
          <div className="relative z-20 w-full max-w-screen-2xl mx-auto flex flex-col md:flex-row items-stretch md:items-end justify-between gap-3 md:gap-6">
            {/* Copy & Headline Block */}
            <div ref={headlineBlockRef} className="max-w-2xl text-left space-y-1 sm:space-y-2">
              {/* ── OVERSIZED EDITORIAL HEADLINE: "DRIFT IN" + "STYLE." (Sequential Clip Path Fill) ── */}
              <div className="flex flex-col space-y-0.5 text-left select-none">
                {/* Line 1: DRIFT IN (Hollow stroke underlay + Solid white fill overlay scrubbed on scroll) */}
                <div className="relative inline-block overflow-hidden py-0.5">
                  <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black uppercase tracking-tight text-stroke-hollow leading-tight block">
                    DRIFT <span className="italic font-serif font-normal text-stroke-hollow">IN</span>
                  </h1>

                  <div
                    ref={driftInFillRef}
                    className="absolute inset-0 pointer-events-none z-10 py-0.5"
                    style={{
                      clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
                      WebkitClipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
                    }}
                  >
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black uppercase tracking-tight text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.85)] leading-tight block">
                      DRIFT <span className="italic font-serif font-normal text-white/90">IN</span>
                    </h1>
                  </div>
                </div>

                {/* Sleek monochrome accent divider line */}
                <div className="w-12 sm:w-20 h-[1px] bg-white/25 my-0.5" />

                {/* Line 2: STYLE. (1.4x larger scale disparity + sequential scroll fill overlay) */}
                <div className="relative inline-block overflow-hidden py-0.5">
                  <span className="text-5xl sm:text-7xl md:text-9xl font-display font-black uppercase tracking-tight text-stroke-hollow leading-none block">
                    STYLE.
                  </span>

                  <div
                    ref={textFillRef}
                    className="absolute inset-0 pointer-events-none z-10 py-0.5"
                    style={{
                      clipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
                      WebkitClipPath: 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)',
                    }}
                  >
                    <span className="text-5xl sm:text-7xl md:text-9xl font-display font-black uppercase tracking-tight text-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.95)] leading-none block">
                      STYLE.
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] sm:text-xs md:text-sm font-body font-medium tracking-wide uppercase max-w-md opacity-85 leading-relaxed hero-dynamic-text pt-0.5">
                HEAVYWEIGHT D2C STREETWEAR • BORN IN YELAHANKA
              </p>

              {/* Sitewide Premium DRFTN CTA Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <DRFTNButton href="/shop" variant="primary" fullWidth className="sm:w-auto">
                  SHOP COLLECTION
                </DRFTNButton>

                <DRFTNButton href="#collections" variant="secondary" fullWidth className="sm:w-auto" icon={null}>
                  EXPLORE DROPS
                </DRFTNButton>
              </div>
            </div>

            {/* ── ROTATING CIRCULAR SCROLL BADGE (z-20) ── */}
            <div
              ref={scrollIndicatorRef}
              className="flex flex-col items-center md:items-end gap-1.5 hero-dynamic-text transition-opacity duration-300 pointer-events-auto self-center md:self-end pt-2 md:pt-0"
            >
              <a
                href="#collections"
                className="relative flex items-center justify-center group"
                aria-label="Scroll to explore collection"
              >
                <svg
                  viewBox="0 0 100 100"
                  className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 animate-spin-slow pointer-events-none"
                >
                  <path
                    id="circlePath"
                    d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
                    fill="none"
                  />
                  <text className="text-[7.2px] font-mono font-bold uppercase tracking-[0.22em] fill-current">
                    <textPath href="#circlePath" startOffset="0%">
                      DRFTN CLOTHING • SCROLL TO EXPLORE •
                    </textPath>
                  </text>
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full border border-current flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
