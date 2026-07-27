'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, SlidersHorizontal, Grid3X3, Grid2X2, ArrowUpDown, X, Sparkles, Plus, ShoppingBag, Heart, Loader2 } from 'lucide-react';
import { dbService } from '@/lib/db';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import SignatureGallery from '@/components/SignatureGallery';
import { Product, Category } from '@/types';
import { useCartStore } from '@/lib/cartStore';
import { useWishlistStore } from '@/lib/wishlistStore';
import { useUser, useClerk } from '@clerk/nextjs';
import { useAnimationStore } from '@/lib/animationStore';
import { toast } from '@/lib/toast';
import { ProductGridSkeleton } from '@/components/Skeletons';
import HeartBurstAnimation from '@/components/HeartBurstAnimation';

const CATEGORY_VISUALS: Record<string, { label: string; image: string }> = {
  all: {
    label: 'All Drops',
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop&q=80',
  },
  't-shirts': {
    label: 'Tees',
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=400&fit=crop&q=80',
  },
  shirts: {
    label: 'Shirts',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop&q=80',
  },
  denims: {
    label: 'Denims',
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop&q=80',
  },
  'formal-pants': {
    label: 'Trousers',
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=400&fit=crop&q=80',
  },
  sweatshirts: {
    label: 'Sweats',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=400&fit=crop&q=80',
  },
  hoodies: {
    label: 'Hoodies',
    image: 'https://images.unsplash.com/photo-1556821840-47b2c0d5c829?w=400&h=400&fit=crop&q=80',
  },
  jackets: {
    label: 'Jackets',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop&q=80',
  },
};

// Suspense boundary for search params
export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="py-16 md:py-24 px-8 md:px-12 max-w-screen-2xl mx-auto w-full">
        <div className="h-10 shimmer w-1/4 mb-10" />
        <ProductGridSkeleton count={8} />
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}

/* ─────────────────────────────────────────────────────
   SHOP PRODUCT CARD — logic unchanged, visual upgrade
   ───────────────────────────────────────────────────── */
