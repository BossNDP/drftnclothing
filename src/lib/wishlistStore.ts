'use client';

import { create } from 'zustand';
import { Product } from '@/types';
import { toast } from '@/lib/toast';
import { useAnimationStore } from '@/lib/animationStore';

interface WishlistState {
  wishlistIds: Set<string>;
  wishlistProducts: Product[];
  loading: boolean;
  loadingItemIds: Set<string>;
  initialized: boolean;
  
  // Actions
  fetchWishlist: (isLoggedIn: boolean) => Promise<void>;
  toggleWishlist: (
    productId: string,
    isLoggedIn: boolean,
    openAuthModal?: () => void,
    productObj?: Product
  ) => Promise<void>;
  has: (productId: string) => boolean;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  wishlistIds: new Set<string>(),
  wishlistProducts: [],
  loading: false,
  loadingItemIds: new Set<string>(),
  initialized: false,

  has: (productId: string) => {
    return get().wishlistIds.has(productId);
  },

  clear: () => {
    set({
      wishlistIds: new Set<string>(),
      wishlistProducts: [],
      initialized: false,
    });
  },

  fetchWishlist: async (isLoggedIn: boolean) => {
    if (!isLoggedIn) {
      get().clear();
      return;
    }

    set({ loading: true });
    try {
      const res = await fetch('/api/wishlist');
      if (res.ok) {
        const data = await res.json();
        const products: Product[] = data.products || [];
        const ids = new Set(products.map((p) => p.id));
        set({
          wishlistProducts: products,
          wishlistIds: ids,
          initialized: true,
        });
      }
    } catch (err) {
      console.error('[WishlistStore] Error fetching wishlist:', err);
    } finally {
      set({ loading: false });
    }
  },

  toggleWishlist: async (
    productId: string,
    isLoggedIn: boolean,
    openAuthModal?: () => void,
    productObj?: Product
  ) => {
    // 1. Guard for unauthenticated user
    if (!isLoggedIn) {
      if (openAuthModal) {
        openAuthModal();
      } else {
        toast.info('Please sign in to save items to your wishlist');
      }
      return;
    }

    const { wishlistIds, wishlistProducts, loadingItemIds } = get();

    // Prevent duplicate simultaneous clicks
    if (loadingItemIds.has(productId)) return;

    // Set item loading spinner
    const nextLoading = new Set(loadingItemIds);
    nextLoading.add(productId);
    set({ loadingItemIds: nextLoading });

    const isWishlisted = wishlistIds.has(productId);

    // Optimistic Update
    const nextIds = new Set(wishlistIds);
    let nextProducts = [...wishlistProducts];

    if (isWishlisted) {
      nextIds.delete(productId);
      nextProducts = nextProducts.filter((p) => p.id !== productId);
    } else {
      nextIds.add(productId);
      if (productObj && !nextProducts.some((p) => p.id === productId)) {
        nextProducts.unshift(productObj);
      }
    }

    // Trigger heart animation pulse & phone haptic vibration
    useAnimationStore.getState().triggerWishlistPulse();

    set({
      wishlistIds: nextIds,
      wishlistProducts: nextProducts,
    });

    try {
      const method = isWishlisted ? 'DELETE' : 'POST';
      const res = await fetch('/api/wishlist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      if (!res.ok) {
        throw new Error('Wishlist sync failed');
      }
    } catch (err) {
      console.error('[WishlistStore] Error updating wishlist:', err);
      toast.error('Failed to update wishlist');

      // Revert Optimistic State on Failure
      set({
        wishlistIds,
        wishlistProducts,
      });
    } finally {
      const finishLoading = new Set(get().loadingItemIds);
      finishLoading.delete(productId);
      set({ loadingItemIds: finishLoading });
    }
  },
}));
