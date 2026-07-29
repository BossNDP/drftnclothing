/**
 * product-cache.ts
 *
 * Ultra-performant Next.js Data Cache layer for homepage product listings.
 *
 * Cache policies:
 *   1. Featured Products ("The Edit"):
 *      - Tag: 'featured-products'
 *      - revalidate: false (NO time-based expiry — ONLY invalidated when admin saves/toggles is_featured)
 *
 *   2. Trending Products ("Trending This Week"):
 *      - Tag: 'trending-products'
 *      - revalidate: 3600 (1 hour natural drift based on units_sold DESC)
 *      - Deduplicated: Excludes any product IDs currently in the Featured set
 *
 *   3. Category Products:
 *      - Tag: 'products-{slug}'
 *      - revalidate: 3600 (1 hour)
 */

import { unstable_cache } from 'next/cache';
import type { Product } from '@/types';

// Helper to format database product rows & relations into standard Product object
function formatProductRows(rawList: any[], allImages: any[], allVariants: any[]): Product[] {
  const imagesByProductId = allImages.reduce((acc: Record<string, string[]>, img: any) => {
    if (img.sort_order !== 99) {
      if (!acc[img.product_id]) acc[img.product_id] = [];
      acc[img.product_id].push(img.image_url);
    }
    return acc;
  }, {} as Record<string, string[]>);

  const variantsByProductId = allVariants.reduce((acc: Record<string, any[]>, v: any) => {
    if (!acc[v.product_id]) acc[v.product_id] = [];
    acc[v.product_id].push(v);
    return acc;
  }, {} as Record<string, any[]>);

  return rawList.map((prod: any) => {
    const prodVariants = variantsByProductId[prod.id] || [];
    const fallbackImgs =
      imagesByProductId[prod.id]?.length > 0
        ? imagesByProductId[prod.id]
        : prodVariants[0]?.images?.length > 0
        ? prodVariants[0].images
        : prod.images || [];

    return {
      id: prod.id,
      name: prod.name,
      slug: prod.slug,
      description: prod.description || '',
      price: prod.price,
      base_price: prod.price,
      compare_price: prod.compare_price || undefined,
      category: prod.category,
      subcategory: prod.subcategory || undefined,
      gender: prod.gender,
      images: fallbackImgs,
      sizes: prod.sizes,
      stock_quantity: prod.stock_quantity,
      is_featured: prod.is_featured,
      paired_with: prod.paired_with ?? null,
      is_active: prod.is_active,
      weight_grams: prod.weight_grams,
      length_cm: prod.length_cm,
      breadth_cm: prod.breadth_cm,
      height_cm: prod.height_cm,
      units_sold: prod.units_sold ?? 0,
      created_at: prod.created_at ? new Date(prod.created_at).toISOString() : new Date().toISOString(),
      variants: prodVariants.map((v: any) => ({
        id: v.id,
        product_id: v.product_id,
        colour_name: v.colour_name,
        colour_hex: v.colour_hex,
        images: v.images || [],
        sizes: v.sizes || [],
        stock_quantity: v.stock_quantity || {},
        stock_qty: v.stock_qty || 0,
        sku: v.sku,
        price_override: v.price_override,
        is_active: v.is_active,
        created_at: v.created_at ? new Date(v.created_at).toISOString() : undefined,
      })),
    } as Product;
  });
}

// --------------------------------------------------------------------------
// 1. Featured Products ("The Edit")
//    tag: 'featured-products'
//    revalidate: false (ONLY refreshed on admin action)
// --------------------------------------------------------------------------
async function fetchFeaturedProductsRaw(limit = 48): Promise<Product[]> {
  const { dbHttp } = await import('@/db');
  const schema = await import('@/db/schema');
  const { eq, and, desc, inArray, asc } = await import('drizzle-orm');

  // Fetch products marked is_featured = true
  let rawList = await dbHttp
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.is_active, true), eq(schema.products.is_featured, true)))
    .orderBy(desc(schema.products.created_at))
    .limit(limit);

  // If fewer than limit featured products, backfill with active products
  if (rawList.length < limit) {
    const existingIds = rawList.map((p: any) => p.id);
    const { notInArray } = await import('drizzle-orm');

    const backfillConditions = [eq(schema.products.is_active, true)];
    if (existingIds.length > 0) {
      backfillConditions.push(notInArray(schema.products.id, existingIds));
    }

    const backfillList = await dbHttp
      .select()
      .from(schema.products)
      .where(and(...backfillConditions))
      .orderBy(desc(schema.products.created_at))
      .limit(limit - rawList.length);

    rawList = [...rawList, ...backfillList];
  }

  if (rawList.length === 0) return [];

  const pIds = rawList.map((p: any) => p.id);
  const [allImages, allVariants] = await Promise.all([
    dbHttp
      .select()
      .from(schema.productImages)
      .where(inArray(schema.productImages.product_id, pIds))
      .orderBy(asc(schema.productImages.sort_order)),
    dbHttp
      .select()
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.product_id, pIds))
      .orderBy(asc(schema.productVariants.created_at)),
  ]);

  return formatProductRows(rawList, allImages, allVariants);
}

