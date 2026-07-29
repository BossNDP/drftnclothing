/**
 * GET /api/products/category/[slug]
 *
 * Serves homepage ProductWall requests on client-side category switches.
 * Reads from the same unstable_cache layer as the Server Component SSR —
 * NEVER a raw Drizzle query here.
 *
 * Cache: 1 hour on CDN / s-maxage, stale-while-revalidate for 24h
 * Revalidation: via revalidateTag(`products-${slug}`) from admin mutations
 */

import { NextResponse } from 'next/server';
import { getCachedProductsByCategory } from '@/lib/product-cache';

// Edge runtime is fine here — unstable_cache works in both runtimes on Next 14
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Category slug is required' }, { status: 400 });
    }

    // Normalise slug — lowercase, trim
    const cat = slug.toLowerCase().trim();

    const products = await getCachedProductsByCategory(cat, 8);

    return NextResponse.json(
      { products, category: cat, count: products.length },
      {
        headers: {
          // Serve from CDN for 1 hour, stale-while-revalidate for 24h
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('[/api/products/category] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
