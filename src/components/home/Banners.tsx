import Link from 'next/link';
import Image from 'next/image';

/**
 * PromoBanner — pure Server Component.
 * Static promotional strip.
 */
export function PromoBanner() {
  return (
    <section className="w-full bg-white py-5 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10 border-y border-white/5">
      <p className="text-black font-display font-black text-sm md:text-base tracking-[0.08em] uppercase text-center md:text-left">
        LIMITED RUN: HEAVYWEIGHT ACID-WASH OVERSIZED SILHOUETTES OUT NOW
      </p>
      <Link
        href="/shop"
        className="text-black font-body font-bold text-xs uppercase tracking-widest underline decoration-2 hover:opacity-85 transition-opacity"
      >
        EXPLORE MORE
      </Link>
    </section>
  );
}

/**
 * EditorialBanner — pure Server Component.
 * Static editorial quote banner with background image.
 */
export function EditorialBanner() {
  return (
    <section
      className="relative overflow-hidden border-t border-brand-graphite/40 w-full z-10"
      aria-label="Brand philosophy"
    >
      <div className="relative h-72 md:h-96">
        <Image
          src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1600&auto=format&fit=crop&q=80"
          alt="DRFTN premium fabric detail"
          fill
          sizes="100vw"
          loading="lazy"
          className="object-cover grayscale opacity-20"
        />
        <div className="absolute inset-0 bg-brand-black/80" aria-hidden="true" />
        <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
          <div className="space-y-4 max-w-3xl">
            <p className="text-white/60 text-[10px] tracking-[0.45em] uppercase font-body font-bold">
              Our Material Promise
            </p>
            <blockquote
              className="text-white font-display uppercase tracking-wider leading-tight"
              style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.6rem)' }}
            >
              &ldquo;Every thread is chosen with intention. Every cut is deliberate. Every garment is a statement.&rdquo;
            </blockquote>
            <p className="text-brand-stone text-[10px] tracking-[0.3em] uppercase font-body">
              — DRFTN CLOTHING
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