function ShopProductCard({
  prod,
  onQuickAdd,
  aspectClass = 'aspect-[3/4]',
  index = 0,
}: {
  prod: Product;
  onQuickAdd: (e: React.MouseEvent, p: Product) => void;
  aspectClass?: string;
  index?: number;
}) {
  const { isSignedIn } = useUser();
  const clerk = useClerk();
  const [burstTrigger, setBurstTrigger] = useState<number>(0);

  const isWishlisted = useWishlistStore((state) => state.wishlistIds.has(prod.id));
  const isLoadingWishlist = useWishlistStore((state) => state.loadingItemIds.has(prod.id));
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const [isAdding, setIsAdding] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isOutOfStock = prod.sizes.every((s) => (prod.stock_quantity[s] || 0) === 0);
  const displayImages = prod.images.slice(0, 3);
  const imageCount = displayImages.length;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current || imageCount <= 1 || isOutOfStock) return;
    if (!hasInteracted) setHasInteracted(true);
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.min(imageCount - 1, Math.floor(pct * imageCount));
    if (idx !== activeIdx) {
      setActiveIdx(idx);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!cardRef.current || imageCount <= 1 || isOutOfStock) return;
    if (!hasInteracted) setHasInteracted(true);
    const rect = cardRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.min(imageCount - 1, Math.floor(pct * imageCount));
    if (idx !== activeIdx) {
      setActiveIdx(idx);
    }
  };

  const handlePointerLeave = () => {
    setActiveIdx(0);
  };

  const handleQuickAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAdding || isOutOfStock) return;
    setIsAdding(true);
    setTimeout(() => setIsAdding(false), 900);
    onQuickAdd(e, prod);
  };

  // Stagger reveal on viewport entry
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' as const, delay: index * 0.08 }
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-10%' }}
      className="w-full"
    >
      <Link
        href={`/shop/${prod.slug}`}
        className="group flex flex-col bg-transparent text-left w-full relative"
        aria-label={`View ${prod.name} — ₹${(prod.price / 100).toLocaleString('en-IN')}`}
      >
        <motion.div
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col w-full text-left"
        >
          {/* Image Container */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handlePointerLeave}
            data-cursor="product"
            className="product-image-hoverable relative overflow-hidden rounded-md bg-brand-charcoal w-full aspect-[3/4] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          >
            <SignatureGallery
              images={displayImages}
              activeIndex={activeIdx}
              onChangeIndex={(idx) => setActiveIdx(idx)}
              aspectClass="aspect-[3/4]"
              sizes="(max-width: 768px) 50vw, 25vw"
              enableDrag={true}
              imageWidth={800}
              layoutId={`product-image-${prod.slug}`}
              overlayLeft={
                (() => {
                  const totalStock = prod.sizes.reduce((acc, s) => acc + (prod.stock_quantity[s] || 0), 0);
                  if (totalStock === 0) {
                    return (
                      <div className="p-0.5 rounded-sm bg-black/60 backdrop-blur-sm">
                        <span className="bg-zinc-950/90 text-zinc-400 border border-zinc-700/60 backdrop-blur-md px-2.5 py-0.5 rounded-sm text-[9px] font-mono font-bold tracking-[0.18em] uppercase shadow-md">
                          GONE
                        </span>
                      </div>
                    );
                  }
                  if (totalStock > 0 && totalStock <= 8) {
                    return (
                      <div className="p-0.5 rounded-full bg-gradient-to-r from-black/80 via-black/40 to-transparent backdrop-blur-sm">
                        <span className="inline-flex items-center gap-1.5 bg-rose-950/90 text-rose-300 border border-rose-500/50 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-[0.16em] uppercase shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                          LOW STOCK · {totalStock} LEFT
                        </span>
                      </div>
                    );
                  }
                  const isBestseller = Boolean(
                    (prod as any).is_bestseller ||
                    (prod as any).is_bestseller_hero ||
                    prod.slug === 'striped-knit-polo'
                  );
                  if (isBestseller) {
                    return (
                      <div className="p-0.5 rounded-full bg-gradient-to-r from-black/80 via-black/40 to-transparent backdrop-blur-sm">
                        <span className="inline-flex items-center gap-1.5 bg-amber-950/90 text-amber-300 border border-amber-500/50 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-[0.18em] uppercase shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          BESTSELLER
                        </span>
                      </div>
                    );
                  }
                  const isNew = Boolean(
                    (prod as any).is_new ||
                    (prod as any).is_new_drop ||
                    prod.slug === 'knitted-drop-polo' ||
                    prod.slug === 'washed-plaid-overshirt'
                  );
                  if (isNew) {
                    return (
                      <div className="p-0.5 rounded-full bg-gradient-to-r from-black/80 via-black/40 to-transparent backdrop-blur-sm">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-[0.18em] uppercase shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          NEW DROP
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()
              }
              overlayRight={null}
            />

            {/* Desktop Only Ghost Text Overlay */}
            <div className="absolute inset-0 pointer-events-none z-[12] flex items-center justify-center p-4 hidden md:flex">
              <span
                style={{
                  fontSize: 'clamp(1.2rem, 3.5vw, 2.5rem)',
                  WebkitTextStroke: '1px var(--drftn-white)',
                  color: 'transparent',
                }}
                className="text-center font-display font-black uppercase tracking-tighter text-transparent opacity-0 group-hover:opacity-85 transition-all duration-[300ms] ease-out select-none"
              >
                {prod.name}
              </span>
            </div>

            {/* Subtle bottom dark gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none z-[11]" />

            {/* Top-Right Corner Wishlist Heart Button (Framer Motion 220ms 1 -> 1.25 -> 1) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isWishlisted) {
                  setBurstTrigger(Date.now());
                }
                toggleWishlist(
                  prod.id,
                  !!isSignedIn,
                  () => clerk?.openSignIn?.(),
                  prod
                );
              }}
              disabled={isLoadingWishlist}
              className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/90 hover:scale-110 active:scale-95 transition-all shadow-lg pointer-events-auto overflow-hidden"
              aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            >
              <HeartBurstAnimation triggerKey={burstTrigger} />
              {isLoadingWishlist ? (
                <Loader2 className="w-3.5 h-3.5 text-zinc-300 animate-spin" />
              ) : (
                <motion.div
                  key={isWishlisted ? 'filled' : 'outline'}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                >
                  <Heart
                    className={`w-3.5 h-3.5 transition-colors ${
                      isWishlisted
                        ? 'fill-pink-500 text-pink-500 filter drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]'
                        : 'text-white/80 group-hover:text-white'
                    }`}
                  />
                </motion.div>
              )}
            </button>

            {/* Corner-Anchored Quick Add Button with Scale-Bounce & Flash */}
            {!isOutOfStock && (
              <div className="absolute bottom-3 right-3 z-20">
                <button
                  type="button"
                  onClick={handleQuickAddClick}
                  disabled={isAdding}
                  className={`w-9 h-9 rounded-sm flex items-center justify-center transition-all duration-300 active:scale-85 border shadow-xl ${
                    isAdding
                      ? 'bg-emerald-400 text-black border-emerald-300 scale-110 shadow-[0_0_20px_rgba(52,211,153,0.8)] animate-scale-bounce'
                      : 'bg-black/80 hover:bg-white hover:text-black text-white border-white/30 backdrop-blur-md hover:scale-105'
                  }`}
                  aria-label={`Quick add ${prod.name} to cart`}
                >
                  {isAdding ? (
                    <span className="text-sm font-mono font-black text-black">✓</span>
                  ) : (
                    <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Product Details (Unified Rhythm) */}
          <div className="pt-3 pb-4 flex flex-col text-left space-y-1">
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em] font-medium">
              {prod.category}
            </p>
            {/* Muted light weight title */}
            <h3 className="text-xs font-medium text-white/70 tracking-wide uppercase line-clamp-1 group-hover:text-white transition-colors">
              {prod.name}
            </h3>
            {/* Dominant visual anchor price */}
            <div className="flex items-baseline gap-2 font-mono pt-0.5">
              <span className="text-base md:text-lg font-black text-white tracking-tight drop-shadow-sm">
                ₹{(prod.price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
              {prod.compare_price && prod.compare_price > prod.price && (
                <>
                  <span className="text-xs text-zinc-500 line-through font-normal">
                    ₹{(prod.compare_price / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold tracking-wide">
                    -{Math.round(((prod.compare_price - prod.price) / prod.compare_price) * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

type ShopGridItem = 
  | { type: 'product'; product: Product; spanClass: string }
  | { type: 'banner'; id: string; title: string; subtitle: string; image: string; category: string; spanClass: string };

const getShopGridItems = (products: Product[]): ShopGridItem[] => {
  const items: ShopGridItem[] = [];
  let pIdx = 0;
  let i = 0;
  
  while (pIdx < products.length) {
    const pos = i % 6;
    if (pos === 5) {
      items.push({
        type: 'banner',
        id: `banner-${i}`,
        title: 'DROP 01 — BUILT DIFFERENT',
        subtitle: 'THE TECHWEAR MANIFESTO',
        image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200',
        category: 'sweatshirts',
        spanClass: 'col-span-2 md:col-span-4 w-full h-[320px] md:h-[480px]'
      });
    } else {
      const spanClass = pos === 2 
        ? 'col-span-2 md:col-span-2 md:row-span-2' 
        : 'col-span-1';
      items.push({
        type: 'product',
        product: products[pIdx++],
        spanClass
      });
    }
    i++;
  }
  return items;
};

/* ─────────────────────────────────────────────────────
   MAIN SHOP CONTENT — all filter/sort/routing logic unchanged
   ───────────────────────────────────────────────────── */
function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductForSize, setSelectedProductForSize] = useState<Product | null>(null);
  const [quickAddEvent, setQuickAddEvent] = useState<React.MouseEvent | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);

  // Filter States — all unchanged
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<number>(3000);
  const [sortBy, setSortBy] = useState<string>('featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const lastScrollY = useRef(0);

  const searchQuery = searchParams.get('search') || '';

  // Scroll Position Listener for Sticky/Shrink Header + Directional show/hide matching Navbar
  useEffect(() => {
    let rafId: number | null = null;
    let isStickyState = false;
    let hideHeaderState = false;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const y = window.scrollY;
        const nextSticky = y > 120;
        let nextHide = false;

        if (y > lastScrollY.current && y > 80) {
          nextHide = true;
        }

        lastScrollY.current = y;

        if (nextSticky !== isStickyState) {
          isStickyState = nextSticky;
          setIsSticky(nextSticky);
        }
        if (nextHide !== hideHeaderState) {
          hideHeaderState = nextHide;
          setHideHeader(nextHide);
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Synchronize from URL — unchanged
  useEffect(() => {
    const cat = searchParams.get('category');
    setSelectedCategory(cat || 'all');
    const subcat = searchParams.get('subcategory');
    setSelectedSubcategory(subcat || 'all');
  }, [searchParams]);

  // Fetch products & categories — dynamic database load
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [prods, cats] = await Promise.all([
          dbService.getProducts(),
          dbService.getCategories()
        ]);
        setProducts(prods);
        setCategoriesList(cats);
      } catch (err) {
        console.error('Failed to load shop page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Category handlers — unchanged
  const handleCategoryChange = (catSlug: string) => {
    setSelectedCategory(catSlug);
    setSelectedSubcategory('all');
    setVisibleCount(12);
    const params = new URLSearchParams(window.location.search);
    if (catSlug === 'all') { params.delete('category'); } else { params.set('category', catSlug); }
    params.delete('subcategory');
    router.push(`/shop?${params.toString()}`);
  };

  const handleSubcategoryChange = (subcatSlug: string) => {
    setSelectedSubcategory(subcatSlug);
    setVisibleCount(12);
    const params = new URLSearchParams(window.location.search);
    if (subcatSlug === 'all') { params.delete('subcategory'); } else { params.set('subcategory', subcatSlug); }
    router.push(`/shop?${params.toString()}`);
  };

  // Filter and Sort Logic — updated with search query support
  useEffect(() => {
    let result = [...products];
    if (selectedCategory !== 'all') result = result.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
    if (selectedSubcategory !== 'all') result = result.filter((p) => p.subcategory && p.subcategory.toLowerCase() === selectedSubcategory.toLowerCase());
    if (selectedGender !== 'all') result = result.filter((p) => p.gender.toLowerCase() === selectedGender.toLowerCase() || p.gender.toLowerCase() === 'unisex');
    if (selectedSize !== 'all') result = result.filter((p) => p.sizes.includes(selectedSize));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q))
      );
    }
    result = result.filter((p) => (p.price / 100) <= priceRange);
    if (sortBy === 'newest') result.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    else if (sortBy === 'price-low-high') result.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-high-low') result.sort((a, b) => b.price - a.price);
    else if (sortBy === 'featured') result.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
    setFilteredProducts(result);
    setVisibleCount(12); // reset visible on filter change
  }, [products, selectedCategory, selectedSubcategory, selectedGender, selectedSize, priceRange, sortBy, searchQuery]);

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedSubcategory('all');
    setSelectedGender('all');
    setSelectedSize('all');
    setPriceRange(3000);
    setSortBy('featured');
    setVisibleCount(12);
    router.push('/shop');
  };

  // Quick add — updated to ask for size
  const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const availableSizes = product.sizes.filter(s => (product.stock_quantity[s] || 0) > 0);
    if (availableSizes.length === 0) {
      toast.error('This product is completely sold out!');
      return;
    }

    // Save details to open size selector modal
    setQuickAddEvent(e);
    setSelectedProductForSize(product);
  };

  const handleSizeSelect = (size: string) => {
    if (!selectedProductForSize) return;

    const product = selectedProductForSize;
    const e = quickAddEvent;

    setSelectedProductForSize(null);
    setQuickAddEvent(null);

    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      compare_price: product.compare_price,
      image: product.images[0] || '',
      size: size,
    }, 1);

    if (e) {
      let cartEl = document.getElementById('navbar-cart-btn');
      if (!cartEl || cartEl.getBoundingClientRect().width === 0) cartEl = document.getElementById('mobile-cart-trigger');
      if (cartEl) {
        const cartRect = cartEl.getBoundingClientRect();
        const endX = cartRect.left + cartRect.width / 2;
        const endY = cartRect.top + cartRect.height / 2;

        // Find product card based on name/slug to get image element
        const cardEl = document.querySelector(`a[href="/shop/${product.slug}"]`);
        const imgEl = cardEl?.querySelector('img');
        const sourceRect = imgEl ? imgEl.getBoundingClientRect() : e.currentTarget?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };

        useAnimationStore.getState().addFlyingItem({
          imageUrl: product.images[0] || '',
          start: { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 },
          end: { x: endX, y: endY },
        });
      } else {
        useAnimationStore.getState().triggerCartPulse();
      }
    } else {
      useAnimationStore.getState().triggerCartPulse();
    }
    toast.cartSuccess(product.name, product.images[0] || '');
  };

  const MAIN_CATEGORIES = [
    { slug: 'all', label: 'All' },
    ...categoriesList
      .filter((c) => !c.parent_id && c.is_active)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map((c) => ({ slug: c.slug, label: c.name }))
  ];

  const SUBCATEGORIES = categoriesList.reduce((acc, cat) => {
    if (cat.parent_id) {
      const parent = categoriesList.find((p) => p.id === cat.parent_id);
      if (parent) {
        const parentSlug = parent.slug;
        if (!acc[parentSlug]) acc[parentSlug] = [];
        acc[parentSlug].push({ slug: cat.slug, label: cat.name });
      }
    }
    return acc;
  }, {} as Record<string, Array<{ slug: string; label: string }>>);

  const genders = ['all', 'unisex', 'men', 'women'];
  const sizes = ['all', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // Count active filters (for the mobile badge)
  const activeFilterCount = [
    selectedCategory !== 'all',
    selectedSubcategory !== 'all',
    selectedGender !== 'all',
    selectedSize !== 'all',
    priceRange !== 3000,
    sortBy !== 'featured',
  ].filter(Boolean).length;

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const gridItems = getShopGridItems(visibleProducts);

  return (
    <div className="w-full flex flex-col">
      {/* ── Page Header ── */}
      <div className="border-b border-brand-graphite bg-brand-black">
        <div className="max-w-screen-2xl mx-auto px-8 md:px-12 pt-16 pb-12">
          <span className="eyebrow mb-3 block">The Archive</span>
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-white leading-none font-display uppercase font-black tracking-tighter" style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)' }}>
              Collection
            </h1>
            <p className="text-brand-stone text-[10px] tracking-[0.2em] uppercase font-body font-semibold mb-1 shrink-0">
              {loading ? '—' : `${filteredProducts.length} Items`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Sticky Category Pill Bar ── */}
      <div className={`sticky transition-all duration-500 ease-in-out z-40 bg-brand-black/95 backdrop-blur-md border-b border-brand-graphite ${hideHeader ? 'top-0' : 'top-16'}`}>
        <div className={`max-w-screen-2xl mx-auto px-8 md:px-12 transition-all duration-300 ease-in-out ${isSticky ? 'py-1.5' : 'py-3'}`}>

          {/* Main Controls Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Category horizontal scroll container */}
            <div className="w-full overflow-x-auto scrollbar-none py-1.5 snap-x snap-mandatory scroll-smooth">
              {/* Unified Visual Story-Style Capsule Cards — shrinks smoothly when sticky, renders in color on all viewports */}
              <div className="flex gap-3.5 pb-px px-1 justify-start md:justify-center" role="tablist" aria-label="Filter by category">
                {MAIN_CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.slug;
                  const dbCat = categoriesList.find((c) => c.slug === cat.slug);
                  const visual = dbCat?.image_url
                    ? { label: dbCat.name, image: dbCat.image_url }
                    : CATEGORY_VISUALS[cat.slug] || CATEGORY_VISUALS['all'];
                  return (
                    <div key={cat.slug} className="group flex flex-col items-center shrink-0 snap-start">
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        onClick={() => handleCategoryChange(cat.slug)}
                        role="tab"
                        aria-selected={isActive}
                        className={`relative overflow-hidden aspect-square transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-full ${isSticky
                            ? 'w-12 h-12 md:w-14 md:h-14'
                            : 'w-[72px] h-[72px] md:w-[86px] md:h-[86px]'
                          } ${isActive
                            ? 'shadow-[0_0_0_1px_#F0F0F0] scale-105 opacity-100'
                            : 'bg-brand-charcoal/40 opacity-60 hover:opacity-100 border border-[--drftn-gray-700]/50'
                          }`}
                      >
                        {/* Background Visual Image (Grayscale filter removed, colorized) */}
                        <div className="absolute inset-0 z-[1] transition-transform duration-500 group-hover:scale-110">
                          <Image
                            src={visual.image || 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop&q=80'}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 72px, 86px"
                            className="object-cover filter brightness-[0.55] transition-all duration-300 group-hover:brightness-[0.7]"
                          />
                          <div className="absolute inset-0 bg-brand-black/10" aria-hidden="true" />
                        </div>

                        {/* Active indicator dot */}
                        {isActive && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-amberLight z-10 animate-fade-in" aria-hidden="true" />
                        )}

                        {/* Subcategory alert badge */}
                        {isActive && selectedSubcategory !== 'all' && (
                          <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-brand-amberLight z-10 animate-fade-in" aria-hidden="true" />
                        )}
                      </motion.button>

                      {/* Overlaid Label text — below the circle, hides smoothly when sticky */}
                      {!isSticky && (
                        <span className={`mt-2.5 font-bold tracking-[0.16em] uppercase text-center px-1 font-body leading-none text-[8.5px] md:text-[9.5px] transition-all duration-200 ${isActive ? 'text-brand-offwhite opacity-100' : 'text-brand-stone opacity-60 group-hover:opacity-100'
                          }`}>
                          {visual.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop Only Sort + Reset triggers */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <label htmlFor="sort-select" className="sr-only">Sort products by</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-[10px] uppercase tracking-[0.15em] font-bold bg-brand-graphite text-brand-silver border border-brand-muted py-2 px-3 cursor-pointer focus:border-brand-amber"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-low-high">Price ↑</option>
                <option value="price-high-low">Price ↓</option>
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-brand-amber hover:text-brand-offwhite transition-colors border border-brand-amber/30 px-3 py-2"
                  aria-label="Reset all filters"
                >
                  <X className="w-3 h-3" aria-hidden="true" /> Reset ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Mobile Only: Small Filter & Sort button positioned below the visual bubbles row */}
            <div className={`flex md:hidden items-center justify-between gap-2 border-t border-brand-graphite/35 transition-all duration-300 ease-in-out ${isSticky ? 'pt-1.5 pb-0.5 mt-0.5' : 'pt-3 pb-1 mt-1'
              } w-full`}>
              <span className="text-[9px] uppercase tracking-[0.2em] text-brand-stone font-bold font-body">
                {filteredProducts.length} Pieces Found
              </span>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-brand-stone hover:text-brand-offwhite border border-brand-graphite px-3.5 py-1.5 bg-brand-charcoal/20 relative font-body animate-scale-in"
                aria-label={`Filters and sort${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
                aria-expanded={mobileFiltersOpen}
              >
                <SlidersHorizontal className="w-3 h-3 text-brand-stone" aria-hidden="true" />
                Filter & Sort
                {activeFilterCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 bg-brand-amber text-brand-black text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none"
                    aria-label={`${activeFilterCount} filters active`}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Subcategory pills (shows when a category with subcats is selected) */}
          <AnimatePresence initial={false}>
            {selectedCategory !== 'all' && SUBCATEGORIES[selectedCategory] && (
              <motion.div
                key="subcategory-drawer"
                initial={{ opacity: 0, height: 0, scaleY: 0.9 }}
                animate={{ opacity: 1, height: 'auto', scaleY: 1 }}
                exit={{ opacity: 0, height: 0, scaleY: 0.9 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={{ transformOrigin: 'top' }}
                className="flex gap-2 overflow-x-auto scrollbar-none pt-2 pb-px mt-1 origin-top"
              >
                <button
                  onClick={() => handleSubcategoryChange('all')}
                  className={`filter-pill shrink-0 text-[9px] ${selectedSubcategory === 'all' ? 'active' : ''}`}
                >
                  All {MAIN_CATEGORIES.find(c => c.slug === selectedCategory)?.label}
                </button>
                {SUBCATEGORIES[selectedCategory].map((sub) => (
                  <button
                    key={sub.slug}
                    onClick={() => handleSubcategoryChange(sub.slug)}
                    className={`filter-pill shrink-0 text-[9px] ${selectedSubcategory === sub.slug ? 'active' : ''}`}
                  >
                    {sub.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="max-w-screen-2xl mx-auto px-8 md:px-12 py-16 md:py-24 w-full flex-1">
        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : filteredProducts.length === 0 ? (
          /* Empty state — proper, editorial design */
          <div className="flex flex-col items-center justify-center text-center py-24 space-y-6" role="status" aria-live="polite">
            <div className="w-16 h-16 border border-brand-graphite flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-brand-muted stroke-[1]" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-display uppercase tracking-wider text-brand-offwhite">
                No Pieces Found
              </h2>
              <p className="text-brand-stone text-xs tracking-wider uppercase max-w-xs mx-auto font-body">
                {activeFilterCount > 0
                  ? 'No products match your current filters. Try adjusting or resetting.'
                  : 'New drops are coming. Check back soon.'}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="btn-outline text-[10px] py-3 px-8 tracking-widest"
              >
                Reset All Filters
              </button>
            )}
            <Link href="/" className="text-[10px] tracking-[0.2em] uppercase text-brand-stone hover:text-brand-offwhite transition-colors font-body border-animate pb-0.5">
              Return Home
            </Link>
          </div>
        ) : (
          <>
            {/* Category Hero Story Moment (Part F) */}
            {selectedCategory !== 'all' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full relative h-[320px] md:h-[480px] overflow-hidden mb-8 border border-white/[0.08]"
              >
                <Image
                  src={CATEGORY_VISUALS[selectedCategory]?.image || CATEGORY_VISUALS['all'].image}
                  alt=""
                  fill
                  priority
                  className="object-cover brightness-[0.45]"
                />
                <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 text-left bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-brand-amber mb-2 uppercase">
                    Category Feature
                  </span>
                  <h1 className="text-3xl md:text-6xl font-display font-black uppercase tracking-tighter text-white leading-none">
                    {MAIN_CATEGORIES.find(c => c.slug === selectedCategory)?.label || selectedCategory}
                  </h1>
                </div>
              </motion.div>
            )}

            {/* Product grid: asymmetric grid layout */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-[2px] bg-[--drftn-gray-700]/10"
              role="list"
              aria-label={`${filteredProducts.length} products`}
            >
              {gridItems.map((item, idx) => {
                if (item.type === 'product') {
                  return (
                    <div key={item.product.id} className={item.spanClass} role="listitem">
                      <ShopProductCard
                        prod={item.product}
                        index={idx}
                        onQuickAdd={handleQuickAdd}
                      />
                    </div>
                  );
                } else {
                  return (
                    <Link
                      key={item.id}
                      href={`/shop?category=${item.category}`}
                      data-cursor="banner"
                      className={`${item.spanClass} product-image-hoverable relative overflow-hidden group flex flex-col justify-end p-8 md:p-12 text-left`}
                    >
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.02] brightness-[0.45]"
                      />
                      {/* Typographic contrast title */}
                      <div className="relative z-10 space-y-2">
                        <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-brand-amber uppercase block">
                          {item.subtitle}
                        </span>
                        <h3 className="text-3xl md:text-6xl font-display font-black uppercase tracking-tighter text-white leading-none">
                          {item.title}
                        </h3>
                      </div>
                    </Link>
                  );
                }
              })}
            </div>

            {/* Load More */}
            {visibleCount < filteredProducts.length && (
              <div className="text-center mt-14">
                <p className="text-brand-stone text-[10px] tracking-[0.2em] uppercase font-body mb-4">
                  Showing {visibleCount} of {filteredProducts.length}
                </p>
                <button
                  onClick={() => setVisibleCount(c => c + 12)}
                  className="btn-outline py-3.5 px-12 text-[10px] tracking-[0.2em]"
                  aria-label={`Load more products, currently showing ${visibleCount} of ${filteredProducts.length}`}
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Mobile Filter Bottom-Sheet Drawer ── */}
      <div
        className={`filter-drawer-backdrop ${mobileFiltersOpen ? 'open' : ''}`}
        onClick={() => setMobileFiltersOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`filter-drawer ${mobileFiltersOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filters and sort"
        id="mobile-filter-drawer"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-muted" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-graphite">
          <h2 className="text-sm font-bold uppercase tracking-widest text-brand-offwhite font-display flex items-center gap-2">
            Filter & Sort
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-body bg-brand-amber text-brand-black px-1.5 py-0.5 rounded font-black">
                {activeFilterCount} active
              </span>
            )}
          </h2>
          <button
            onClick={() => setMobileFiltersOpen(false)}
            className="p-1 text-brand-stone hover:text-brand-offwhite transition-colors"
            aria-label="Close filter drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Sections */}
        <div className="px-5 py-5 space-y-7">
          {/* Sort */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-stone">Sort By</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'featured', label: 'Featured' },
                { value: 'newest', label: 'Newest' },
                { value: 'price-low-high', label: 'Price ↑' },
                { value: 'price-high-low', label: 'Price ↓' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`filter-pill justify-center py-2.5 ${sortBy === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-stone">Category</h3>
            <div className="flex flex-wrap gap-2">
              {MAIN_CATEGORIES.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={`filter-pill ${selectedCategory === cat.slug ? 'active' : ''}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {selectedCategory !== 'all' && SUBCATEGORIES[selectedCategory] && (
              <div className="flex flex-wrap gap-2 pl-2 pt-1 border-l border-brand-amber/20">
                <button
                  onClick={() => handleSubcategoryChange('all')}
                  className={`filter-pill text-[9px] ${selectedSubcategory === 'all' ? 'active' : ''}`}
                >
                  All
                </button>
                {SUBCATEGORIES[selectedCategory].map((sub) => (
                  <button
                    key={sub.slug}
                    onClick={() => handleSubcategoryChange(sub.slug)}
                    className={`filter-pill text-[9px] ${selectedSubcategory === sub.slug ? 'active' : ''}`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gender */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-stone">Gender</h3>
            <div className="flex flex-wrap gap-2">
              {genders.map((gen) => (
                <button
                  key={gen}
                  onClick={() => setSelectedGender(gen)}
                  className={`filter-pill ${selectedGender === gen ? 'active' : ''}`}
                >
                  {gen}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-stone">Size</h3>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`w-10 h-10 text-[10px] border uppercase font-bold flex items-center justify-center transition-all ${selectedSize === size
                      ? 'border-brand-amber bg-brand-amber/10 text-brand-offwhite'
                      : 'border-brand-muted text-brand-stone hover:border-brand-stone'
                    }`}
                  aria-pressed={selectedSize === size}
                >
                  {size === 'all' ? 'All' : size}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-stone">Max Price</h3>
              <span className="text-xs font-bold text-brand-offwhite">₹{priceRange}</span>
            </div>
            <label htmlFor="mobile-price-range" className="sr-only">Maximum price: ₹{priceRange}</label>
            <input
              id="mobile-price-range"
              type="range"
              min="500"
              max="3000"
              step="100"
              value={priceRange}
              onChange={(e) => setPriceRange(Number(e.target.value))}
              className="w-full accent-brand-amber bg-brand-graphite border-0 h-1 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-brand-stone font-bold uppercase tracking-widest">
              <span>₹500</span><span>₹3000</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-brand-graphite grid grid-cols-2 gap-3">
          <button
            onClick={handleResetFilters}
            className="btn-outline py-3 text-[10px] tracking-widest"
          >
            Reset All
          </button>
          <button
            onClick={() => setMobileFiltersOpen(false)}
            className="btn-primary py-3 text-[10px] tracking-widest"
          >
            <span>View {filteredProducts.length} Items</span>
          </button>
        </div>
      </div>

      {/* ── Size Selection Modal ── */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedProductForSize && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
              onClick={() => setSelectedProductForSize(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[360px] bg-black border border-white p-6 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(255,255,255,0.06)] rounded-none"
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedProductForSize(null)}
                  className="absolute top-2 right-2 text-zinc-500 hover:text-white transition-colors w-10 h-10 flex items-center justify-center cursor-pointer"
                  aria-label="Close size selector"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Product Info */}
                <div className="text-center space-y-2 mt-2">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-brand-stone font-mono block">
                    Select Size
                  </span>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    {selectedProductForSize.name}
                  </h3>
                  <p className="text-xs text-brand-stone font-mono">
                    ₹{(selectedProductForSize.price / 100).toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Sizes Buttons Grid */}
                <div className="grid grid-cols-3 gap-2.5 w-full pt-2">
                  {selectedProductForSize.sizes.map((size) => {
                    const isAvailable = (selectedProductForSize.stock_quantity[size] || 0) > 0;
                    return (
                      <button
                        key={size}
                        disabled={!isAvailable}
                        onClick={() => handleSizeSelect(size)}
                        className={`py-3.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${isAvailable
                            ? 'border-white/20 bg-transparent text-white hover:bg-white hover:text-black hover:border-white'
                            : 'border-white/5 bg-white/[0.02] text-zinc-600 line-through cursor-not-allowed'
                          }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>

                {/* Cancel link */}
                <button
                  onClick={() => setSelectedProductForSize(null)}
                  className="text-[9px] text-zinc-500 uppercase tracking-widest hover:text-white transition-colors font-mono underline mt-1"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
