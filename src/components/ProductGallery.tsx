'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Video } from 'lucide-react';
import { getOptimizedImageUrl, getBlurPlaceholderUrl } from '@/lib/cloudinary';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductHotspot {
  /** 0–100 percentage from left of image */
  x: number;
  /** 0–100 percentage from top of image */
  y: number;
  label: string;
  detail: string;
}

export interface ProductGalleryProps {
  images: string[];
  productName: string;
  cinemagraphUrl?: string | null;
  activeVariantColor?: string;
  /** e.g. "leather", "cotton", "satin" — drives shimmer */
  material?: string | null;
  /** Product description — used as fallback shimmer signal */
  description?: string | null;
  /** Optional image labels: ['Front','Side','Back','Detail','Fit'] */
  imageLabels?: string[];
  /** Optional hotspot markers on the hero image */
  hotspots?: ProductHotspot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Shimmer-worthy materials — glossy/reflective surfaces only */
const SHIMMER_KEYWORDS = [
  'leather', 'faux leather', 'vegan leather', 'pu leather',
  'satin', 'nylon', 'glossy', 'patent', 'shiny',
  'metallic', 'sequin', 'vinyl', 'coated', 'waxed',
];

function shouldShowShimmer(material?: string | null, description?: string | null): boolean {
  const haystack = `${material || ''} ${description || ''}`.toLowerCase();
  return SHIMMER_KEYWORDS.some((kw) => haystack.includes(kw));
}

/** Soft radial accent glow — very subtle, keeps DRFTN identity black */
function getAccentGlow(color?: string): string {
  if (!color) return 'transparent';
  const c = color.toLowerCase();
  if (c.includes('white') || c.includes('cream') || c.includes('ivory') || c.includes('light'))
    return 'radial-gradient(circle at 50% 60%, rgba(255,252,240,0.09) 0%, transparent 70%)';
  if (c.includes('navy') || c.includes('blue') || c.includes('indigo'))
    return 'radial-gradient(circle at 50% 60%, rgba(30,60,180,0.10) 0%, transparent 70%)';
  if (c.includes('red') || c.includes('crimson') || c.includes('burgundy'))
    return 'radial-gradient(circle at 50% 60%, rgba(160,20,30,0.09) 0%, transparent 70%)';
  if (c.includes('green') || c.includes('olive') || c.includes('forest'))
    return 'radial-gradient(circle at 50% 60%, rgba(20,90,40,0.09) 0%, transparent 70%)';
  if (c.includes('grey') || c.includes('gray'))
    return 'radial-gradient(circle at 50% 60%, rgba(80,80,90,0.08) 0%, transparent 70%)';
  if (c.includes('brown') || c.includes('tan') || c.includes('camel'))
    return 'radial-gradient(circle at 50% 60%, rgba(100,55,20,0.09) 0%, transparent 70%)';
  // black / dark
  return 'radial-gradient(circle at 50% 60%, rgba(80,80,80,0.07) 0%, transparent 70%)';
}

// ─────────────────────────────────────────────────────────────────────────────
// Hotspot Marker (pulsing dot + tooltip)
// ─────────────────────────────────────────────────────────────────────────────
function HotspotMarker({ hotspot }: { hotspot: ProductHotspot }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%`, transform: 'translate(-50%,-50%)' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="group relative flex items-center justify-center w-6 h-6 focus:outline-none"
        aria-label={hotspot.label}
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
        {/* Inner dot */}
        <span className="relative z-10 w-3 h-3 rounded-full bg-white border-2 border-white/80 shadow-md group-hover:scale-125 transition-transform duration-200" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 -translate-x-1/2 top-8 min-w-[140px] bg-black/90 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-xl pointer-events-none"
          >
            <p className="text-white text-[10px] font-semibold uppercase tracking-widest mb-0.5">
              {hotspot.label}
            </p>
            <p className="text-zinc-300 text-[11px] leading-snug">{hotspot.detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Premium Lookbook Gallery v2 — Luxury Motion Edition
 *
 * Features:
 * 1. Auto Story Gallery — hero → 2nd → 3rd image, then stop (2.5s each)
 * 2. Image Breathing — scale 1→1.015→1 over 14s (imperceptible but alive)
 * 3. Progressive Reveal — 700ms fade+scale on first mount
 * 4. Light Reflection Shimmer — conditional on material (leather/satin/nylon only)
 * 5. Adaptive Radial Glow — soft accent behind product, keeps bg black
 * 6. Motion Blur — blur(1.5px) fade on transition, 120ms
 * 7. Hold to Inspect — long press on mobile zooms to 1.8x
 * 8. Interactive Hotspots — pulsing markers with label tooltips
 * 9. Smart Image Labels — editorial labels instead of dots
 * Performance: tab-visibility pause, reduced-motion respect, memoized slides
 */
export default function ProductGallery({
  images,
  productName,
  cinemagraphUrl,
  activeVariantColor,
  material,
  description,
  imageLabels,
  hotspots = [],
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [zoomStyle, setZoomStyle] = useState<{ transform: string } | null>(null);
  const [tiltStyle, setTiltStyle] = useState<{ transform: string } | null>(null);
  const [tabVisible, setTabVisible] = useState<boolean>(true);

  // Feature 7: Hold to Inspect
  const [holdZoom, setHoldZoom] = useState<boolean>(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feature 1: Auto Story (stop at 3rd image)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayStopped = useRef<boolean>(false);
  const AUTO_STORY_LIMIT = 3; // show images 0,1,2 then stop

  // Feature 3: Progressive Reveal
  const revealControls = useAnimation();

  const containerRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const activeImageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Computed
  const totalSlides = images.length + (cinemagraphUrl ? 1 : 0);
  const currentImage = images[activeIndex] || images[0];
  const showShimmer = useMemo(
    () => shouldShowShimmer(material, description),
    [material, description]
  );
  const accentGlow = useMemo(() => getAccentGlow(activeVariantColor), [activeVariantColor]);

  // Smart labels: user-supplied or default editorial labels
  const resolvedLabels = useMemo(() => {
    if (imageLabels && imageLabels.length > 0) return imageLabels;
    const defaults = ['Front', 'Back', 'Side', 'Detail', 'Fit', 'Model'];
    return images.map((_, i) => defaults[i] ?? `0${i + 1}`);
  }, [images, imageLabels]);

  // ─── Media Query & Reduced Motion ───────────────────────────────────────
  useEffect(() => {
    const mediaHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const mediaReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    setIsDesktop(mediaHover.matches);
    setReducedMotion(mediaReduced.matches);

    const h1 = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    const h2 = (e: MediaQueryListEvent) => setReducedMotion(e.matches);

    mediaHover.addEventListener('change', h1);
    mediaReduced.addEventListener('change', h2);
    return () => {
      mediaHover.removeEventListener('change', h1);
      mediaReduced.removeEventListener('change', h2);
    };
  }, []);

  // ─── Performance: Pause animations when tab hidden ───────────────────────
  useEffect(() => {
    const handleVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ─── Feature 3: Progressive Reveal ──────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return;
    revealControls.start({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
    });
  }, [reducedMotion, revealControls]);

  // ─── Feature 1: Auto Story Gallery (hero → 2nd → 3rd, stop) ─────────────
  useEffect(() => {
    if (reducedMotion || images.length <= 1 || autoplayStopped.current) return;

    autoplayRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        // Stop after AUTO_STORY_LIMIT images
        if (next >= Math.min(AUTO_STORY_LIMIT, images.length)) {
          if (autoplayRef.current) clearInterval(autoplayRef.current);
          autoplayStopped.current = true;
          return prev;
        }
        return next;
      });
    }, 2500);

    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [reducedMotion, images.length]);

  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayStopped.current = true;
  }, []);

  // ─── GSAP ScrollTrigger Snap (desktop) ──────────────────────────────────
  useEffect(() => {
    if (!isDesktop || reducedMotion || !containerRef.current) return;

    let ctx: any = null;
    const setupGSAP = async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      if (!containerRef.current) return;

      ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: containerRef.current,
          start: 'top top+=100',
          end: 'bottom bottom',
          snap: {
            snapTo: 1 / Math.max(1, totalSlides - 1),
            duration: { min: 0.25, max: 0.45 },
            delay: 0.05,
            ease: 'power2.out',
          },
          onUpdate: (self) => {
            const idx = Math.round(self.progress * (totalSlides - 1));
            setActiveIndex(idx);
          },
        });
      }, containerRef);
    };

    setupGSAP();
    return () => { if (ctx) ctx.revert(); };
  }, [isDesktop, reducedMotion, totalSlides]);

  // ─── Cinemagraph IntersectionObserver ───────────────────────────────────
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) videoEl.play().catch(() => {});
        else videoEl.pause();
      },
      { threshold: 0.25 }
    );
    observer.observe(videoEl);
    return () => observer.disconnect();
  }, [cinemagraphUrl]);

  // ─── Cursor Zoom (desktop) ───────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (!isDesktop || reducedMotion || !activeImageRef.current) return;
    setIsHovered(true);
    activeImageRef.current.style.willChange = 'transform';
  }, [isDesktop, reducedMotion]);

  const handleMouseLeave = useCallback(() => {
    if (!activeImageRef.current) return;
    setIsHovered(false);
    activeImageRef.current.style.willChange = 'auto';
    setZoomStyle(null);
    setTiltStyle(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDesktop || reducedMotion || !activeImageRef.current) return;
      const rect = activeImageRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const tiltX = (y - 0.5) * -4;
      const tiltY = (x - 0.5) * 4;
      setZoomStyle({ transform: `scale(1.8) translate(${(0.5 - x) * 38}%, ${(0.5 - y) * 38}%)` });
      setTiltStyle({ transform: `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)` });
    },
    [isDesktop, reducedMotion]
  );

  // ─── Mobile Slide Observer ───────────────────────────────────────────────
  useEffect(() => {
    if (isDesktop) return;
    const observers: IntersectionObserver[] = [];
    slideRefs.current.forEach((slideEl, index) => {
      if (!slideEl) return;
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveIndex(index); },
        { root: mobileScrollRef.current, threshold: 0.6 }
      );
      observer.observe(slideEl);
      observers.push(observer);
    });
    return () => observers.forEach((obs) => obs.disconnect());
  }, [isDesktop, images.length, cinemagraphUrl]);

  const scrollToSlide = useCallback((index: number) => {
    stopAutoplay();
    setActiveIndex(index);
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({
        left: index * mobileScrollRef.current.clientWidth,
        behavior: 'smooth',
      });
    }
  }, [stopAutoplay]);

  // ─── Feature 7: Hold to Inspect (mobile long-press) ─────────────────────
  const handleTouchStart = useCallback(() => {
    stopAutoplay();
    holdTimerRef.current = setTimeout(() => {
      setHoldZoom(true);
    }, 400);
  }, [stopAutoplay]);

  const handleTouchEnd = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setHoldZoom(false);
  }, []);

  // ─── Transition Variants (Feature 6: subtle blur 1.5px) ─────────────────
  const imageVariants = useMemo(() => ({
    initial: { opacity: 0, scale: 1.025, filter: 'blur(1.5px)' },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.985,
      filter: 'blur(1.5px)',
      transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
    },
  }), []);

  // ─── Feature 2: Breathing (scale 1→1.015→1) ─────────────────────────────
  const breathingAnim = useMemo(() => {
    if (reducedMotion || !tabVisible || isHovered) return { scale: 1 };
    return {
      scale: [1, 1.015, 1],
      transition: {
        duration: 14,
        ease: 'easeInOut' as const,
        repeat: Infinity,
        repeatType: 'loop' as const,
      },
    };
  }, [reducedMotion, tabVisible, isHovered]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={reducedMotion ? {} : { opacity: 0, y: 14, scale: 0.97 }}
      animate={revealControls}
      ref={containerRef}
      className="relative w-full flex flex-col md:flex-row items-center justify-center gap-4 select-none mx-auto"
    >
      {/* ── Desktop Left Thumbnails Strip ── */}
      <div className="hidden md:flex flex-col gap-3 w-20 shrink-0 sticky top-28 self-start max-h-[80vh] overflow-y-auto scrollbar-none z-10">
        {images.map((imgUrl, idx) => {
          const isSelected = activeIndex === idx;
          const label = resolvedLabels[idx];
          return (
            <motion.button
              key={`thumb-${idx}`}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                stopAutoplay();
                setActiveIndex(idx);
              }}
              className={`group relative aspect-[3/4] w-full rounded-md overflow-hidden border-2 transition-all duration-200 focus:outline-none ${
                isSelected
                  ? 'border-white ring-1 ring-white shadow-md'
                  : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-500'
              }`}
              aria-label={`View ${label}`}
            >
              <Image
                src={getOptimizedImageUrl(imgUrl, 160)}
                alt={`${productName} — ${label}`}
                fill
                sizes="80px"
                className="object-cover"
              />
              {/* Feature 9: Smart label on thumbnail */}
              <div className={`absolute bottom-0 inset-x-0 py-0.5 text-center text-[8px] font-mono tracking-wider uppercase transition-all duration-200 ${isSelected ? 'bg-white text-black' : 'bg-black/60 text-white/70 group-hover:bg-black/80'}`}>
                {label}
              </div>
            </motion.button>
          );
        })}

        {/* Cinemagraph Thumbnail */}
        {cinemagraphUrl && (
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { stopAutoplay(); setActiveIndex(images.length); }}
            className={`relative aspect-[3/4] w-full rounded-md overflow-hidden border-2 transition-all duration-200 flex items-center justify-center bg-zinc-900 ${
              activeIndex === images.length
                ? 'border-white ring-1 ring-white opacity-100'
                : 'border-zinc-800 opacity-60 hover:opacity-100'
            }`}
            aria-label="View cinemagraph video"
          >
            <Video className="w-5 h-5 text-white/90" />
            <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold bg-black/80 text-white px-1 rounded">
              MOTION
            </span>
          </motion.button>
        )}
      </div>

      {/* ── Main Viewport ── */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center">

        {/* ─── Desktop Main Image ─────────────────────────────────────────── */}
        <div
          ref={activeImageRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          className="hidden md:block relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-2xl cursor-zoom-in border border-zinc-800/60 bg-zinc-950"
          style={{
            ...(tiltStyle ? { transform: tiltStyle.transform } : {}),
            background: accentGlow || 'rgb(9,9,11)',
            transition: 'background 0.7s ease, transform 0.1s ease-out',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`main-${activeIndex}`}
              variants={imageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative w-full h-full"
            >
              {activeIndex < images.length ? (
                <div
                  className="relative w-full h-full overflow-hidden"
                  style={zoomStyle ?? undefined}
                >
                  {/* Feature 2: Breathing (only animate active slide) */}
                  <motion.div
                    key={`breath-${activeIndex}`}
                    className="relative w-full h-full"
                    animate={breathingAnim}
                  >
                    <Image
                      src={getOptimizedImageUrl(currentImage, 1400)}
                      alt={`${productName} — ${resolvedLabels[activeIndex]}`}
                      fill
                      priority={activeIndex === 0}
                      fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
                      sizes="(min-width: 1024px) 50vw, (min-width: 768px) 60vw, 100vw"
                      quality={90}
                      placeholder="blur"
                      blurDataURL={getBlurPlaceholderUrl(currentImage)}
                      className="object-cover"
                    />
                  </motion.div>

                  {/* Feature 4: Shimmer — conditional on material */}
                  {showShimmer && !reducedMotion && tabVisible && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none z-10"
                      animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
                      transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
                      style={{
                        background:
                          'linear-gradient(108deg, transparent 22%, rgba(255,255,255,0.06) 50%, transparent 78%)',
                        backgroundSize: '200% 100%',
                        mixBlendMode: 'screen',
                      }}
                    />
                  )}

                  {/* Feature 8: Hotspot Markers (hero image only) */}
                  {activeIndex === 0 && hotspots.length > 0 && (
                    <div className="absolute inset-0 z-20 pointer-events-none">
                      {hotspots.map((hs, i) => (
                        <HotspotMarker key={i} hotspot={hs} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-full h-full bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={cinemagraphUrl!}
                    muted
                    playsInline
                    autoPlay
                    loop
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-xs text-white/90">
                    <Video className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span className="font-mono text-[10px] tracking-wider uppercase">Cinemagraph</span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Feature 9: Current image label (bottom-left editorial badge) */}
          {activeIndex < images.length && (
            <motion.div
              key={`label-${activeIndex}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="absolute bottom-4 left-4 z-20 pointer-events-none"
            >
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/60 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded">
                {resolvedLabels[activeIndex]}
              </span>
            </motion.div>
          )}
        </div>

        {/* ─── Mobile Scroll Snap Gallery ─────────────────────────────────── */}
        <div className="md:hidden relative w-full">
          <div
            ref={mobileScrollRef}
            className="w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none aspect-[3/4] bg-zinc-950 rounded-lg border border-zinc-800"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {images.map((imgUrl, idx) => (
              <div
                key={`slide-${idx}`}
                ref={(el) => { slideRefs.current[idx] = el; }}
                className="snap-start shrink-0 w-full h-full relative aspect-[3/4]"
                aria-hidden={activeIndex !== idx}
              >
                <Image
                  src={getOptimizedImageUrl(imgUrl, 800)}
                  alt={`${productName} — ${resolvedLabels[idx]}`}
                  fill
                  priority={idx === 0}
                  fetchPriority={idx === 0 ? 'high' : 'low'}
                  sizes="100vw"
                  quality={80}
                  placeholder="blur"
                  blurDataURL={getBlurPlaceholderUrl(imgUrl)}
                  className="object-cover"
                />
              </div>
            ))}

            {cinemagraphUrl && (
              <div
                ref={(el) => { slideRefs.current[images.length] = el; }}
                className="snap-start shrink-0 w-full h-full relative aspect-[3/4] bg-black flex items-center justify-center"
              >
                <video
                  src={cinemagraphUrl}
                  muted
                  playsInline
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Feature 7: Hold-to-Inspect overlay */}
          <AnimatePresence>
            {holdZoom && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute inset-0 z-30 overflow-hidden rounded-lg pointer-events-none"
              >
                <Image
                  src={getOptimizedImageUrl(currentImage, 1200)}
                  alt={`${productName} — inspect`}
                  fill
                  sizes="100vw"
                  quality={95}
                  className="object-cover"
                  style={{ transform: 'scale(1.8)', transformOrigin: 'center center' }}
                />
                <div className="absolute inset-0 ring-2 ring-white/20 rounded-lg" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feature 9: Smart Labels instead of dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 max-w-[90%] overflow-x-auto scrollbar-none">
            {Array.from({ length: totalSlides }).map((_, idx) => {
              const isActive = activeIndex === idx;
              const lbl = idx < images.length ? resolvedLabels[idx] : 'Motion';
              return (
                <button
                  key={`label-nav-${idx}`}
                  onClick={() => scrollToSlide(idx)}
                  className={`shrink-0 font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded transition-all duration-250 ${
                    isActive
                      ? 'bg-white text-black font-bold'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  aria-label={`Go to ${lbl}`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
