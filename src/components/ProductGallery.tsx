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
import DrftnGalleryIndicator from './DrftnGalleryIndicator';

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

/**
 * Dynamic Ambient Product Glow — 4–6% opacity, large blur radius,
 * positioned strictly behind gallery area, fading smoothly into matte black #050505 background.
 */
function getAmbientGalleryGlow(color?: string): { background: string; filter: string } {
  if (!color) {
    return {
      background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 50%, transparent 75%)',
      filter: 'blur(80px)',
    };
  }
  const c = color.toLowerCase();
  let rgbaCenter = 'rgba(255, 255, 255, 0.05)';
  let rgbaMid = 'rgba(255, 255, 255, 0.015)';

  if (c.includes('white') || c.includes('cream') || c.includes('ivory') || c.includes('light')) {
    rgbaCenter = 'rgba(254, 243, 199, 0.05)'; // warm off-white
    rgbaMid = 'rgba(254, 243, 199, 0.015)';
  } else if (c.includes('navy') || c.includes('blue') || c.includes('indigo')) {
    rgbaCenter = 'rgba(59, 130, 246, 0.05)'; // soft blue
    rgbaMid = 'rgba(59, 130, 246, 0.015)';
  } else if (c.includes('red') || c.includes('crimson') || c.includes('burgundy')) {
    rgbaCenter = 'rgba(220, 38, 38, 0.05)'; // soft crimson
    rgbaMid = 'rgba(220, 38, 38, 0.015)';
  } else if (c.includes('green') || c.includes('olive') || c.includes('forest')) {
    rgbaCenter = 'rgba(34, 197, 94, 0.05)'; // soft green
    rgbaMid = 'rgba(34, 197, 94, 0.015)';
  } else if (c.includes('grey') || c.includes('gray')) {
    rgbaCenter = 'rgba(212, 212, 216, 0.05)'; // soft neutral grey
    rgbaMid = 'rgba(212, 212, 216, 0.015)';
  } else if (c.includes('brown') || c.includes('tan') || c.includes('camel')) {
    rgbaCenter = 'rgba(217, 119, 6, 0.05)'; // soft warm brown
    rgbaMid = 'rgba(217, 119, 6, 0.015)';
  } else {
    // black / dark
    rgbaCenter = 'rgba(255, 255, 255, 0.05)'; // soft neutral white
    rgbaMid = 'rgba(255, 255, 255, 0.015)';
  }

  return {
    background: `radial-gradient(circle at 50% 50%, ${rgbaCenter} 0%, ${rgbaMid} 50%, transparent 75%)`,
    filter: 'blur(80px)',
  };
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
  const isDesktopRef = useRef<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [tabVisible, setTabVisible] = useState<boolean>(true);

  // Mobile Hold to Inspect
  const [holdZoom, setHoldZoom] = useState<boolean>(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Continuous Auto-Scroll Gallery (Mobile + Desktop)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayStopped = useRef<boolean>(false);

  // Indicator autoplay progress
  const [autoplayProgress, setAutoplayProgress] = useState<number>(0);
  const [isAutoplayRunning, setIsAutoplayRunning] = useState<boolean>(true);
  const autoplayProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayStartTimeRef = useRef<number>(Date.now());
  const AUTOPLAY_DURATION = 3000;

  // Fast scroll protection timer
  const lastScrollTime = useRef<number>(0);

  // Progressive Reveal
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
  const ambientGlow = useMemo(() => getAmbientGalleryGlow(activeVariantColor), [activeVariantColor]);

  // Smart editorial labels
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
    isDesktopRef.current = mediaHover.matches;
    setReducedMotion(mediaReduced.matches);

    const h1 = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      isDesktopRef.current = e.matches;
    };
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

  // ─── Progressive Reveal ────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) return;
    revealControls.start({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
    });
  }, [reducedMotion, revealControls]);

  // ─── Continuous Auto-Scroll Gallery (Mobile + Desktop) ───────────────────
  useEffect(() => {
    if (reducedMotion || totalSlides <= 1 || isHovered || !tabVisible) {
      setIsAutoplayRunning(false);
      setAutoplayProgress(0);
      return;
    }

    autoplayStartTimeRef.current = Date.now();
    setAutoplayProgress(0);
    setIsAutoplayRunning(true);

    autoplayProgressRef.current = setInterval(() => {
      const elapsed = Date.now() - autoplayStartTimeRef.current;
      setAutoplayProgress(Math.min(elapsed / AUTOPLAY_DURATION, 1));
    }, 50);

    autoplayRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % totalSlides;

        // On mobile, physically scroll the scroll-snap container to the next slide
        if (!isDesktopRef.current && mobileScrollRef.current) {
          mobileScrollRef.current.scrollTo({
            left: next * mobileScrollRef.current.clientWidth,
            behavior: 'smooth',
          });
        }

        autoplayStartTimeRef.current = Date.now();
        setAutoplayProgress(0);
        return next;
      });
    }, AUTOPLAY_DURATION);

    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      if (autoplayProgressRef.current) clearInterval(autoplayProgressRef.current);
    };
  }, [reducedMotion, totalSlides, isHovered, tabVisible]);

  const resetAutoplayTimer = useCallback(() => {
    autoplayStartTimeRef.current = Date.now();
    setAutoplayProgress(0);
  }, []);



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

  // ─── Desktop Hover State ──────────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

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
    resetAutoplayTimer();
    setActiveIndex(index);
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTo({
        left: index * mobileScrollRef.current.clientWidth,
        behavior: 'smooth',
      });
    }
  }, [resetAutoplayTimer]);

  // ─── Mobile Hold to Inspect ─────────────────────────────────────────────
  const handleTouchStart = useCallback(() => {
    resetAutoplayTimer();
    holdTimerRef.current = setTimeout(() => {
      setHoldZoom(true);
    }, 400);
  }, [resetAutoplayTimer]);

  const handleTouchEnd = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setHoldZoom(false);
  }, []);

  // ─── Cinematic Image Switch Variants (Fade + Scale + Motion Blur under 120ms) ───
  const imageVariants = useMemo(() => ({
    initial: { opacity: 0, scale: 1.02, filter: 'blur(1.5px)' },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.985,
      filter: 'blur(1.5px)',
      transition: { duration: 0.10, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
    },
  }), []);

  // ─── Subtle Breathing Animation ──────────────────────────────────────────
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-full flex flex-col md:flex-row items-center justify-center gap-4 select-none mx-auto"
    >
      {/* ─── Dynamic Ambient Product Glow (strictly behind gallery area) ─── */}
      <div
        className="absolute -inset-10 -z-10 pointer-events-none rounded-full transition-all duration-700 ease-out transform-gpu"
        style={{
          background: ambientGlow.background,
          filter: ambientGlow.filter,
        }}
        aria-hidden="true"
      />

      {/* ── Desktop Left Thumbnails Strip ── */}
      <div className="hidden md:flex flex-col gap-3 w-20 shrink-0 sticky top-28 self-start max-h-[80vh] overflow-y-auto scrollbar-none z-10">
        {images.map((imgUrl, idx) => {
          const isSelected = activeIndex === idx;
          const label = resolvedLabels[idx];
          return (
            <motion.button
              key={`thumb-${idx}`}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                resetAutoplayTimer();
                setActiveIndex(idx);
              }}
              className={`group relative aspect-[3/4] w-full rounded-md overflow-hidden border-2 transition-colors duration-200 focus:outline-none ${
                isSelected
                  ? 'border-white ring-1 ring-white shadow-md'
                  : 'border-zinc-800/80 bg-zinc-950/80 opacity-60 hover:opacity-100 hover:border-zinc-500'
              }`}
              aria-label={`View ${label}`}
            >
              <Image
                src={getOptimizedImageUrl(imgUrl, 160)}
                alt={`${productName} thumbnail ${idx + 1}`}
                fill
                sizes="80px"
                loading="lazy"
                decoding="async"
                className="object-cover transform-gpu"
              />
            </motion.button>
          );
        })}

        {/* Cinemagraph Thumbnail */}
        {cinemagraphUrl && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => { resetAutoplayTimer(); setActiveIndex(images.length); }}
            className={`relative aspect-[3/4] w-full rounded-md overflow-hidden border-2 transition-colors duration-200 flex items-center justify-center bg-zinc-950 ${
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
          className="hidden md:block relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-2xl border border-zinc-800/60 bg-[#050505]"
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
                <div className="relative w-full h-full overflow-hidden">
                  {/* Breathing animation */}
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
                      loading={activeIndex === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      sizes="(min-width: 1024px) 50vw, (min-width: 768px) 60vw, 100vw"
                      quality={85}
                      placeholder="blur"
                      blurDataURL={getBlurPlaceholderUrl(currentImage)}
                      className="object-cover transform-gpu"
                    />
                  </motion.div>

                  {/* Shimmer overlay */}
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

                  {/* Hotspot Markers (hero image only) */}
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

          {/* DRFTN Signature Gallery Indicator — Desktop */}
          <DrftnGalleryIndicator
            total={totalSlides}
            activeIndex={activeIndex}
            accentColor={activeVariantColor}
            isAutoplayRunning={isAutoplayRunning}
            autoplayProgress={autoplayProgress}
            reducedMotion={reducedMotion}
            onSelect={(idx) => { resetAutoplayTimer(); setActiveIndex(idx); }}
            galleryRef={containerRef as React.RefObject<HTMLElement | null>}
          />
        </div>

        {/* ─── Mobile Scroll Snap Gallery ─────────────────────────────────── */}
        <div className="md:hidden relative w-full">
          <div
            ref={mobileScrollRef}
            className="w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none aspect-[3/4] bg-[#050505] rounded-lg border border-zinc-800"
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
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  sizes="100vw"
                  quality={80}
                  placeholder="blur"
                  blurDataURL={getBlurPlaceholderUrl(imgUrl)}
                  className="object-cover transform-gpu"
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

          {/* Mobile Hold-to-Inspect overlay */}
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
                  quality={90}
                  className="object-cover transform-gpu"
                  style={{ transform: 'scale(1.8)', transformOrigin: 'center center' }}
                />
                <div className="absolute inset-0 ring-2 ring-white/20 rounded-lg" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* DRFTN Signature Gallery Indicator — Mobile */}
          <DrftnGalleryIndicator
            total={totalSlides}
            activeIndex={activeIndex}
            accentColor={activeVariantColor}
            isAutoplayRunning={isAutoplayRunning}
            autoplayProgress={autoplayProgress}
            reducedMotion={reducedMotion}
            onSelect={scrollToSlide}
            galleryRef={containerRef as React.RefObject<HTMLElement | null>}
          />
        </div>
      </div>
    </motion.div>
  );
}