const cachedFeaturedProductsDefault = unstable_cache(
  () => fetchFeaturedProductsRaw(48),
  ['featured-products-48'],
  { tags: ['featured-products'], revalidate: false }
);

export function getCachedFeaturedProducts(limit = 48): Promise<Product[]> {
  if (limit === 48) {
    return cachedFeaturedProductsDefault();
  }
  return unstable_cache(
    () => fetchFeaturedProductsRaw(limit),
    [`featured-products-${limit}`],
    { tags: ['featured-products'], revalidate: false }
  )();
}

// --------------------------------------------------------------------------
// 2. Trending Products ("Trending This Week")
//    tag: 'trending-products'
//    revalidate: 3600 (1 hour natural drift)
//    Deduplicated: Excludes any product ID in the Featured set
// --------------------------------------------------------------------------
async function fetchTrendingProductsRaw(limit = 4): Promise<Product[]> {
  const featured = await getCachedFeaturedProducts(48);
  const featuredIds = featured.map((p) => p.id);

  const { dbHttp } = await import('@/db');
  const schema = await import('@/db/schema');
  const { eq, and, notInArray, desc, inArray, asc } = await import('drizzle-orm');

  const conditions = [eq(schema.products.is_active, true)];
  if (featuredIds.length > 0) {
    conditions.push(notInArray(schema.products.id, featuredIds));
  }

  const rawList = await dbHttp
    .select()
    .from(schema.products)
    .where(and(...conditions))
    .orderBy(desc(schema.products.units_sold), desc(schema.products.created_at))
    .limit(limit);

  if (rawList.length === 0) return [];

  const pIds = rawList.map((p: any) => p.id);
  const [allImages, allVariants] = await Promise.all([
    dbHttp
      .select()
      .from(schema.productImages)
      .where(inArray(schema.productImages.product_id, pIds))
      .orderBy(asc(schema.productImages.sort_order)),
    dbHttp
      .select()
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.product_id, pIds))
      .orderBy(asc(schema.productVariants.created_at)),
  ]);

  return formatProductRows(rawList, allImages, allVariants);
}

const cachedTrendingProductsDefault = unstable_cache(
  () => fetchTrendingProductsRaw(4),
  ['trending-products-4'],
  { tags: ['trending-products'], revalidate: 3600 }
);

export function getCachedTrendingProducts(limit = 4): Promise<Product[]> {
  if (limit === 4) {
    return cachedTrendingProductsDefault();
  }
  return unstable_cache(
    () => fetchTrendingProductsRaw(limit),
    [`trending-products-${limit}`],
    { tags: ['trending-products'], revalidate: 3600 }
  )();
}

// --------------------------------------------------------------------------
// 3. Category Products
//    tag: 'products-{slug}'
//    revalidate: 3600 (1 hour)
// --------------------------------------------------------------------------
async function fetchProductsByCategoryRaw(category: string | null, limit?: number): Promise<Product[]> {
  const { dbHttp } = await import('@/db');
  const schema = await import('@/db/schema');
  const { eq, and, desc, inArray, asc } = await import('drizzle-orm');

  const conditions = [eq(schema.products.is_active, true)];
  if (category && category !== 'all') {
    conditions.push(eq(schema.products.category, category));
  }

  let query = dbHttp
    .select()
    .from(schema.products)
    .where(and(...conditions))
    .orderBy(desc(schema.products.units_sold), desc(schema.products.is_featured), desc(schema.products.created_at));

  const rawList = limit ? await (query as any).limit(limit) : await query;

  if (rawList.length === 0) return [];

  const pIds = rawList.map((p: any) => p.id);
  const [allImages, allVariants] = await Promise.all([
    dbHttp
      .select()
      .from(schema.productImages)
      .where(inArray(schema.productImages.product_id, pIds))
      .orderBy(asc(schema.productImages.sort_order)),
    dbHttp
      .select()
      .from(schema.productVariants)
      .where(inArray(schema.productVariants.product_id, pIds))
      .orderBy(asc(schema.productVariants.created_at)),
  ]);

  return formatProductRows(rawList, allImages, allVariants);
}

export function getCachedAllProducts(limit = 8): Promise<Product[]> {
  const fn = unstable_cache(
    () => fetchProductsByCategoryRaw(null, limit),
    [`products-all-${limit}`],
    { tags: ['products-all'], revalidate: 3600 }
  );
  return fn();
}

export function getCachedProductsByCategory(slug: string, limit = 8): Promise<Product[]> {
  if (slug === 'all') return getCachedAllProducts(limit);

  const fn = unstable_cache(
    () => fetchProductsByCategoryRaw(slug, limit),
    [`products-${slug}-${limit}`],
    { tags: ['products-all', `products-${slug}`], revalidate: 3600 }
  );
  return fn();
}
