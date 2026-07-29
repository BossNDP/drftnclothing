'use client';

/**
 * THE EDIT — Premium Editorial Category Discovery
 *
 * Inspired by: COS, Represent, Fear of God, Aimé Leon Dore.
 *
 * Architecture:
 *   Mobile  → 92vh full-bleed snap-scroll story, one category per viewport
 *   Desktop → Stacked editorial blocks with horizontal scroll per category
 *
 * Performance contract:
 *   - 60 fps target (>50 fps under 4× CPU throttle)
 *   - Only CSS transitions + IntersectionObserver — zero animation libraries
 *   - will-change limited to ≤2 sections at a time
 *   - Native scroll only — never hijacked
 *   - GPU-only properties: transform, opacity
 */

import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { buildCategoryEditorialSlides, type CategoryEditorialSlide } from '@/lib/editorial-pairing';
import type { Product } from '@/types';

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */

const FALLBACK_IMAGE =
  'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto/v1785252749/drftn-products/e4flew2q0o5cdkc7qmeb.jpg';

const ENTRANCE_BEZIER = 'cubic-bezier(.22,.61,.36,1)';
const CARD_STAGGER = [0, 60, 120, 180]; // ms
const DESC_DELAY = 220;
const CTA_DELAY = 280;
const IDLE_MS = 700;

/* ─────────────────────────────────────────────
   Asymmetric card layout patterns
   Each pattern defines row-span hints for a 2×2 grid.
   Alternating patterns create editorial rhythm.
   ───────────────────────────────────────────── */

// Pattern A: large-left, short-right / short-left, large-right
// Pattern B: inverse
const ASPECT_PATTERNS = [
  ['aspect-[3/5]', 'aspect-[3/4]', 'aspect-[3/4]', 'aspect-[3/5]'], // Tall-Short / Short-Tall
  ['aspect-[3/4]', 'aspect-[3/5]', 'aspect-[3/5]', 'aspect-[3/4]'], // Short-Tall / Tall-Short
];

/* ─────────────────────────────────────────────
   Format price (paise → ₹)
   ───────────────────────────────────────────── */

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

/* ─────────────────────────────────────────────
   Memoised Mobile Card
   ───────────────────────────────────────────── */

interface MobileCardProps {
  product: Product;
  cardIndex: number;
  slideIndex: number;
  slideId: string;
  isActive: boolean;
  isPassed: boolean;
  isIdle: boolean;
  aspectClass: string;
}

const MobileCard = memo(function MobileCard({
  product,
  cardIndex,
  slideIndex,
  slideId,
  isActive,
  isPassed,
  isIdle,
  aspectClass,
}: MobileCardProps) {
  const delay = CARD_STAGGER[cardIndex] || 0;
  const rawImg = product.images?.[0] ?? FALLBACK_IMAGE;
  const imgSrc = getOptimizedImageUrl(rawImg, 600);

  return (
    <Link
      key={`${slideId}-card-${cardIndex}-${product.id}`}
      href={`/shop/${product.slug}`}
      className={`group relative overflow-hidden rounded-[20px] bg-zinc-900 w-full ${aspectClass} block cursor-pointer`}
      style={{
        opacity: isActive ? 1 : isPassed ? 0.35 : 0,
        transform: isActive
          ? 'translateY(0)'
          : isPassed
            ? 'translateY(-16px)'
            : 'translateY(20px)',
        transition: `opacity 500ms ${ENTRANCE_BEZIER} ${delay}ms, transform 500ms ${ENTRANCE_BEZIER} ${delay}ms`,
      }}
    >
      {/* Image with idle breathing */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          transform: isActive && isIdle ? 'scale(1.01)' : 'scale(1)',
          transition: isActive && isIdle
            ? 'transform 10s ease-in-out'
            : 'transform 500ms ease-out',
        }}
      >
        <Image
          src={imgSrc}
          alt={product.name || 'Product'}
          fill
          sizes="50vw"
          className="object-cover"
          priority={slideIndex === 0 && cardIndex < 2}
        />
      </div>

      {/* Bottom gradient — subtle, only for text legibility */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Product info */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
        <h4 className="text-[12px] font-medium text-white/90 uppercase tracking-wide leading-tight line-clamp-1">
          {product.name}
        </h4>
        <span className="text-[11px] font-mono font-bold text-white/70 mt-0.5 block">
          {formatPrice(product.price || 0)}
        </span>
      </div>
    </Link>
  );
});

