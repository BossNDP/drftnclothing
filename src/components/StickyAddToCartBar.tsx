'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Check } from 'lucide-react';
import { Product } from '@/types';

interface StickyAddToCartBarProps {
  product: Product;
  selectedSize: string;
  selectedVariant?: any;
  isVisible: boolean;
  onAddToCart: () => void;
  isAdding: boolean;
  isOutOfStock: boolean;
}

/**
 * NOT SHOPIFY APPS:
 * Sticky add-to-cart bar is triggered by native browser IntersectionObserver
 * listening on the hero add-to-cart CTA, not expensive JS scroll listeners or 3rd party Shopify apps.
 */
export default function StickyAddToCartBar({
  product,
  selectedSize,
  selectedVariant,
  isVisible,
  onAddToCart,
  isAdding,
  isOutOfStock,
}: StickyAddToCartBarProps) {
  const currentPrice = selectedVariant?.price_override ?? product.price;
  const priceFormatted = `₹${Math.round(currentPrice / 100).toLocaleString('en-IN')}`;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-4 py-3 sm:px-6 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pointer-events-auto"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Product Summary Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 shrink-0 rounded bg-zinc-900 overflow-hidden border border-zinc-800 hidden sm:block">
                <img
                  src={selectedVariant?.images?.[0] || product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="truncate">
                <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider truncate">
                  {product.name}
                </h4>
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <span className="font-bold text-white">{priceFormatted}</span>
                  {selectedSize && (
                    <span className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                      SIZE: {selectedSize}
                    </span>
                  )}
                  {selectedVariant && (
                    <span className="text-zinc-400 text-[11px] hidden md:inline truncate">
                      • {selectedVariant.colour_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action CTA Button */}
            <div className="flex items-center gap-3 shrink-0">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onAddToCart}
                disabled={isAdding || isOutOfStock || !selectedSize}
                className={`relative px-6 sm:px-8 py-3 rounded-full font-mono text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isOutOfStock
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : !selectedSize
                    ? 'bg-zinc-800 text-amber-400 hover:bg-zinc-700'
                    : isAdding
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-white/10'
                }`}
              >
                {isAdding ? (
                  <>
                    <Check className="w-4 h-4 text-white animate-bounce" />
                    <span>ADDED TO BAG</span>
                  </>
                ) : isOutOfStock ? (
                  <span>SOLD OUT</span>
                ) : !selectedSize ? (
                  <span>SELECT A SIZE</span>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>ADD TO BAG • {priceFormatted}</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
