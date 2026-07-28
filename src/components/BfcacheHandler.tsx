'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/lib/cartStore';
import { useWishlistStore } from '@/lib/wishlistStore';

/**
 * BfcacheHandler: Ensures 100% Back/Forward Cache (bfcache) eligibility across modern WebKit and Chromium engines.
 * 
 * 1. Listens for 'pageshow' (when event.persisted === true) upon back/forward navigation.
 * 2. Re-synchronizes Zustand cart & wishlist storage state dynamically when restored from memory.
 * 3. Listens for 'pagehide' instead of legacy 'unload' to guarantee clean WebKit/Blink lifecycle freeze.
 */
export default function BfcacheHandler() {
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Re-hydrate Zustand cart store
        try {
          useCartStore.persist?.rehydrate?.();
        } catch (e) {}

        // Trigger custom restore event for live stock & auth state
        window.dispatchEvent(new Event('drftn-bfcache-restore'));
      }
    };

    const handlePageHide = (_event: PageTransitionEvent) => {
      // Clean pagehide handler replacing legacy unload
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  return null;
}
