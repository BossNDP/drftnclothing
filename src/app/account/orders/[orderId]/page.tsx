import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { orders, productImages } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft, Clock, ShoppingBag, MapPin, Map, Calendar, AlertCircle, ExternalLink } from 'lucide-react';
import CancelOrderButton from './CancelOrderButton';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';

export const metadata = {
  title: 'Order Details',
  description: 'Track and manage your order details.',
};

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
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
    redirect(`/sign-in?redirect_url=/account/orders/${params.orderId}`);
  }

  // UUID validation to prevent database query casting crashes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.orderId)) {
    notFound();
  }

  // Fetch the order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  // CRITICAL SECURITY IDOR CHECK: Return 404 (notFound) if order does not exist OR does not belong to the user
  if (!order || order.user_id !== userId) {
    notFound();
  }

  // Collect all product IDs from the order items
  const productIds = (order?.items as any[] || []).map(i => i.id || i.productId);

  // Fetch product images as a fallback
  const fallbackImages = productIds.length > 0
    ? await db
        .select()
        .from(productImages)
        .where(inArray(productImages.product_id, productIds as string[]))
    : [];

  const imageMap = new globalThis.Map<string, string>();
  fallbackImages.forEach((img: any) => {
    if (!imageMap.has(img.product_id)) {
      imageMap.set(img.product_id, img.image_url);
    }
  });

  const isPickup = order.fulfillment_type === 'pickup';
  const cancelableStatuses = ['confirmed', 'preparing', 'placed'];
  const isCancelable = cancelableStatuses.includes(order.order_status);

  // Stepper logic mapping
  const steps = [
    { label: 'Confirmed', status: ['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'shipped', 'delivered', 'collected'] },
    { label: 'Preparing', status: ['preparing', 'ready_for_pickup', 'shipped', 'delivered', 'collected'] },
    { label: isPickup ? 'Ready for Pickup' : 'Shipped', status: [isPickup ? 'ready_for_pickup' : 'shipped', 'delivered', 'collected'] },
    { label: isPickup ? 'Collected' : 'Delivered', status: [isPickup ? 'collected' : 'delivered'] }
  ];

  // Active step index logic
  let activeIndex = -1;
  steps.forEach((step, idx) => {
    if (step.status.includes(order.order_status)) {
      activeIndex = idx;
    }
  });

  const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-black text-white pt-28 pb-20 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        
        {/* Back Link */}
        <Link 
          href="/account/orders" 
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Orders
        </Link>

        {/* Title / Action Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest font-mono">
              Order {order.order_number}
            </h1>
            <p className="text-zinc-550 text-xs font-mono uppercase mt-1 tracking-wider">
              Placed on {formattedDate}
            </p>
          </div>
          <CancelOrderButton
            orderId={order.id}
            cancelAllowedUntil={order.cancel_allowed_until}
            orderStatus={order.order_status}
          />
        </div>

        {/* Tracking Section (Task 1) */}
        {!isPickup && (
          <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-xl space-y-3 font-mono">
            <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 border-b border-zinc-900 pb-2 flex items-center gap-2">
              <Map className="w-3.5 h-3.5" />
              Shipment Tracking
            </h3>
            {order.tracking_url ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                  <p className="text-xs font-bold text-white uppercase">Your shipment is on the way</p>
                  {order.courier_name && (
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Courier: {order.courier_name} {order.awb_code ? `(AWB: ${order.awb_code})` : ''}
                    </p>
                  )}
                </div>
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-widest text-xs px-6 py-3 rounded-lg transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <span>Track Your Order</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 py-1">
                Your order is being prepared — tracking will be available once shipped.
              </p>
            )}
          </div>
        )}

        {/* Stepper Timeline Progress */}
        {order.order_status !== 'cancelled' && 
         order.order_status !== 'failed' && 
         order.order_status !== 'expired' && 
         order.order_status !== 'payment_mismatch' && (
          <div className="bg-zinc-950 border border-zinc-850 p-6 md:p-8 rounded-xl space-y-6">
            <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400">
              Fulfillment Status
            </h3>
            
            {/* Horizontal Timeline */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
              {/* Desktop connector line */}
              <div className="hidden md:block absolute left-0 right-0 top-4 h-[2px] bg-zinc-800 -z-10" />
              
              {steps.map((step, idx) => {
                const isCompleted = idx <= activeIndex;
                const isCurrent = idx === activeIndex;

                return (
                  <div key={idx} className="flex md:flex-col items-center gap-4 md:gap-2 flex-1 relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all border ${
                      isCompleted 
                        ? 'bg-white border-white text-black font-black' 
                        : 'bg-black border-zinc-800 text-zinc-650'
                    } ${isCurrent ? 'ring-4 ring-zinc-900 scale-110' : ''}`}>
                      {idx + 1}
                    </div>
                    <div className="text-left md:text-center">
                      <p className={`text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-white' : 'text-zinc-500'}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <span className="inline-block text-[9px] bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-400 mt-1 uppercase font-mono">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mismatched/Failed Payment Warnings */}
        {order.order_status === 'payment_mismatch' && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-xl flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider">Payment Verification Alert</h4>
              <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                A mismatch was detected with the checkout amount. Our support team is verifying the payment manually. Your items are safe.
              </p>
            </div>
          </div>
        )}

        {order.order_status === 'cancelled' && (
          <div className="bg-zinc-900 border border-zinc-800/80 text-zinc-400 p-5 rounded-xl flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider">Order Cancelled</h4>
              <p className="text-xs text-zinc-500 mt-1">
                This order was cancelled and inventory was returned to the catalog.
              </p>
            </div>
          </div>
        )}

        {/* Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Items breakdown (2/3 cols) */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 space-y-4">
              <h2 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 border-b border-zinc-900 pb-3">
                Items In Drop
              </h2>
              <div className="divide-y divide-zinc-900">
                {(order.items as any[]).map((item, idx) => (
                  <div key={idx} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="w-16 h-20 bg-zinc-900 shrink-0 overflow-hidden relative border border-zinc-850">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={item.image || imageMap.get(item.id || item.productId) || 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80'} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase text-zinc-200 tracking-wide truncate">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-zinc-550 font-mono mt-1">
                          Size: {item.size} &middot; Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="text-xs font-mono text-zinc-300">
                        ₹{(item.price / 100).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* In-store pickup collection panel */}
            {isPickup && (
              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-2 text-zinc-400">
                  <ShoppingBag className="w-4 h-4 text-white" />
                  <h3 className="text-[10px] uppercase font-mono tracking-widest font-black">
                    In-Store Collection Code
                  </h3>
                </div>
                
                {/* Visual Code Box */}
                <div className="bg-white text-black text-center p-6 space-y-2 border border-zinc-200 rounded-lg">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-500 block">
                    Present this to staff at the counter
                  </span>
                  <div className="text-3xl font-black font-mono tracking-[0.3em] pl-[0.3em] py-2">
                    {order.pickup_code}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-800 block">
                    Fulfillment Status: {order.pickup_status?.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-[10px] text-zinc-500 leading-relaxed font-mono">
                  📍 <strong>Store Address:</strong> {order.shipping_address?.line1}, {order.shipping_address?.line2}, {order.shipping_address?.city}, {order.shipping_address?.pincode}
                  <br />
                  🕒 <strong>Hours:</strong> Mon - Sun, 11:00 AM - 09:00 PM
                </div>
              </div>
            )}
          </div>

          {/* Checkout Totals & Details Sidebar */}
          <div className="space-y-6">
            
            {/* Totals Summary */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 space-y-4 font-mono">
              <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 border-b border-zinc-900 pb-3">
                Summary
              </h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Subtotal</span>
                  <span>₹{(order.subtotal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Fulfillment</span>
                  <span>{isPickup ? 'Store Pickup (Free)' : 'Home Delivery'}</span>
                </div>
                {!isPickup && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Shipping</span>
                    <span>₹{(order.shipping_charge / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {order.discount_amount && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Discount ({order.discount_code})</span>
                    <span>-₹{(order.discount_amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t border-zinc-900 pt-3 flex justify-between font-black text-sm text-white">
                  <span>TOTAL</span>
                  <span>₹{(order.total / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {order.payment_type === 'cod_with_deposit' && (
                  <div className="pt-3 border-t border-zinc-900/60 space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Booking Deposit Paid</span>
                      <span className="text-green-400">₹200.00</span>
                    </div>
                    <div className="flex justify-between font-bold text-yellow-500 bg-yellow-500/5 p-2 border border-yellow-500/10 rounded">
                      <span className="uppercase text-[9px] tracking-wider">Cash Due at Delivery</span>
                      <span>₹{((order.remaining_amount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fulfillment Destination Sidebar */}
            {!isPickup && (
              <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 space-y-4">
                <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 border-b border-zinc-900 pb-3 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Delivery Destination
                </h3>
                <div className="text-xs space-y-1.5 text-zinc-355 font-mono">
                  <p className="font-bold text-white uppercase">{order.customer_name}</p>
                  <p>{order.shipping_address?.line1}</p>
                  {order.shipping_address?.line2 && <p>{order.shipping_address?.line2}</p>}
                  <p>{order.shipping_address?.city}, {order.shipping_address?.state} - {order.shipping_address?.pincode}</p>
                  <p className="text-[10px] text-zinc-500 mt-2 font-mono">📞 {order.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
