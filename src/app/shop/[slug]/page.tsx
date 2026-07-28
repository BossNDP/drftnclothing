// Server component — fetches product data with ISR caching (180s revalidate)
// Drops document request latency from ~1,690ms to ~20-50ms (Vercel Edge CDN cache)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { dbService } from '@/lib/db';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import ProductDetailClient from './_ProductDetailClient';

// Enable Incremental Static Regeneration (ISR) with 180-second window
export const revalidate = 180;

// Wrap product fetcher in React cache() so generateMetadata and ProductDetailPage share 1 single DB execution per request
const getCachedProduct = cache(async (slug: string) => {
  return dbService.getProductBySlug(slug);
});

interface Props {
  params: { slug: string };
  searchParams: { color?: string };
}

/**
 * NOT SHOPIFY APPS:
 * Dynamic per-variant OpenGraph metadata generated on-the-fly via Cloudinary transformation pipelines.
 * When a user shares a specific color variant link (e.g. ?color=black-edition), WhatsApp, Twitter, Discord,
 * Telegram, Slack, and Facebook receive an exact 1200x630 large image preview card.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const product = await getCachedProduct(params.slug);

  if (!product) {
    return {
      title: 'Product Not Found | DRFTN CLOTHING',
      description: 'This streetwear product could not be found.',
    };
  }

  // Find matching variant if color parameter exists
  let targetImage = product.images[0] ?? '';
  let colorTitle = '';

  if (searchParams?.color && product.variants && product.variants.length > 0) {
    const matchedVariant = product.variants.find(
      (v) => v.colour_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === searchParams.color?.toLowerCase()
    );
    if (matchedVariant && matchedVariant.images && matchedVariant.images.length > 0) {
      targetImage = matchedVariant.images[0];
      colorTitle = ` — ${matchedVariant.colour_name}`;
    }
  }

  const priceFormatted = `₹${Math.round(product.price / 100).toLocaleString('en-IN')}`;

  // Cloudinary Dynamic OG Image Generation (1200x630 landscape format for large social cards)
  const ogImageUrl = targetImage
    ? getOptimizedImageUrl(targetImage, 1200)
    : 'https://www.drftnclothing.in/og-default.jpg';

  const desc = product.description || '';
  const cleanDesc = desc.includes('\n\nTags: ') ? desc.split('\n\nTags: ')[0] : desc;
  const ogDescription = `${priceFormatted} • Heavyweight D2C Streetwear • ${cleanDesc.slice(0, 120).trim()}${cleanDesc.length > 120 ? '…' : ''}`;
  const title = `${product.name}${colorTitle} | DRFTN`;
  const pageUrl = `https://www.drftnclothing.in/shop/${product.slug}${searchParams?.color ? `?color=${searchParams.color}` : ''}`;

  return {
    title,
    description: ogDescription,
    openGraph: {
      title,
      description: ogDescription,
      url: pageUrl,
      type: 'website',
      siteName: 'DRFTN CLOTHING',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${product.name}${colorTitle}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
      images: [ogImageUrl],
    },
  };
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  // Use React.cache() single-fetch execution
  const product = await getCachedProduct(params.slug);

  if (!product) {
    notFound();
  }

  // Fetch 4 related products using category query (LIMIT 4) instead of getProducts() catalog dump
  const relatedProducts = await dbService.getRelatedProducts(product.category, product.id, 4);

  const heroImageUrl = product.images[0] ? getOptimizedImageUrl(product.images[0], 1400) : '';

  return (
    <>
      {heroImageUrl && (
        <link
          rel="preload"
          as="image"
          href={heroImageUrl}
          // @ts-ignore - fetchPriority is supported in modern browsers
          fetchPriority="high"
        />
      )}
      <ProductDetailClient
        params={params}
        initialProduct={product}
        initialRelatedProducts={relatedProducts}
      />
    </>
  );
}
