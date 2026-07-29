import type { Product } from '@/types';

export interface CategoryEditorialSlide {
  id: string;
  title: string;
  description: string;
  categorySlug: string;
  ctaText: string;
  cards: Product[];
}

/** The ONLY 4 categories allowed in The Edit — in this exact order */
const ALLOWED_CATEGORIES: Record<
  string,
  { title: string; description: string; ctaText: string; slug: string }
> = {
  hoodies: {
    title: 'HOODIES',
    description: 'Heavyweight comfort.\nBuilt for the restless.',
    ctaText: 'Explore Hoodies',
    slug: 'hoodies',
  },
  jackets: {
    title: 'JACKETS',
    description: 'Layer up.\nOwn the room.',
    ctaText: 'Discover Jackets',
    slug: 'jackets',
  },
  't-shirts': {
    title: 'OVERSIZED TEES',
    description: 'Relaxed cuts.\nBold silhouettes.',
    ctaText: 'View Tees',
    slug: 't-shirts',
  },
  denims: {
    title: 'DENIM & JEANS',
    description: 'Made to wear.\nBuilt to last.',
    ctaText: 'Browse Denim',
    slug: 'denims',
  },
};

const CATEGORY_ORDER = ['hoodies', 'jackets', 't-shirts', 'denims'];

/**
 * Builds exactly 4 editorial slides — one per allowed category.
 * Each product appears EXACTLY ONCE. No duplicates.
 * Only products from the 4 whitelisted categories are shown.
 * Each slide shows up to 4 products (2×2 grid).
 */
export function buildCategoryEditorialSlides(products: Product[]): CategoryEditorialSlide[] {
  if (!products || products.length === 0) return [];

  const buckets = new Map<string, Product[]>();
  for (const cat of CATEGORY_ORDER) {
    buckets.set(cat, []);
  }

  const used = new Set<string>();

  for (const p of products) {
    if (used.has(p.id)) continue;
    const cat = (p.category || '').toLowerCase().trim();
    if (buckets.has(cat)) {
      buckets.get(cat)!.push(p);
      used.add(p.id);
    }
  }

  const slides: CategoryEditorialSlide[] = [];

  for (const cat of CATEGORY_ORDER) {
    const catProducts = buckets.get(cat) || [];
    if (catProducts.length === 0) continue;

    const meta = ALLOWED_CATEGORIES[cat];

    slides.push({
      id: `edit-${cat}`,
      title: meta.title,
      description: meta.description,
      categorySlug: meta.slug,
      ctaText: meta.ctaText,
      cards: catProducts.slice(0, 4),
    });
  }

  return slides;
}

