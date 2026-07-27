import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { dbService } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idsOnly = searchParams.get('idsOnly') === 'true';

    if (idsOnly) {
      const productIds = await dbService.getUserWishlistProductIds(userId);
      return NextResponse.json({ productIds }, { status: 200 });
    }

    const products = await dbService.getUserWishlistProducts(userId);
    return NextResponse.json({ products }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/wishlist GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wishlist', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await dbService.addToWishlist(userId, productId);
    return NextResponse.json({ success: true, message: 'Added to wishlist' }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/wishlist POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to add to wishlist', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await dbService.removeFromWishlist(userId, productId);
    return NextResponse.json({ success: true, message: 'Removed from wishlist' }, { status: 200 });
  } catch (error: any) {
    console.error('[API /api/wishlist DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to remove from wishlist', details: error.message },
      { status: 500 }
    );
  }
}
