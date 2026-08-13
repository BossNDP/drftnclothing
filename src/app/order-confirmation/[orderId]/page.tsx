import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { CheckCircle, ShoppingBag, MapPin, ClipboardList } from 'lucide-react';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import MetaPurchaseTracker from '@/components/MetaPurchaseTracker';

export const metadata = {
  title: 'Order Confirmed',
  description: 'Thank you for your order.',
};

export const dynamic = 'force-dynamic';

export default async function OrderConfirmationPage({ params }: { params: { orderId: string } }) {
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
    try {
      const clerkAuth = await auth();
      if (clerkAuth.userId) {
        userId = clerkAuth.userId;
      }
    } catch (e) {
      console.warn('[Order Confirmation Page] Failed to retrieve Clerk auth session:', e);
    }
  }

  if (!userId) {
    redirect(`/sign-in?redirect_url=/order-confirmation/${params.orderId}`);
  }

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.orderId)) {
    notFound();
  }

  // Fetch order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  // IDOR check
  if (!order || order.user_id !== userId) {
    notFound();
  }

  const isPickup = order.fulfillment_type === 'pickup';

  const itemContentIds = Array.isArray(order.items)
    ? (order.items as any[]).map((item) => String(item.id || item.product_id || '')).filter(Boolean)
    : [];

  return (
    <main className="min-h-screen bg-black text-white pt-28 pb-20 px-4 md:px-8">
      {/* Idempotent Meta Pixel Purchase Tracker */}
      <MetaPurchaseTracker
        orderId={order.id}
        contentIds={itemContentIds}
        totalValue={order.total / 100}
        currency="INR"
      />

      <div className="max-w-xl mx-auto text-center space-y-8 animate-fade-in">
        
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center border border-white/20">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
        </div>

        {/* Messaging */}
        <div className="space-y-3">
          <span className="text-[10px] font-mono tracking-widest text-zinc-550 uppercase block">
            Payment Verified &amp; Confirmed
          </span>
          <h1 className="text-3xl font-black uppercase tracking-widest font-mono">
            Welcome To The Drop.
          </h1>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Your order <strong>{order.order_number}</strong> has been secured. A confirmation is waiting in your dashboard.
          </p>
        </div>

        {/* Main Details Panel */}
        <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-xl text-left space-y-5">
          <h2 className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 border-b border-zinc-900 pb-3 font-bold">
            Fulfillment Summary
          </h2>

          {isPickup ? (
            <div className="space-y-4">
              <div className="bg-white text-black p-5 rounded-lg text-center space-y-1">
                <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-500 block">
                  In-Store pickup code
                </span>
                <div className="text-2xl font-black font-mono tracking-[0.2em] pl-[0.2em] py-1">
                  {order.pickup_code}
                </div>
              </div>
              <div className="text-xs space-y-1 font-mono text-zinc-400">
                <p className="text-white font-bold">📍 Store Pickup Point:</p>
                <p>DRFTN Store</p>
                <p>1st Floor, Kogilu Main Rd, above Sri Venkateshwar Vaibhava Veg Hotel, K B Sandra, Yelahanka, Bengaluru</p>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Show this code to store staff when collecting your items.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs space-y-1.5 font-mono text-zinc-400">
              <p className="text-white font-bold">📍 Shipping To:</p>
              <p className="text-zinc-300 font-bold">{order.customer_name}</p>
              <p>{order.shipping_address?.line1}</p>
              {order.shipping_address?.line2 && <p>{order.shipping_address?.line2}</p>}
              <p>{order.shipping_address?.city}, {order.shipping_address?.state} - {order.shipping_address?.pincode}</p>
            </div>
          )}

          {/* Items breakdown preview */}
          <div className="border-t border-zinc-900 pt-4 space-y-3 font-mono">
            <h3 className="text-[9px] text-zinc-500 uppercase tracking-wider">
              secured fits
            </h3>
            {(order.items as any[]).map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-zinc-300 truncate max-w-[200px]">
                  {item.name} ({item.size}) x{item.quantity}
                </span>
                <span>₹{(item.price * item.quantity / 100).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="border-t border-zinc-900 pt-3 flex justify-between font-black text-xs text-white">
              <span>TOTAL</span>
              <span>₹{(order.total / 100).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Navigation Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href={`/account/orders/${order.id}`}
            className="flex items-center justify-center gap-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-white px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors rounded-lg"
          >
            <ClipboardList className="w-4 h-4" />
            Track Order
          </Link>
          <Link
            href="/shop"
            className="flex items-center justify-center border border-white bg-white text-black px-6 py-3 font-bold uppercase tracking-widest text-xs hover:bg-black hover:text-white transition-colors rounded-lg"
          >
            Shop New Drops
          </Link>
        </div>
      </div>
    </main>
  );
}