/* ─────────────────────────────────────────────
   Memoised Desktop Card
   ───────────────────────────────────────────── */

interface DesktopCardProps {
  product: Product;
  cardIndex: number;
  slideId: string;
}

const DesktopCard = memo(function DesktopCard({
  product,
  cardIndex,
  slideId,
}: DesktopCardProps) {
  const rawImg = product.images?.[0] ?? FALLBACK_IMAGE;
  const imgSrc = getOptimizedImageUrl(rawImg, 700);

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group relative overflow-hidden rounded-[20px] bg-zinc-900 block flex-shrink-0 transition-all duration-250"
      style={{
        width: '280px',
        aspectRatio: '3/4',
      }}
    >
      <Image
        src={imgSrc}
        alt={product.name || 'Product'}
        fill
        sizes="280px"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Product info */}
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
        <h4 className="text-sm font-medium text-white/90 uppercase tracking-wide leading-tight line-clamp-1 group-hover:text-white transition-colors duration-200">
          {product.name}
        </h4>
        <span className="text-sm font-mono font-bold text-white/70 mt-1 block">
          {formatPrice(product.price || 0)}
        </span>
      </div>

      {/* Hover lift + shadow — GPU-only */}
      <style jsx>{`
        a:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
      `}</style>
    </Link>
  );
});

/* ─────────────────────────────────────────────
   Desktop Horizontal Scroll Row
   ───────────────────────────────────────────── */

interface DesktopCategoryRowProps {
  slide: CategoryEditorialSlide;
  slideIndex: number;
}

