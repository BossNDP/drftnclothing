// Server Component — orchestrates the entire homepage with Server + Client islands.
// Heavy sections (GSAP hero, editorial story, marquee) are dynamic Client Components.
// Static sections (category grid, brand story, trending, lookbook) are pure Server Components.
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { getCachedFeaturedProducts, getCachedTrendingProducts } from '@/lib/product-cache';

// ─── Static Server Components (zero client JS) ───────────────────────────────
import ShopByCategory from '@/components/home/ShopByCategory';
import BrandStory from '@/components/home/BrandStory';
import { PromoBanner, EditorialBanner } from '@/components/home/Banners';
import TrendingSection from '@/components/home/TrendingSection';
import Lookbook from '@/components/home/Lookbook';

import HeroHoodieScene from '@/components/HeroHoodieScene';

// ─── Client Islands (dynamically imported below-the-fold components) ─────────
const IntroLoader = dynamic(() => import('@/components/home/IntroLoader'), { ssr: false });
const BrandMarqueeTicker = dynamic(() => import('@/components/BrandMarqueeTicker'));
const FeaturedStorySection = dynamic(() => import('@/components/home/FeaturedStorySection'));

// Honour Next.js Data Cache revalidation (1 hour);
// individual tags (featured-products, trending-products, etc.) provide tag-based invalidation.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'DRFTN CLOTHING — Built Different | Premium Streetwear Bengaluru',
  description:
    'Born in Yelahanka, Bengaluru. Premium heavyweight streetwear — oversized tees, hoodies, joggers. Limited drops. Built different.',
  openGraph: {
    title: 'DRFTN CLOTHING — Built Different',
    description:
      'Born in Yelahanka, Bengaluru. Premium heavyweight streetwear — oversized tees, hoodies, joggers. Limited drops. Built different.',
    url: 'https://www.drftnclothing.in',
    type: 'website',
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'DRFTN CLOTHING — Built Different',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DRFTN CLOTHING — Built Different',
    description:
      'Born in Yelahanka, Bengaluru. Premium heavyweight streetwear — oversized tees, hoodies, joggers. Limited drops. Built different.',
    images: ['/og-default.jpg'],
  },
};

export default async function HomePage() {
  // Fetch data on the server — zero client-side fetch, zero DB exposure to client.
  const [featuredProducts, trendingProducts] = await Promise.all([
    getCachedFeaturedProducts(48),
    getCachedTrendingProducts(4),
  ]);

  return (
    <div id="page-wrapper" className="w-full bg-brand-black relative">
      {/* ─── Client Island: Session-based intro splash (ssr:false, zero SSR cost) ─── */}
      <IntroLoader />

      {/* ─── Client Island: GSAP Scroll-jacking Hero Scene ─── */}
      <HeroHoodieScene products={featuredProducts} />

      {/* ─── Client Island: Marquee Ticker ─── */}
      <BrandMarqueeTicker />

      {/* ─── Client Island: Editorial Paired Story Section ─── */}
      <FeaturedStorySection products={featuredProducts} />

      {/* ─── Server Components below — zero client hydration cost ─── */}
      <ShopByCategory />
      <BrandStory />
      <PromoBanner />
      <EditorialBanner />
      <TrendingSection products={trendingProducts} />
      <Lookbook />
    </div>
  );
}



