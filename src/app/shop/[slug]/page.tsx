// Server component — fetches product data at render time (SSR)
// so the client sees HTML with data already embedded — zero loading state.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dbService } from '@/lib/db';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import ProductDetailClient from './_ProductDetailClient';
import { Product } from '@/types';

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
  const product = await dbService.getProductBySlug(params.slug);

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
  // Fetch product + all products in PARALLEL on the server during SSR.
  const [product, allProducts] = await Promise.all([
    dbService.getProductBySlug(params.slug),
    dbService.getProducts(),
  ]);

  if (!product) {
    notFound();
  }

  // Compute related products server-side
  const relatedProducts: Product[] = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <ProductDetailClient
      params={params}
      initialProduct={product}
      initialRelatedProducts={relatedProducts}
    />
  );
}
