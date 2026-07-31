'use client';

/**
 * ProductWall
 *
 * 2-col mobile / 3-col desktop product grid for the homepage category section.
 *
 * Behaviour:
 * - Receives initialProducts (SSR data for "All") — no client waterfall on first load
 * - Watches ?cat= URL param; fetches /api/products/category/[slug] on change
 * - Crossfade transition: CSS opacity + scale(0.98→1), 200ms, NO GSAP / Framer
 * - Skeleton shimmer cards while loading (exact aspect ratio, zero CLS)
 * - aria-live="polite" region for screen-reader announcements
 * - Image: next/image + Cloudinary, sizes="(max-width: 768px) 50vw, 33vw"
 *   priority=true only for first 4 cards (above-the-fold)
 * - Hover image-swap only for pointer:fine (desktop) — disabled on touch
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import type { Product } from '@/types';

// ---------------------------------------------------------------------------
// Shimmer Skeleton Card (Aspect 4:5)
// ---------------------------------------------------------------------------
function WallSkeletonCard() {
  return (
    <div
      className="w-full overflow-hidden rounded-sm bg-zinc-900"
      aria-hidden="true"
    >
      <div className="aspect-[4/5] w-full relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s infinite',
          }}
        />
      </div>
      <div className="p-2.5 space-y-2">
        <div className="h-3 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/3" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Card (4:5 portrait, name + price only, no discount badge)
// ---------------------------------------------------------------------------
interface WallCardProps {
  product: Product;
  index: number;
}

function WallCard({ product, index }: WallCardProps) {
  const [hovered, setHovered] = useState(false);
  const isAboveFold = index < 4;

  const primaryImage = product.images[0] || '';
  const secondaryImage = product.images[1] || '';
  const hasSecond = Boolean(secondaryImage);

  const totalStock = product.sizes
    ? product.sizes.reduce((acc, s) => acc + (product.stock_quantity?.[s] || 0), 0)
    : 0;
  const showLowStock = totalStock > 0 && totalStock < 5;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col bg-transparent w-full text-left"
      aria-label={`View ${product.name} — ₹${(product.price / 100).toLocaleString('en-IN')}`}
    >
      {/* Image area */}
      <div
        className="relative overflow-hidden rounded-sm bg-zinc-950 aspect-[4/5] w-full border border-white/[0.06] group-hover:border-white/20 transition-colors duration-300"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Primary image */}
        <Image
          src={getOptimizedImageUrl(primaryImage, 600)}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          priority={isAboveFold}
        />

        {/* Secondary image — hover swap (pointer:fine only via CSS) */}
        {hasSecond && (
          <Image
            src={getOptimizedImageUrl(secondaryImage, 600)}
            alt={`${product.name} alternate view`}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            priority={false}
            className="object-cover absolute inset-0 transition-opacity duration-300 hover-swap-image"
            style={{ opacity: 0 }}
          />
        )}

        {/* Low Stock Scarcity Pill (ONLY if stock < 5) */}
        {showLowStock && (
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 bg-black/95 text-rose-300 border border-rose-500/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-mono font-black tracking-wider uppercase whitespace-nowrap shadow-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span>{totalStock} LEFT</span>
            </span>
          </div>
        )}

        {/* Bottom scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Info: Name (single line, ellipsis-truncate if long) + Price only */}
      <div className="pt-2.5 pb-1 flex flex-col space-y-0.5 text-left">
        <h3 className="text-xs font-medium text-white/90 uppercase tracking-wide truncate group-hover:text-white transition-colors duration-200">
          {product.name}
        </h3>
        <div className="flex items-baseline font-mono pt-0.5">
          <span className="text-sm font-black text-white tracking-tight">
            ₹{(product.price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main ProductWall
// ---------------------------------------------------------------------------
interface ProductWallProps {
  /** SSR-loaded "All" products — skips first client fetch */
  initialProducts: Product[];
}

export default function ProductWall({ initialProducts }: ProductWallProps) {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat') || 'all';

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);
  const [announcement, setAnnouncement] = useState('');

  // Track last fetched category to avoid duplicate requests
  const lastFetchedRef = useRef<string>('all');
  // Track whether we have fresh data for the current cat
  const cacheRef = useRef<Map<string, Product[]>>(
    new Map([['all', initialProducts]])
  );

  const fetchCategory = useCallback(async (slug: string) => {
    // Cache hit
    if (cacheRef.current.has(slug)) {
      const cached = cacheRef.current.get(slug)!;
      setVisible(false);
      setTimeout(() => {
        setProducts(cached);
        setVisible(true);
        setAnnouncement(
          `Showing ${cached.length} product${cached.length !== 1 ? 's' : ''} in ${slug === 'all' ? 'All categories' : slug}`
        );
      }, 120);
      return;
    }

    setLoading(true);
    setVisible(false);

    try {
      const res = await fetch(`/api/products/category/${slug}`, {
        next: { revalidate: 3600 },
      } as RequestInit);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const fetched: Product[] = data.products || [];

      cacheRef.current.set(slug, fetched);

      setTimeout(() => {
        setProducts(fetched);
        setVisible(true);
        setAnnouncement(
          `Showing ${fetched.length} product${fetched.length !== 1 ? 's' : ''} in ${slug === 'all' ? 'All categories' : slug}`
        );
        setLoading(false);
      }, 120);
    } catch (err) {
      console.error('[ProductWall] fetch failed:', err);
      setVisible(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (catParam === lastFetchedRef.current) return;
    lastFetchedRef.current = catParam;
    fetchCategory(catParam);
  }, [catParam, fetchCategory]);

  useEffect(() => {
    setAnnouncement(
      `Showing ${initialProducts.length} product${initialProducts.length !== 1 ? 's' : ''} in All categories`
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayProducts = products.slice(0, 8);
  const showSkeleton = loading && displayProducts.length === 0;

  return (
    <div className="w-full">
      {/* Screen-reader live region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announcement}
      </div>

      {/* Product grid: 2-column mobile / 4-column desktop */}
      <div
        className="product-wall-grid"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.98)',
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        }}
      >
        {showSkeleton ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <WallSkeletonCard key={i} />
            ))}
          </div>
        ) : displayProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
            {displayProducts.map((prod, i) => (
              <WallCard key={prod.id} product={prod} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <p className="text-zinc-500 text-xs tracking-widest uppercase font-mono">
              No products found
            </p>
            <p className="text-zinc-600 text-[11px]">
              New drops are coming — check back soon.
            </p>
          </div>
        )}
      </div>

      {/* Global shimmer + hover-swap CSS */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        /* Hover image swap: only on non-touch devices */
        @media (pointer: fine) {
          .group:hover .hover-swap-image {
            opacity: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

