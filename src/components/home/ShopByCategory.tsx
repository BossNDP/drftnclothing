import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { categoryTiles } from '@/lib/category-tiles';
import ScrollReveal from '@/components/ui/ScrollReveal';

/**
 * ShopByCategory — pure Server Component.
 * Renders static bento tiles from categoryTiles constant. Zero DB queries, zero runtime cost.
 */
export default function ShopByCategory() {
  return (
    <section
      className="w-full bg-black py-14 md:py-24 border-b border-white/[0.06] relative z-10 overflow-hidden"
      aria-labelledby="shop-by-category-heading"
    >
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.05),rgba(255,255,255,0))] pointer-events-none" />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-12 w-full relative z-10">
        {/* Header */}
        <ScrollReveal className="flex flex-col text-left space-y-1 mb-8 md:mb-12">
          <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-zinc-400 uppercase">
            DRFTN ARCHIVE // BROWSE
          </span>
          <h2
            id="shop-by-category-heading"
            className="text-white leading-none font-display font-black uppercase text-3xl sm:text-5xl md:text-7xl tracking-tighter"
          >
            SHOP BY CATEGORY
          </h2>
        </ScrollReveal>

        {/* Static Bento Tile Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
          {categoryTiles.map((tile) => {
            const isLarge = tile.span === 'large';
            return (
              <Link
                key={tile.slug}
                href={`/shop?category=${tile.slug}`}
                className={[
                  'group relative overflow-hidden rounded-sm bg-zinc-950 border border-white/10 hover:border-white/30 transition-all duration-500 flex flex-col justify-end p-5 md:p-6 cursor-pointer',
                  isLarge ? 'col-span-2 h-[260px] md:h-[320px]' : 'col-span-1 h-[220px] md:h-[320px]',
                ].join(' ')}
              >
                {/* Background Image */}
                <Image
                  src={tile.image}
                  alt={tile.name}
                  fill
                  sizes={isLarge ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                />

                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 group-hover:opacity-90" />

                {/* Tile content */}
                <div className="relative z-10 flex flex-col space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-display font-black text-white uppercase tracking-tight group-hover:translate-x-1 transition-transform duration-300">
                      {tile.name}
                    </h3>
                    <ArrowUpRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" aria-hidden="true" />
                  </div>
                  {tile.description && (
                    <p className="text-[10px] sm:text-xs text-zinc-400 font-mono tracking-wide line-clamp-1">
                      {tile.description}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
