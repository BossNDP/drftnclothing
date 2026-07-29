/**
 * Shared category visual constants — used by both:
 *   - /shop page (CategoryRail, category hero banners)
 *   - /app/_HomePageClient.tsx HomeCategorySection
 *
 * Add or edit entries to pin images to specific category circles.
 * CATEGORY_IMAGE_OVERRIDES take priority over DB image_url and auto-selected thumbnails.
 */
export const CATEGORY_VISUALS: Record<string, { label: string; image: string }> = {
  all: {
    label: 'All Drops',
    image:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop&q=80',
  },
  't-shirts': {
    label: 'Tees',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785153652/drftn-products/jphnwicpbhl6wvrnxkfw.jpg',
  },
  shirts: {
    label: 'Shirts',
    image:
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop&q=80',
  },
  denims: {
    label: 'Denims',
    image:
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop&q=80',
  },
  'formal-pants': {
    label: 'Trousers',
    image:
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=400&fit=crop&q=80',
  },
  sweatshirts: {
    label: 'Sweats',
    image:
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=400&fit=crop&q=80',
  },
  hoodies: {
    label: 'Hoodies',
    image:
      'https://images.unsplash.com/photo-1556821840-47b2c0d5c829?w=400&h=400&fit=crop&q=80',
  },
  jackets: {
    label: 'Jackets',
    image:
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop&q=80',
  },
};

/** Override DB image or auto-thumbnail for any category slug */
export const CATEGORY_IMAGE_OVERRIDES: Record<string, string> = {
  't-shirts':
    'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785153652/drftn-products/jphnwicpbhl6wvrnxkfw.jpg',
  // Example: 'hoodies': 'https://res.cloudinary.com/...',
};

/** Ordered category list for the CategoryRail — matches user spec */
export const HOME_CATEGORIES = [
  { slug: 'all', label: 'All' },
  { slug: 't-shirts', label: 'T-Shirts' },
  { slug: 'shirts', label: 'Shirts' },
  { slug: 'denims', label: 'Denims' },
  { slug: 'formal-pants', label: 'Formal Pants' },
  { slug: 'sweatshirts', label: 'Sweatshirt' },
  { slug: 'hoodies', label: 'Hoodies' },
  { slug: 'jackets', label: 'Jackets' },
] as const;

export type HomeCategorySlug = (typeof HOME_CATEGORIES)[number]['slug'];
