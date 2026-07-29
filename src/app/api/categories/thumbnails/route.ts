import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

// Cache category thumbnails for 10 minutes (600 seconds)
export const revalidate = 600;

export async function GET() {
  try {
    const thumbnails = await dbService.getCategoryThumbnails();
    return NextResponse.json(
      { thumbnails },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
        },
      }
    );
  } catch (error) {
    console.error('Failed to get category thumbnails:', error);
    return NextResponse.json({ error: 'Failed to fetch category thumbnails' }, { status: 500 });
  }
}
