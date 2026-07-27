'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, Loader2 } from 'lucide-react';
import { Product } from '@/types';
import { getOptimizedImageUrl, getBlurPlaceholderUrl } from '@/lib/cloudinary';
import { useWishlistStore } from '@/lib/wishlistStore';
import { useUser, useClerk } from '@clerk/nextjs';
import HeartBurstAnimation from '@/components/HeartBurstAnimation';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

export default function ProductCard({
  product,
  priority = false,
  onRemove,
  showRemoveButton = false,
}: ProductCardProps) {
  const { isSignedIn } = useUser();
  const clerk = useClerk();
  const [burstTrigger, setBurstTrigger] = useState<number>(0);

  const isWishlisted = useWishlistStore((state) => state.wishlistIds.has(product.id));
  const isLoading = useWishlistStore((state) => state.loadingItemIds.has(product.id));
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const priceFormatted = `₹${Math.round(product.price / 100).toLocaleString('en-IN')}`;
  const comparePriceFormatted = product.compare_price
    ? `₹${Math.round(product.compare_price / 100).toLocaleString('en-IN')}`
    : null;

  const mainImage = product.images[0] || 'https://www.drftnclothing.in/og-default.jpg';
  const hoverImage = product.images[1] || mainImage;

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isWishlisted) {
      setBurstTrigger(Date.now());
    }

    toggleWishlist(
      product.id,
      !!isSignedIn,
      () => {
        if (clerk && clerk.openSignIn) {
          clerk.openSignIn();
        }
      },
      product
    );

    if (onRemove && isWishlisted) {
      onRemove();
    }
  };

  return (
    <div className="group relative flex flex-col h-full bg-zinc-950/80 border border-zinc-900 rounded-xl overflow-hidden hover:border-zinc-800 transition-all duration-300 cursor-pointer">
      {/* ── Image Box with Wishlist Button ── */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900 cursor-pointer">
        <Link href={`/shop/${product.slug}`} className="block w-full h-full cursor-pointer">
          <Image
            src={getOptimizedImageUrl(mainImage, 800)}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            quality={85}
            placeholder="blur"
            blurDataURL={getBlurPlaceholderUrl(mainImage)}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.images.length > 1 && (
            <Image
              src={getOptimizedImageUrl(hoverImage, 800)}
              alt={`${product.name} alternate view`}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              quality={85}
              className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
          )}
        </Link>

        {/* ── Top-Right Corner Wishlist Heart Button (Framer Motion 220ms 1 -> 1.25 -> 1) ── */}
        <button
          onClick={handleWishlistClick}
          disabled={isLoading}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/90 hover:scale-110 active:scale-95 transition-all shadow-lg overflow-hidden"
          aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          <HeartBurstAnimation triggerKey={burstTrigger} />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
          ) : (
            <motion.div
              key={isWishlisted ? 'filled' : 'outline'}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isWishlisted
                    ? 'fill-pink-500 text-pink-500 filter drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]'
                    : 'text-white/80 group-hover:text-white'
                }`}
              />
            </motion.div>
          )}
        </button>

        {/* Category Badge */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-black/75 backdrop-blur-md border border-white/10 text-zinc-300 rounded">
            {product.category}
          </span>
        </div>
      </div>

      {/* ── Details Box ── */}
      <div className="p-3.5 flex flex-col justify-between flex-1 space-y-2">
        <div>
          <Link href={`/shop/${product.slug}`} className="block group-hover:text-zinc-200">
            <h3 className="text-xs font-display font-black uppercase tracking-tight text-white line-clamp-1">
              {product.name}
            </h3>
          </Link>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xs font-mono font-extrabold text-white">
              {priceFormatted}
            </span>
            {comparePriceFormatted && (
              <span className="text-[10px] font-mono text-zinc-500 line-through">
                {comparePriceFormatted}
              </span>
            )}
          </div>
        </div>

        {/* Available Size Badges */}
        {product.sizes && product.sizes.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-1">
            {product.sizes.map((sz) => (
              <span
                key={sz}
                className="text-[9px] font-mono px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded shrink-0"
              >
                {sz}
              </span>
            ))}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {showRemoveButton ? (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleWishlistClick}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
            >
              Remove
            </motion.button>
          ) : (
            <Link
              href={`/shop/${product.slug}`}
              className="block w-full text-center py-2 bg-zinc-900 hover:bg-white hover:text-black border border-zinc-800 text-white rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            >
              View Garment
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
