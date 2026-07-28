import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SizeEnum } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const size = searchParams.get('size');

    if (!productId || !size) {
      return NextResponse.json({ error: 'Missing productId or size parameters' }, { status: 400 });
    }

    // Validate productId as a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return NextResponse.json({ error: 'Invalid product ID format' }, { status: 400 });
    }

    // Validate size enum
    const sizeValidation = SizeEnum.safeParse(size);
    if (!sizeValidation.success) {
      return NextResponse.json({ error: 'Invalid size value' }, { status: 400 });
    }

    // Query product
    const [product] = await db
      .select({
        stock_quantity: schema.products.stock_quantity,
        is_active: schema.products.is_active,
      })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!product || !product.is_active) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    const stock = product.stock_quantity || {};
    const qty = stock[size] !== undefined ? stock[size] : 0;
    const inStock = qty > 0;
    const lowStock = inStock && qty <= 3;

    return new NextResponse(
      JSON.stringify({
        productId,
        size,
        available: qty,
        inStock,
        lowStock,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
        },
      }
    );

  } catch (error) {
    console.error('Stock check API error:', error);
    return NextResponse.json({ error: 'An unexpected server error occurred during stock check' }, { status: 500 });
  }
}
