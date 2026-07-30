import { ArrowUpRight } from 'lucide-react';
import ScrollReveal from '@/components/ui/ScrollReveal';

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const TICKER_WORDS = [
  'JOIN THE MOVEMENT',
  'LIMITED DROPS',
  'RAW MINIMALISM',
  'UNISEX SILHOUETTES',
  'HEAVYWEIGHT COTTON',
  '@DRFTNCLOTHING',
];

export default function Lookbook() {
  return (
    <section
      className="py-20 md:py-28 px-6 md:px-12 w-full relative z-10 border-t border-brand-graphite/40 bg-brand-black overflow-hidden"
      aria-labelledby="instagram-cta-heading"
    >
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-offwhite/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-screen-xl mx-auto text-center relative z-10 space-y-8">
        {/* Ticker Marquee Line */}
        <div className="w-full overflow-hidden py-3 border-y border-white/5 bg-white/[0.01]">
          <div className="flex gap-8 whitespace-nowrap animate-marquee text-[10px] sm:text-xs font-mono tracking-[0.3em] uppercase text-zinc-500 font-bold select-none">
            {[...TICKER_WORDS, ...TICKER_WORDS, ...TICKER_WORDS, ...TICKER_WORDS].map((word, i) => (
              <span key={i} className="flex items-center gap-8">
                <span>{word}</span>
                <span className="text-zinc-700">&bull;</span>
              </span>
            ))}
          </div>
        </div>

        {/* Main CTA Card */}
        <ScrollReveal className="space-y-6 pt-4">
          <span className="block w-6 h-[2px] bg-white mx-auto" aria-hidden="true" />

          <h2
            id="instagram-cta-heading"
            className="text-white font-display uppercase font-extrabold text-3xl md:text-5xl tracking-tight"
          >
            Drift With Us
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm font-mono max-w-md mx-auto leading-relaxed">
            Follow our Instagram for unreleased prototypes, behind-the-scenes drops, and community features.
          </p>

          <div className="pt-2">
            <a
              href="https://instagram.com/drftnclothing"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-3 bg-zinc-900 hover:bg-white text-white hover:text-black border border-white/10 hover:border-white px-8 py-4 rounded-xl text-xs font-mono font-bold uppercase tracking-[0.25em] transition-all duration-300 shadow-2xl hover:scale-105"
            >
              <InstagramIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span>@drftnclothing</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
