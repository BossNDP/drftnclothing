/**
 * Static category tiles definition for homepage "Shop by Category" section.
 * Uses authentic DRFTN Cloudinary product images directly from the DB.
 * 0 DB queries, 0 cache lookups, 0 runtime latency.
 */

export interface CategoryTile {
  slug: string;
  name: string;
  image: string;
  span: 'large' | 'medium' | 'small';
  description?: string;
}

export const categoryTiles: CategoryTile[] = [
  {
    slug: 'hoodies',
    name: 'Hoodies',
    image: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232712/drftn-products/dgv06ev4uv746sjfdwaq.jpg',
    span: 'large',
    description: 'Heavyweight oversized drop-shoulder fits',
  },
  {
    slug: 'denims',
    name: 'Denims',
    image: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785252749/drftn-products/e4flew2q0o5cdkc7qmeb.jpg',
    span: 'medium',
    description: 'Relaxed fit industrial denim',
  },
  {
    slug: 't-shirts',
    name: 'T-Shirts',
    image: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785153652/drftn-products/jphnwicpbhl6wvrnxkfw.jpg',
    span: 'medium',
    description: '240 GSM heavy combed cotton tees',
  },
  {
    slug: 'jackets',
    name: 'Jackets',
    image: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785157166/drftn-products/nqukkelm6kwifrrt0umw.jpg',
    span: 'large',
    description: 'Minimalist techwear & outerwear',
  },
  {
    slug: 'shirts',
    name: 'Shirts',
    image: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1784830975/drftn-products/f42vst7ccgg3deqwsjcv.jpg',
    span: 'small',
    description: 'Boxy streetwear button-downs',
  },
  {
    slug: 'formal-pants',
    name: 'Formal Pants',
    image: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785256428/drftn-products/xjmjjgzzvl0vf6e0difo.jpg',
    span: 'small',
    description: 'Tailored pleated trousers',
  },
  {
    slug: 'sweatshirt',
    name: 'Sweatshirt',
    image: 'https://res.cloudinary.com/dtj01pdog/image/upload/f_auto,q_auto,e_improve,e_sharpen:60/v1785232919/drftn-products/tuquugai46apllc42seg.jpg',
    span: 'medium',
    description: 'Fleece-lined heavyweight crewnecks',
  },
];
