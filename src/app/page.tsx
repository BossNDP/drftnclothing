// Server component — exports metadata and renders the client page
import type { Metadata } from 'next';
import HomePageClient from './_HomePageClient';
import { dbService } from '@/lib/db';

export const revalidate = 180;

export const metadata: Metadata = {
  title: 'DRFTN CLOTHING — Built Different | Premium Streetwear Bengaluru',
  description:
    'Born in Yelahanka, Bengaluru. Premium heavyweight streetwear — oversized tees, hoodies, joggers. Limited drops. Built different.',
  openGraph: {
    title: 'DRFTN CLOTHING — Built Different',
    description:
      'Born in Yelahanka, Bengaluru. Premium heavyweight streetwear — oversized tees, hoodies, joggers. Limited drops. Built different.',
    url: 'https://www.drftnclothing.in',
    type: 'website',
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'DRFTN CLOTHING — Built Different',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DRFTN CLOTHING — Built Different',
    description:
      'Born in Yelahanka, Bengaluru. Premium heavyweight streetwear — oversized tees, hoodies, joggers. Limited drops. Built different.',
    images: ['/og-default.jpg'],
  },
};

export default async function HomePage() {
  const [initialProducts, initialCategories] = await Promise.all([
    dbService.getHomepageProducts(),
    dbService.getCategories(),
  ]);

  return (
    <HomePageClient
      initialProducts={initialProducts}
      initialCategories={initialCategories}
    />
  );
}
