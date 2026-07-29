import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';

/**
 * BrandStory — pure Server Component.
 * All static text and layout. No client JS required.
 */
export default function BrandStory() {
  return (
    <section
      className="py-16 md:py-24 px-6 md:px-12 max-w-screen-2xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center relative z-10"
      aria-labelledby="story-heading"
    >
      {/* Text */}
      <ScrollReveal className="space-y-8 border-l-2 border-white/10 pl-6 lg:pl-10">
        <div className="relative pl-6 py-2 text-left">
          {/* Corner Brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-white/20" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-white/20" />
          <h2
            id="story-heading"
            className="text-white leading-none font-display uppercase text-3xl md:text-5xl tracking-tight"
          >
            Born in Yelahanka.
            <br />
            <span className="text-brand-stone/60 font-light">Built for the World.</span>
          </h2>
        </div>

        <div className="space-y-4 text-left">
          <p className="text-brand-stone text-sm md:text-base leading-relaxed font-body font-normal">
            DRFTN CLOTHING is a premium D2C brand that represents the spirit of youth culture
            in Yelahanka, Bengaluru. Inspired by industrial minimalism and global streetwear,
            we build apparel that balances durability with a relaxed unisex fit.
          </p>
          <p className="text-brand-silver text-xs leading-relaxed font-body font-normal">
            Every garment we produce is created using curated heavyweight fabrics,
            drop shoulder tailoring, and bold graphic expressions. We don&apos;t follow
            trends — we set the drift.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Link href="/about" className="btn-secondary-dark text-xs font-bold uppercase tracking-widest px-8 py-4 inline-flex items-center gap-1">
            <span>Read Our Philosophy</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Brand Values */}
        <div className="grid grid-cols-3 gap-6 pt-6 border-t border-brand-graphite/40">
          {[
            { label: 'Heavyweight', note: 'Fabrics' },
            { label: 'Unisex', note: 'Silhouettes' },
            { label: 'D2C', note: 'Direct' },
          ].map((val) => (
            <div key={val.label} className="space-y-1 text-left">
              <span className="block w-4 h-[2px] bg-white/60 mb-2" aria-hidden="true" />
              <p className="text-[10px] tracking-[0.15em] text-white uppercase font-body font-bold">{val.label}</p>
              <p className="text-[9px] tracking-wider text-brand-stone uppercase font-body">{val.note}</p>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Images Collage */}
      <ScrollReveal className="grid grid-cols-2 gap-3.5 h-[420px] md:h-[520px]" delay={0.1} y={24}>
        <div className="overflow-hidden relative h-full rounded-[var(--radius-lg)] bg-brand-charcoal border border-white/5">
          <Image
            src="https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&auto=format&fit=crop&q=85"
            alt="DRFTN model wearing streetwear"
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            loading="lazy"
            className="object-cover hover:scale-103 transition-transform duration-700 grayscale hover:grayscale-0"
          />
        </div>
        <div className="overflow-hidden relative h-full mt-10 rounded-[var(--radius-lg)] bg-brand-charcoal border border-white/5">
          <Image
            src="https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&auto=format&fit=crop&q=85"
            alt="DRFTN fabric and garment detail"
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            loading="lazy"
            className="object-cover hover:scale-103 transition-transform duration-700 grayscale hover:grayscale-0"
          />
        </div>
      </ScrollReveal>
    </section>
  );
}
