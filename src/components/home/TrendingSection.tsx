import { Product } from '@/types';
import EditProductCard from './EditProductCard';
import DRFTNButton from '@/components/DRFTNButton';
import ScrollReveal from '@/components/ui/ScrollReveal';

interface TrendingSectionProps {
  products: Product[];
}

/**
 * TrendingSection — pure Server Component.
 * Renders a 4-product trending grid from server-passed props.
 * No client hydration needed — all product cards are also Server Components.
 */
export default function TrendingSection({ products }: TrendingSectionProps) {
  if (products.length === 0) return null;

  return (
    <section
      className="w-full bg-[#0a0a0a] py-14 md:py-24 border-t border-white/[0.06] text-brand-offwhite relative z-10"
      aria-labelledby="trending-heading"
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-12 w-full">
        {/* Section Header */}
        <ScrollReveal className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 md:mb-12 w-full">
          <div className="flex flex-col text-left space-y-1">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-zinc-400 uppercase">
              DRFTN ARCHIVE // TOP SELLERS
            </span>
            <h2
              id="trending-heading"
              className="text-white leading-none font-display font-black uppercase text-3xl sm:text-5xl md:text-7xl tracking-tighter drop-shadow-md"
            >
              TRENDING THIS WEEK
            </h2>
          </div>

          <DRFTNButton href="/shop" variant="outline" className="self-start md:self-end">
            VIEW SHOP
          </DRFTNButton>
        </ScrollReveal>

        {/* Trending Grid: 2-column mobile / 4-column desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 w-full">
          {products.map((prod, idx) => (
            <EditProductCard
              key={prod.id}
              product={prod}
              isHeroMobile={idx === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
