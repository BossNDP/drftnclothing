import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { orders, productImages, users } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import ProfileSection from '@/components/ProfileSection';

export const metadata = {
  title: 'My Orders & Profile',
  description: 'Manage your DRFTN Clothing profile and track your orders.',
};

export const dynamic = 'force-dynamic';

function getStatusColor(status: string) {
  switch (status) {
    case 'pending_payment':
      return 'bg-amber-550/10 text-amber-400 border border-amber-550/20';
    case 'payment_verifying':
      return 'bg-blue-500/10 text-blue-400 border border-blue-550/20';
    case 'confirmed':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'preparing':
      return 'bg-purple-550/10 text-purple-400 border border-purple-550/20';
    case 'ready_for_pickup':
      return 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
    case 'shipped':
      return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
    case 'delivered':
    case 'collected':
      return 'bg-zinc-800 text-zinc-300 border border-zinc-700';
    case 'failed':
    case 'expired':
    case 'payment_mismatch':
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    case 'cancelled':
      return 'bg-zinc-900 text-zinc-500 border border-zinc-800';
    default:
      return 'bg-zinc-900 text-zinc-400 border border-zinc-800';
  }
}

export default async function CustomerOrdersPage() {
  let userId: string | null = null;
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('drftn_session')?.value;

  if (sessionToken) {
    const payload = await verifyToken(sessionToken);
    if (payload && payload.userId) {
      userId = payload.userId as string;
    }
  }

  if (!userId) {
    const clerkAuth = await auth();
    if (clerkAuth.userId) {
      userId = clerkAuth.userId;
    }
  }

  if (!userId) {
    redirect('/sign-in?redirect_url=/account/orders');
  }

  // Fetch user details from database
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!dbUser) {
    redirect('/sign-in?redirect_url=/account/orders');
  }

  // Fetch only this user's orders, sorted by newest first
  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.user_id, userId))
    .orderBy(desc(orders.created_at));

  // Collect all product IDs from the orders
  const productIds = Array.from(new Set(userOrders.flatMap((o: any) => (o.items as any[]).map(i => i.id || i.productId))));

  // Fetch product images as a fallback
  const fallbackImages = productIds.length > 0
    ? await db
        .select()
        .from(productImages)
        .where(inArray(productImages.product_id, productIds as string[]))
    : [];

  const imageMap = new Map<string, string>();
  fallbackImages.forEach((img: any) => {
    if (!imageMap.has(img.product_id)) {
      imageMap.set(img.product_id, img.image_url);
    }
  });

  return (
    <main className="min-h-screen bg-black text-white pt-28 pb-20 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="border-b border-zinc-800 pb-8 flex flex-col md:flex-row md:items-baseline md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-widest font-mono">
              Order History
            </h1>
            <p className="text-zinc-500 text-sm mt-2 font-mono uppercase text-[10px] tracking-wider">
              View details and track all your streetwear drops.
            </p>
          </div>
          <div className="text-zinc-550 text-xs font-mono uppercase tracking-wider">
            Total Orders: {userOrders.length}
          </div>
        </div>

        {/* Orders List */}
        {userOrders.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-xl space-y-6">
            <div className="bg-zinc-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-zinc-500">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-zinc-300 uppercase tracking-widest text-sm">
                No orders yet
              </h3>
              <p className="text-zinc-500 text-xs max-w-xs mx-auto">
                You haven&apos;t participated in any DRFTN drops yet. Grab your first fit now.
              </p>
            </div>
            <Link
              href="/shop"
              className="inline-flex items-center justify-center border border-white text-black bg-white px-6 py-2.5 font-bold uppercase tracking-widest text-xs hover:bg-black hover:text-white transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {userOrders.map((order: any) => {
              const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div 
                  key={order.id} 
                  className="bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden hover:border-zinc-800 transition-colors"
                >
                  {/* Top bar info */}
                  <div className="p-5 bg-zinc-900/30 border-b border-zinc-900 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest block">
                          Order Number
                        </span>
                        <Link 
                          href={`/account/orders/${order.id}`}
                          className="text-xs font-black uppercase font-mono tracking-wider hover:underline hover:text-zinc-300"
                        >
                          {order.order_number}
                        </Link>
                      </div>
                      <div className="hidden sm:block w-px h-6 bg-zinc-800" />
                      <div>
                        <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest block">
                          Placed On
                        </span>
                        <span className="text-xs text-zinc-300 font-mono">
                          {formattedDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded ${getStatusColor(order.order_status)}`}>
                        {order.order_status.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] uppercase font-mono tracking-wider bg-zinc-900 border border-zinc-850 px-2 py-1 text-zinc-400">
                        {order.fulfillment_type === 'pickup' ? 'Store Pickup' : 'Delivery'}
                      </span>
                    </div>
                  </div>

                  {/* Body preview items */}
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      {(order.items as any[]).slice(0, 2).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="w-12 h-14 bg-zinc-900 shrink-0 overflow-hidden relative border border-zinc-850">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={item.image || imageMap.get(item.id || item.productId) || 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80'} 
                              alt={item.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-zinc-200 truncate uppercase tracking-wide">
                              {item.name}
                            </h4>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              Size: {item.size} &middot; Qty: {item.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-[10px] text-zinc-500 font-mono pl-16">
                          + {order.items.length - 2} more {order.items.length - 2 === 1 ? 'item' : 'items'}
                        </p>
                      )}
                    </div>

                    {/* Action buttons & Price */}
                    <div className="flex md:flex-col items-baseline md:items-end justify-between md:justify-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest block">
                          Total Paid
                        </span>
                        <span className="text-sm font-black font-mono">
                          ₹{(order.total / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="inline-flex items-center gap-2 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all"
                      >
                        Details
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Profile Details Section */}
        <ProfileSection 
          initialName={dbUser.name} 
          phone={dbUser.phone || ''} 
          authProvider={dbUser.auth_provider || (dbUser as any).authProvider || 'phone'}
        />
      </div>
    </main>
  );
}
