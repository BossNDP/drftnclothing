import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';

const lookbookImages = [
  { url: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=500', alt: 'DRFTN streetwear hoodie details' },
  { url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500', alt: 'DRFTN graphic tee look' },
  { url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=500', alt: 'DRFTN streetwear silhouette' },
  { url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500', alt: 'DRFTN heavy custom hoodie' },
  { url: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=500', alt: 'DRFTN techwear jacket display' },
  { url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500', alt: 'DRFTN minimal industrial aesthetic fit' },
];

/**
 * Lookbook — pure Server Component.
 * Static asymmetric photo grid. All images lazy-loaded.
 */
export default function Lookbook() {
  return (
    <section
      className="py-16 md:py-24 px-6 md:px-12 w-full relative z-10 border-t border-brand-graphite/40"
      aria-labelledby="lookbook-heading"
    >
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <ScrollReveal className="text-center mb-14 space-y-3">
          <span className="block w-6 h-[2px] bg-white mx-auto mb-3" aria-hidden="true" />
          <h2
            id="lookbook-heading"
            className="text-white font-display uppercase text-3xl md:text-5xl tracking-tight"
          >
            Drift With Us
          </h2>
          <a
            href="https://instagram.com/drftnclothing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] text-brand-stone hover:text-white tracking-[0.25em] uppercase transition-colors font-body font-bold"
            aria-label="Follow DRFTN on Instagram @drftnclothing"
          >
            @drftnclothing
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </ScrollReveal>

        {/* Asymmetric Photo Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {lookbookImages.map((img, i) => (
            <div
              key={i}
              className="relative overflow-hidden aspect-[4/5] rounded-[var(--radius-md)] bg-brand-charcoal border border-white/5 group"
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="(max-width: 768px) 50vw, 16vw"
                loading="lazy"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
