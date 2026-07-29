'use client';

/**
 * CategoryRail
 *
 * Horizontal scroll-snap row of circular category thumbnails for the homepage.
 * Mirrors the visual style of /shop page category selector.
 *
 * Behaviour:
 * - Syncs selected category to ?cat= URL param (shallow, no navigation)
 * - Prefetches category Route Handler on hover/touchstart
 * - CSS scroll-snap — no JS scroll library, no Framer/GSAP
 * - Accessible: role="button", aria-pressed, visible focus ring
 * - Analytics stub: track('homepage_category_selected', { category })
 */

import React, { useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { CATEGORY_VISUALS, CATEGORY_IMAGE_OVERRIDES, HOME_CATEGORIES } from '@/lib/category-visuals';

// ---------------------------------------------------------------------------
// Analytics stub — wire to your provider later
// ---------------------------------------------------------------------------
function track(event: string, props: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as any).__analytics) {
    (window as any).__analytics.track(event, props);
  }
  // dev logging
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props);
  }
}

interface CategoryRailProps {
  /** Prefetch base URL; prefetches /api/products/category/[slug] on hover/touch */
  onPrefetch?: (slug: string) => void;
}

export default function CategoryRail({ onPrefetch }: CategoryRailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCat = searchParams.get('cat') || 'all';

  // Track which slugs have been prefetched to avoid re-firing
  const prefetchedRef = useRef<Set<string>>(new Set());

  const handleSelect = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(window.location.search);
      if (slug === 'all') {
        params.delete('cat');
      } else {
        params.set('cat', slug);
      }
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      router.replace(newUrl, { scroll: false });

      // Analytics hook
      track('homepage_category_selected', { category: slug });
    },
    [router]
  );

  const prefetch = useCallback(
    (slug: string) => {
      if (prefetchedRef.current.has(slug)) return;
      prefetchedRef.current.add(slug);
      // Prefetch Route Handler response
      router.prefetch(`/api/products/category/${slug}`);
      onPrefetch?.(slug);
    },
    [router, onPrefetch]
  );

  return (
    <div className="relative w-full">
      {/* Edge fade gradients — signals scrollability */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10"
        style={{
          background: 'linear-gradient(to right, #000 0%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10"
        style={{
          background: 'linear-gradient(to left, #000 0%, transparent 100%)',
        }}
      />

      {/* Scroll container */}
      <div
        role="group"
        aria-label="Shop by category"
        className="category-rail-scroll"
        style={{
          display: 'flex',
          gap: '14px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingBottom: '4px',
        }}
      >
        {HOME_CATEGORIES.map((cat) => {
          const isActive = selectedCat === cat.slug;
          const visualImg =
            CATEGORY_IMAGE_OVERRIDES[cat.slug] ||
            CATEGORY_VISUALS[cat.slug]?.image ||
            '';

          return (
            <div
              key={cat.slug}
              className="category-rail-item flex flex-col items-center shrink-0"
              style={{ scrollSnapAlign: 'start' }}
            >
              <button
                type="button"
                id={`category-btn-${cat.slug}`}
                role="button"
                aria-pressed={isActive}
                aria-label={`Show ${cat.label} products`}
                onClick={() => handleSelect(cat.slug)}
                onMouseEnter={() => prefetch(cat.slug)}
                onTouchStart={() => prefetch(cat.slug)}
                className={[
                  'relative overflow-hidden rounded-full transition-all duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                  // 44×44 minimum touch target on mobile, 72px on desktop
                  'w-[56px] h-[56px] md:w-[80px] md:h-[80px]',
                  'min-w-[44px] min-h-[44px]',
                  isActive
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105 opacity-100'
                    : 'opacity-70 hover:opacity-100 border border-zinc-700/60',
                ].join(' ')}
              >
                {/* Background image */}
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                  {visualImg ? (
                    <Image
                      src={visualImg}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      // Category images are decorative — skip priority
                      priority={false}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                      <span className="text-[9px] font-mono tracking-widest text-zinc-400 font-bold uppercase select-none">
                        {cat.label.substring(0, 3)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dark scrim for legibility */}
                <div className="absolute inset-0 bg-black/20" />

                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 z-10 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                    aria-hidden="true"
                  />
                )}
              </button>

              {/* Label */}
              <span
                className={[
                  'mt-2 text-center font-sans leading-none select-none',
                  'text-[9px] md:text-[10px] tracking-[0.14em] uppercase',
                  isActive ? 'text-white font-bold' : 'text-zinc-500',
                ].join(' ')}
              >
                {cat.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hide scrollbar cross-browser */}
      <style>{`
        .category-rail-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
