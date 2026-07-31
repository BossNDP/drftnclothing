/**
 * Shared category visual constants — used by both:
 *   - /shop page (CategoryRail, category hero banners)
 *   - /app/_HomePageClient.tsx HomeCategorySection
 *
 * Uses authentic DRFTN Cloudinary product images exclusively.
 */
export const CATEGORY_VISUALS: Record<string, { label: string; image: string }> = {
  all: {
    label: 'All Drops',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232712/drftn-products/dgv06ev4uv746sjfdwaq.jpg',
  },
  't-shirts': {
    label: 'Tees',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785153652/drftn-products/jphnwicpbhl6wvrnxkfw.jpg',
  },
  shirts: {
    label: 'Shirts',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1784830975/drftn-products/f42vst7ccgg3deqwsjcv.jpg',
  },
  denims: {
    label: 'Denims',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785252749/drftn-products/e4flew2q0o5cdkc7qmeb.jpg',
  },
  'formal-pants': {
    label: 'Trousers',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785256428/drftn-products/xjmjjgzzvl0vf6e0difo.jpg',
  },
  sweatshirts: {
    label: 'Sweats',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232919/drftn-products/tuquugai46apllc42seg.jpg',
  },
  sweatshirt: {
    label: 'Sweatshirt',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232919/drftn-products/tuquugai46apllc42seg.jpg',
  },
  hoodies: {
    label: 'Hoodies',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232712/drftn-products/dgv06ev4uv746sjfdwaq.jpg',
  },
  jackets: {
    label: 'Jackets',
    image:
      'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785157166/drftn-products/nqukkelm6kwifrrt0umw.jpg',
  },
};

/** Explicit DRFTN Cloudinary image overrides for category circles */
export const CATEGORY_IMAGE_OVERRIDES: Record<string, string> = {
  all: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232712/drftn-products/dgv06ev4uv746sjfdwaq.jpg',
  't-shirts': 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785153652/drftn-products/jphnwicpbhl6wvrnxkfw.jpg',
  shirts: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1784830975/drftn-products/f42vst7ccgg3deqwsjcv.jpg',
  denims: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785252749/drftn-products/e4flew2q0o5cdkc7qmeb.jpg',
  'formal-pants': 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785256428/drftn-products/xjmjjgzzvl0vf6e0difo.jpg',
  sweatshirts: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232919/drftn-products/tuquugai46apllc42seg.jpg',
  sweatshirt: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232919/drftn-products/tuquugai46apllc42seg.jpg',
  hoodies: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232712/drftn-products/dgv06ev4uv746sjfdwaq.jpg',
  jackets: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785157166/drftn-products/nqukkelm6kwifrrt0umw.jpg',
};

/** Ordered category list for the CategoryRail */
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