const DesktopCategoryRow = memo(function DesktopCategoryRow({
  slide,
  slideIndex,
}: DesktopCategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

  const descriptionLines = slide.description.split('\n');

  return (
    <div className="w-full py-12 first:pt-0 border-b border-white/[0.06] last:border-b-0">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-zinc-500 uppercase block mb-1">
            THE EDIT
          </span>
          <h3 className="text-4xl xl:text-5xl font-display font-black text-white uppercase tracking-tight leading-none">
            {slide.title}
          </h3>
          <div className="mt-2">
            {descriptionLines.map((line, i) => (
              <p key={i} className="text-sm text-zinc-400 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={`/shop?category=${slide.categorySlug}`}
            className="group/cta text-sm font-mono text-zinc-300 uppercase tracking-wider hover:text-white transition-colors duration-200 relative"
          >
            {slide.ctaText}
            <span className="absolute left-0 -bottom-0.5 w-0 h-px bg-white group-hover/cta:w-full transition-all duration-300 ease-out" />
          </Link>

          {/* Scroll arrows */}
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 disabled:opacity-20 disabled:pointer-events-none transition-all duration-200"
              aria-label="Scroll left"
            >
              ←
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 disabled:opacity-20 disabled:pointer-events-none transition-all duration-200"
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal card scroll */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none pb-2"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {slide.cards.map((prod, cIdx) => (
          <div key={`desktop-${slide.id}-${cIdx}`} style={{ scrollSnapAlign: 'start' }}>
            <DesktopCard product={prod} cardIndex={cIdx} slideId={slide.id} />
          </div>
        ))}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

interface FeaturedStorySectionProps {
  products: Product[];
}

export default function FeaturedStorySection({ products }: FeaturedStorySectionProps) {
  const slides = useMemo(() => buildCategoryEditorialSlides(products), [products]);

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isIdle, setIsIdle] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Idle timer (700ms after scroll stops) ──
  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), IDLE_MS);
  }, []);

  // ── IntersectionObserver for slide tracking ──
  useEffect(() => {
    if (typeof window === 'undefined' || slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            const idx = Number(entry.target.getAttribute('data-slide-index'));
            if (!isNaN(idx)) {
              setActiveSlideIndex(idx);
              resetIdleTimer();
            }
          }
        }
      },
      { threshold: [0, 0.4, 0.8] }
    );

    slideRefs.current.forEach((el) => el && observer.observe(el));
    resetIdleTimer();

    return () => {
      observer.disconnect();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [slides.length, resetIdleTimer]);

  if (slides.length === 0) return null;

  // ── Progress fill for mobile vertical line ──
  const progressPct = ((activeSlideIndex + 1) / slides.length) * 100;

  return (
    <section
      ref={sectionRef}
      className="w-full bg-black text-white relative z-10"
      aria-labelledby="the-edit-heading"
    >
      <h2 id="the-edit-heading" className="sr-only">
        The Edit — Curated Categories
      </h2>

      {/* ════════════════════════════════════════════
          MOBILE / TABLET (<1024px): 92vh snap story
          ════════════════════════════════════════════ */}
      <div className="lg:hidden relative w-full bg-black">
        {/* Vertical progress indicator — right edge */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="relative w-[2px] h-[100px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full bg-white/60 rounded-full"
              style={{
                height: `${progressPct}%`,
                transition: 'height 400ms ease',
              }}
            />
          </div>
        </div>

        {/* Snap-scroll container */}
        <div
          className="w-full overflow-y-auto scrollbar-none"
          style={{
            height: '92vh',
            maxHeight: '920px',
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {slides.map((slide, slideIdx) => {
            const isActive = activeSlideIndex === slideIdx;
            const isPassed = activeSlideIndex > slideIdx;
            const isWillChange =
              slideIdx === activeSlideIndex || slideIdx === activeSlideIndex + 1;
            const pattern = ASPECT_PATTERNS[slideIdx % ASPECT_PATTERNS.length];
            const descriptionLines = slide.description.split('\n');

            return (
              <div
                key={slide.id}
                ref={(el) => { slideRefs.current[slideIdx] = el; }}
                data-slide-index={slideIdx}
                className="relative flex flex-col bg-black"
                style={{
                  height: '92vh',
                  maxHeight: '920px',
                  scrollSnapAlign: 'start',
                  padding: '20px',
                  willChange: isWillChange ? 'transform, opacity' : 'auto',
                }}
              >
                {/* ── Header ── */}
                <div
                  className="w-full z-20 mb-2"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateY(0)' : 'translateY(12px)',
                    transition: `opacity 500ms ${ENTRANCE_BEZIER}, transform 500ms ${ENTRANCE_BEZIER}`,
                  }}
                >
                  <span className="text-[9px] font-mono font-bold tracking-[0.25em] text-zinc-500 uppercase block">
                    THE EDIT
                  </span>
                  <h3 className="text-2xl font-display font-black text-white uppercase tracking-tight leading-none mt-0.5">
                    {slide.title}
                  </h3>
                  <div
                    className="mt-1.5"
                    style={{
                      opacity: isActive ? 1 : 0,
                      transition: `opacity 500ms ${ENTRANCE_BEZIER} ${DESC_DELAY}ms`,
                    }}
                  >
                    {descriptionLines.map((line, i) => (
                      <p
                        key={i}
                        className="text-[13px] text-white/60 leading-relaxed"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>

                {/* ── 2×2 Asymmetric Card Grid ── */}
                <div className="w-full flex-1 grid grid-cols-2 gap-3 z-10 content-center">
                  {slide.cards.map((prod, cardIdx) => (
                    <MobileCard
                      key={`${slide.id}-${cardIdx}-${prod.id}`}
                      product={prod}
                      cardIndex={cardIdx}
                      slideIndex={slideIdx}
                      slideId={slide.id}
                      isActive={isActive}
                      isPassed={isPassed}
                      isIdle={isIdle}
                      aspectClass={pattern[cardIdx] || 'aspect-[3/4]'}
                    />
                  ))}
                </div>

                {/* ── CTA ── */}
                <div
                  className="w-full z-20 mt-3 flex justify-center"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateY(0)' : 'translateY(8px)',
                    transition: `opacity 500ms ${ENTRANCE_BEZIER} ${CTA_DELAY}ms, transform 500ms ${ENTRANCE_BEZIER} ${CTA_DELAY}ms`,
                  }}
                >
                  <Link
                    href={`/shop?category=${slide.categorySlug}`}
                    className="group/cta text-[12px] font-mono text-zinc-300 uppercase tracking-widest hover:text-white transition-colors duration-200 relative py-1"
                  >
                    {slide.ctaText}
                    <span className="absolute left-0 -bottom-0 w-0 h-px bg-white/60 group-hover/cta:w-full transition-all duration-300 ease-out" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          DESKTOP (≥1024px): Stacked editorial blocks
          ════════════════════════════════════════════ */}
      <div className="hidden lg:block max-w-screen-2xl mx-auto px-8 xl:px-12 py-16">
        {slides.map((slide, slideIdx) => (
          <DesktopCategoryRow
            key={`desktop-${slide.id}`}
            slide={slide}
            slideIndex={slideIdx}
          />
        ))}
      </div>
    </section>
  );
}
