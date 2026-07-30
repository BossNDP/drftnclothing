import ScrollReveal from '@/components/ui/ScrollReveal';

/**
 * BrandStory — typographic brand statement section.
 * Custom-built from scratch messaging replacing generic D2C about text.
 */
export default function BrandStory() {
  return (
    <section
      className="py-16 md:py-24 px-6 md:px-12 max-w-screen-2xl mx-auto w-full relative z-10"
      aria-labelledby="brand-statement-heading"
    >
      <ScrollReveal className="border-l-2 border-white/20 pl-6 md:pl-10 space-y-4 text-left">
        <div className="relative pl-6 py-1">
          {/* Corner Brackets */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-white/30" />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-white/30" />
          <h2
            id="brand-statement-heading"
            className="text-white leading-none font-display uppercase font-extrabold text-3xl md:text-5xl md:leading-tight tracking-tight"
          >
            NOT A TEMPLATE.&nbsp;
            <br className="hidden sm:inline" />
            <span className="text-brand-stone/60 font-light">NOT A TREND.</span>
          </h2>
        </div>

        <p className="text-brand-stone text-sm md:text-base leading-relaxed font-body font-normal max-w-2xl pt-2">
          Every pixel, every seam — built from scratch for people who don&apos;t do ordinary.
        </p>
      </ScrollReveal>
    </section>
  );
}
