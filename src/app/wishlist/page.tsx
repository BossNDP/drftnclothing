'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useWishlistStore } from '@/lib/wishlistStore';
import ProductCard from '@/components/ProductCard';
import { ProductCardSkeleton } from '@/components/Skeletons';

export default function WishlistPage() {
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();

  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);
  const wishlistProducts = useWishlistStore((state) => state.wishlistProducts);
  const loading = useWishlistStore((state) => state.loading);
  const initialized = useWishlistStore((state) => state.initialized);

  useEffect(() => {
    if (isLoaded) {
      fetchWishlist(!!isSignedIn);
    }
  }, [isLoaded, isSignedIn, fetchWishlist]);

  // Handle Unauthenticated State
  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-[80vh] bg-black text-white flex flex-col items-center justify-center p-6 pt-32 text-center select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full bg-zinc-950 border border-zinc-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-full bg-pink-950/40 border border-pink-500/30 flex items-center justify-center mb-6">
            <Heart className="w-8 h-8 text-pink-500 fill-pink-500/30" />
          </div>
          <h1 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-2">
            Access Your Wishlist
          </h1>
          <p className="text-xs font-mono text-zinc-400 mb-8 leading-relaxed">
            Please sign in to view your saved garments and sync your wishlist across all devices.
          </p>
          <button
            onClick={() => clerk?.openSignIn?.()}
            className="w-full py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-mono font-extrabold uppercase tracking-widest transition-all shadow-lg active:scale-95"
          >
            Sign In to Continue
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-32 selection:bg-white selection:text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-zinc-900 pb-6 mb-8 gap-2">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-zinc-500">
              SAVED SELECTION
            </span>
            <h1 className="text-3xl sm:text-4xl font-display font-black uppercase tracking-tight text-white mt-1">
              Wishlist
            </h1>
          </div>
          <div className="text-xs font-mono text-zinc-400">
            {initialized && (
              <span className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-white font-bold">
                {wishlistProducts.length} Saved {wishlistProducts.length === 1 ? 'Garment' : 'Garments'}
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {(!initialized || loading) && wishlistProducts.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={`wishlist-skel-${i}`} />
            ))}
          </div>
        ) : wishlistProducts.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 bg-zinc-950/50 border border-zinc-900/80 rounded-2xl"
          >
            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 relative">
              <Heart className="w-10 h-10 text-zinc-600 animate-pulse" />
              <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-pink-500/50 animate-ping" />
            </div>

            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-2">
              Your Wishlist is Empty
            </h2>
            <p className="text-xs font-mono text-zinc-400 max-w-sm mb-8 leading-relaxed">
              Save products you love and they&apos;ll appear here for easy shopping.
            </p>

            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-mono font-extrabold uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              <span>Continue Shopping</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        ) : (
          /* Product Grid */
          <motion.div
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            <AnimatePresence>
              {wishlistProducts.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, y: 12 }}
                  transition={{ duration: 0.25 }}
                >
                  <ProductCard product={product} showRemoveButton={true} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
