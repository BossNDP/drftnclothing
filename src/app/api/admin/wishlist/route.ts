import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc, sql, ilike, or } from 'drizzle-orm';
import { dbService } from '@/lib/db';
import { getOptimizedImageUrl } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/wishlist
 * Server-side paginated list of wishlist records with search, status filtering,
 * customer resolution, and customer detail stats.
 */
export async function GET(request: Request) {
  try {
    await dbService.ensureWishlistTableExists();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const statusFilter = searchParams.get('status') || 'all';

    // 1. Fetch all users from Neon to resolve customer names & emails
    const localUsers = await db.select().from(schema.users);
    const userMap = new Map(localUsers.map((u: any) => [u.id, u]));

    // 2. Fetch all orders to compute customer stats and purchase status
    const allOrders = await db.select().from(schema.orders);

    const userPurchasedProducts = new Map<string, Set<string>>();
    const userOrderStats = new Map<string, { totalOrders: number; totalSpentPaise: number }>();

    for (const order of allOrders) {
      if (!order.user_id || order.order_status === 'cancelled') continue;

      const stats = userOrderStats.get(order.user_id) || { totalOrders: 0, totalSpentPaise: 0 };
      stats.totalOrders += 1;
      stats.totalSpentPaise += order.total_amount || 0;
      userOrderStats.set(order.user_id, stats);

      const boughtSet = userPurchasedProducts.get(order.user_id) || new Set<string>();
      if (Array.isArray(order.items)) {
        for (const item of order.items as any[]) {
          if (item.id) boughtSet.add(item.id);
        }
      }
      userPurchasedProducts.set(order.user_id, boughtSet);
    }

    // 3. Fetch wishlist records joined with products
    const wishlistRows = await db
      .select({
        id: schema.wishlist.id,
        userId: schema.wishlist.user_id,
        productId: schema.wishlist.product_id,
        createdAt: schema.wishlist.created_at,
        lastReminderSentAt: schema.wishlist.last_reminder_sent_at,
        reminderCount: schema.wishlist.reminder_count,
        product: schema.products,
      })
      .from(schema.wishlist)
      .innerJoin(schema.products, eq(schema.wishlist.product_id, schema.products.id))
      .orderBy(desc(schema.wishlist.created_at));

    // Group all wishlisted products per user for customer drawer details
    const userWishlistMap = new Map<string, Array<{ name: string; image: string; price: number; slug: string }>>();
    for (const row of wishlistRows) {
      const existing = userWishlistMap.get(row.userId) || [];
      existing.push({
        name: row.product.name,
        image: getOptimizedImageUrl(row.product.images[0] || 'https://drftnclothing.in/og-default.jpg', 400),
        price: row.product.price,
        slug: row.product.slug,
      });
      userWishlistMap.set(row.userId, existing);
    }

    // 4. Enrich and status-tag items
    const enrichedItems = wishlistRows.map((row: any) => {
      const user: any = userMap.get(row.userId);
      const customerName = user?.name || 'Registered Customer';
      const customerEmail = user?.email || `${row.userId.slice(0, 12)}@clerk.user`;

      const totalStock = row.product.sizes.reduce(
        (acc: number, s: string) => acc + (row.product.stock_quantity[s] || 0),
        0
      );
      const isPurchased = userPurchasedProducts.get(row.userId)?.has(row.productId) || false;

      let status: 'waiting' | 'purchased' | 'low_stock' | 'out_of_stock' = 'waiting';
      if (isPurchased) {
        status = 'purchased';
      } else if (totalStock === 0) {
        status = 'out_of_stock';
      } else if (totalStock <= 5) {
        status = 'low_stock';
      }

      const custStats = userOrderStats.get(row.userId) || { totalOrders: 0, totalSpentPaise: 0 };
      const savedProducts = userWishlistMap.get(row.userId) || [];

      return {
        id: row.id,
        userId: row.userId,
        customerName,
        customerEmail,
        product: {
          id: row.product.id,
          name: row.product.name,
          slug: row.product.slug,
          price: row.product.price,
          comparePrice: row.product.compare_price,
          image: getOptimizedImageUrl(row.product.images[0] || 'https://drftnclothing.in/og-default.jpg', 800),
          category: row.product.category,
          stockCount: totalStock,
        },
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        status,
        lastReminderSentAt: row.lastReminderSentAt ? new Date(row.lastReminderSentAt).toISOString() : null,
        reminderCount: row.reminderCount || 0,
        customerDetail: {
          name: customerName,
          email: customerEmail,
          joinedAt: user?.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
          totalOrders: custStats.totalOrders,
          totalSpentPaise: custStats.totalSpentPaise,
          wishlistCount: savedProducts.length,
          wishlistItems: savedProducts,
        },
      };
    });

    // 5. Apply Search & Status Filters
    let filtered = enrichedItems;

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (item: any) =>
          item.customerName.toLowerCase().includes(query) ||
          item.customerEmail.toLowerCase().includes(query) ||
          item.product.name.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((item: any) => item.status === statusFilter);
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedItems = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      items: paginatedItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (err: any) {
    console.error('[Admin Wishlist API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch wishlist items' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/wishlist
 * Allows admins to remove a specific wishlist record.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Wishlist ID required' }, { status: 400 });
    }

    await db.delete(schema.wishlist).where(eq(schema.wishlist.id, id));

    return NextResponse.json({ success: true, message: 'Wishlist item removed' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
