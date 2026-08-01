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
  { title: string; description: string; ctaText: string; slug: string; aliases: string[] }
> = {
  hoodies: {
    title: 'HOODIES',
    description: 'Heavyweight comfort.\nBuilt for the restless.',
    ctaText: 'Explore Hoodies',
    slug: 'hoodies',
    aliases: ['hoodies', 'hoodie', 'sweatshirt', 'sweatshirts', 'pullover'],
  },
  jackets: {
    title: 'JACKETS',
    description: 'Layer up.\nOwn the room.',
    ctaText: 'Discover Jackets',
    slug: 'jackets',
    aliases: ['jackets', 'jacket', 'outerwear', 'bomber', 'coat', 'puffer', 'fleece'],
  },
  't-shirts': {
    title: 'OVERSIZED TEES',
    description: 'Relaxed cuts.\nBold silhouettes.',
    ctaText: 'View Tees',
    slug: 't-shirts',
    aliases: ['t-shirts', 't-shirt', 'tshirt', 'tshirts', 'tee', 'tees', 'top'],
  },
  denims: {
    title: 'DENIM & JEANS',
    description: 'Made to wear.\nBuilt to last.',
    ctaText: 'Browse Denim',
    slug: 'denims',
    aliases: ['denims', 'denim', 'jeans', 'pants', 'bottoms', 'cargos', 'cargo'],
  },
};

const CATEGORY_ORDER = ['hoodies', 'jackets', 't-shirts', 'denims'];

/**
 * Builds exactly 4 editorial slides — one per allowed category.
 * Each slide shows EXACTLY 4 products (2×2 grid).
 * Matches by category + aliases, and backfills if fewer than 4 items exist for a category.
 */
export function buildCategoryEditorialSlides(products: Product[]): CategoryEditorialSlide[] {
  if (!products || products.length === 0) return [];

  const used = new Set<string>();
  const slides: CategoryEditorialSlide[] = [];

  for (const catKey of CATEGORY_ORDER) {
    const meta = ALLOWED_CATEGORIES[catKey];
    const catProducts: Product[] = [];

    // 1. Direct & Alias matching
    for (const p of products) {
      if (used.has(p.id)) continue;
      const cat = (p.category || '').toLowerCase().trim();
      const sub = (p.subcategory || '').toLowerCase().trim();
      const name = (p.name || '').toLowerCase().trim();

      const isMatch =
        meta.aliases.includes(cat) ||
        meta.aliases.includes(sub) ||
        meta.aliases.some((alias) => name.includes(alias));

      if (isMatch) {
        catProducts.push(p);
        used.add(p.id);
        if (catProducts.length === 4) break;
      }
    }

    // 2. Backfill if fewer than 4 matching products found
    if (catProducts.length < 4) {
      for (const p of products) {
        if (used.has(p.id)) continue;
        catProducts.push(p);
        used.add(p.id);
        if (catProducts.length === 4) break;
      }
    }

    if (catProducts.length > 0) {
      slides.push({
        id: `edit-${catKey}`,
        title: meta.title,
        description: meta.description,
        categorySlug: meta.slug,
        ctaText: meta.ctaText,
        cards: catProducts.slice(0, 4),
      });
    }
  }

  return slides;
}
