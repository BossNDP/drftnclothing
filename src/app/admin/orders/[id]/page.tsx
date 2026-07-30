'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { Order, StoreSettings } from '@/types';
import { ArrowLeft, Clipboard, Check, Phone, Mail, MapPin, CreditCard, ShoppingBag, Truck, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';

const STATUS_HIERARCHY: Record<string, number> = {
  pending_payment: 1,
  placed: 2,
  payment_verifying: 2,
  confirmed: 3,
  preparing: 4,
  ready_for_pickup: 5,
  shipped: 5,
  delivered: 6,
  collected: 6,
  cancelled: 7,
};

export default function AdminOrderDetail() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isBookingShipment, setIsBookingShipment] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [envStatus, setEnvStatus] = useState({ razorpay: false, shiprocket: false, makeWebhook: false });
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [isCodeVerified, setIsCodeVerified] = useState(true);

  // Manual shipping fields
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierPartner, setCourierPartner] = useState('');

  const fetchOrderDetails = async () => {
    try {
      const data = await db.getOrderById(orderId);
      if (data) {
        setOrder(data);
        if (data.tracking_number) setTrackingNumber(data.tracking_number);
        if (data.courier_partner) setCourierPartner(data.courier_partner);
        
        // Auto-verify if order is already collected, cancelled or failed
        if (data.order_status === 'collected' || data.order_status === 'cancelled' || data.order_status === 'failed') {
          setIsCodeVerified(true);
        }
      } else {
        addToast('Order not found', 'error');
        router.push('/admin/orders');
      }

      // Also fetch env configurations
      const configRes = await fetch('/api/admin/settings');
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.envStatus) {
          setEnvStatus(configData.envStatus);
        }
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to load order details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleStatusChange = async (newStatus: Order['order_status'], extraData: Record<string, any> = {}) => {
    if (!order) return;
    
    // Client-side guard for final states
    const finalStates = ['delivered', 'collected', 'cancelled'];
    if (finalStates.includes(order.order_status)) {
      addToast(`Cannot change status. Order is already in a final state: "${order.order_status}"`, 'error');
      return;
    }

    if (newStatus !== 'cancelled') {
      const currentVal = STATUS_HIERARCHY[order.order_status] || 0;
      const newVal = STATUS_HIERARCHY[newStatus] || 0;
      if (newVal < currentVal) {
        addToast(`Prohibited backward transition: "${order.order_status}" to "${newStatus}"`, 'error');
        return;
      }
    }

    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          ...extraData
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update order status');
      }

      addToast(`Order status updated to "${newStatus}"`, 'success');
      setPickupCodeInput('');
      fetchOrderDetails();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to update status', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setIsBookingShipment(true);
    try {
      const payload: Record<string, string> = {};
      
      // If Shiprocket is NOT connected, or if manually entering
      if (!envStatus.shiprocket) {
        if (!trackingNumber.trim() || !courierPartner.trim()) {
          addToast('Please enter both tracking number and courier partner name', 'error');
          setIsBookingShipment(false);
          return;
        }
        payload.trackingNumber = trackingNumber.trim();
        payload.courierPartner = courierPartner.trim();
      }

      const res = await fetch(`/api/admin/orders/${order.id}/shipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process shipment request');
      }

      addToast(`Shipment processed! AWB Code: ${data.awb}`, 'success');
      fetchOrderDetails();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to process shipment', 'error');
    } finally {
      setIsBookingShipment(false);
    }
  };

  const copyToClipboard = () => {
    if (!order) return;
    const addr = order.shipping_address;
    if (!addr) {
      addToast('No shipping address available to copy', 'error');
      return;
    }
    const text = `${order.customer_name}\n${order.customer_phone}\n${addr.line1}\n${addr.line2 || ''}\n${addr.city}, ${addr.state} - ${addr.pincode}`;
    
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    addToast('Address copied to clipboard', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading || !order) {
    return <div className="p-8 text-zinc-500 font-bold uppercase tracking-widest text-sm animate-pulse">Loading order details...</div>;
  }

  const orderAddress = order.shipping_address;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Back Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/orders')}
            className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-widest uppercase text-zinc-900">
              Order {order.order_number}
            </h1>
            <p className="text-zinc-600 text-sm mt-1">
              Placed on {new Date(order.created_at || '').toLocaleString()}
            </p>
          </div>
        </div>

        {/* Quick WhatsApp Link */}
        <button
          onClick={() => {
            const cleanPhone = order.customer_phone.replace(/\D/g, '');
            const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
            window.open(
              `https://wa.me/${phoneWithCountry}?text=Hello%20${encodeURIComponent(
                order.customer_name
              )},%20this%20is%20DRFTN%20CLOTHING%20regarding%20your%20order%20${order.order_number}.`,
              '_blank'
            );
          }}
          className="bg-[#25D366] text-white px-5 py-2.5 font-bold uppercase tracking-wider text-xs hover:bg-[#20ba56] transition-colors flex items-center gap-2 rounded cursor-pointer"
        >
          <Phone className="w-4 h-4 fill-white text-white" />
          Contact on WhatsApp
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Items and Delivery progress */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Order Items */}
          <div className="bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 md:p-8">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-100 pb-3 flex items-center gap-2 mb-6">
              <ShoppingBag className="w-4 h-4 text-brand-red" />
              Order Items
            </h2>

            <div className="divide-y divide-zinc-100">
              {order.items.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="py-4 flex gap-4 first:pt-0 last:pb-0 items-center">
                  <div className="w-16 h-20 bg-zinc-50 border border-zinc-150 overflow-hidden flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase truncate">{item.name}</h4>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
                      Size: {item.size} • Qty: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-zinc-900">₹{((item.price * item.quantity) / 100).toFixed(2)}</p>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">₹{(item.price / 100).toFixed(2)} each</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotals breakdown */}
            <div className="border-t border-zinc-100 mt-6 pt-4 space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-650">
                <span>Subtotal</span>
                <span className="font-mono text-zinc-900 font-semibold">₹{(order.subtotal / 100).toFixed(2)}</span>
              </div>
              {order.discount_code && (
                <div className="flex justify-between items-center text-green-700">
                  <span>Coupon ({order.discount_code})</span>
                  <span className="font-mono font-semibold">-₹{(order.discount_amount ? order.discount_amount / 100 : 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-zinc-650">
                <span>Shipping Fee</span>
                <span className="font-mono text-zinc-900 font-semibold">₹{(order.shipping_charge / 100).toFixed(2)}</span>
              </div>
              <div className="border-t border-zinc-100 pt-3 flex justify-between items-center text-sm font-extrabold uppercase">
                <span className="text-zinc-900">Total Amount</span>
                <span className="font-mono text-zinc-900 text-lg">₹{(order.total / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Shipment Booking section (Ignored/bypassed if pickup) */}
          <div className="bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 md:p-8 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-100 pb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-red" />
              Logistics & Shipment
            </h2>

            {order.fulfillment_type === 'pickup' ? (
              <div className="bg-zinc-50 border border-zinc-200 p-6 rounded text-left space-y-2">
                <div className="flex items-center gap-2 text-purple-700">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="font-bold text-xs uppercase tracking-wider">Store Pickup Order</span>
                </div>
                <p className="text-xs text-zinc-600 leading-normal">
                  Shiprocket shipping is bypassed for this order. Verification of the 6-digit customer pickup code is required at the counter.
                </p>
                <div className="mt-3 p-3 bg-white border border-zinc-200 font-mono text-xs rounded flex justify-between items-center">
                  <span className="text-zinc-500">Security Code:</span>
                  <span className="text-zinc-900 font-bold tracking-widest">{order.pickup_code}</span>
                </div>
              </div>
            ) : order.tracking_number || order.tracking_url ? (
              <div className="bg-zinc-50 border border-zinc-200 p-6 rounded space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-zinc-700" />
                    <h4 className="text-xs uppercase text-zinc-900 font-bold tracking-wider">Shipment Details</h4>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
                    Status: {order.order_status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">Courier Name</span>
                    <span className="font-bold text-zinc-900 block mt-0.5">
                      {order.courier_name || order.courier_partner || 'Not yet shipped'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">AWB Code</span>
                    <span className="font-bold text-zinc-900 block mt-0.5">
                      {order.awb_code || order.tracking_number || 'Not yet shipped'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold">Tracking URL</span>
                    {order.tracking_url ? (
                      <a
                        href={order.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-blue-600 hover:underline block mt-0.5 truncate"
                      >
                        {order.tracking_url}
                      </a>
                    ) : (
                      <span className="text-zinc-500 block mt-0.5 font-normal italic">Not yet shipped</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateShipment} className="space-y-4">
                {envStatus.shiprocket ? (
                  <div className="bg-zinc-50 border border-zinc-200 p-6 space-y-4 rounded text-left">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs uppercase text-zinc-700 font-bold tracking-wider">Shiprocket Connected</h4>
                        <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                          Click below to automatically send customer details, items, and values to your Shiprocket account and allocate an AWB.
                        </p>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isBookingShipment}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isBookingShipment ? 'Booking on Shiprocket...' : 'Book Automatic Shipment'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 border border-zinc-200 p-6 bg-amber-50/60 rounded">
                    <p className="text-xs text-amber-800 font-semibold leading-normal mb-2">
                      ⚠️ Shiprocket credentials are not configured. Enter tracking details manually below to update client tracking pages.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-600 block">Courier Partner</label>
                        <input
                          type="text"
                          placeholder="e.g. Delhivery / BlueDart"
                          value={courierPartner}
                          onChange={(e) => setCourierPartner(e.target.value)}
                          className="w-full bg-white border border-zinc-200 text-zinc-900 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-600 block font-mono">Tracking AWB Code</label>
                        <input
                          type="text"
                          placeholder="e.g. 740616451"
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          className="w-full bg-white border border-zinc-200 text-zinc-900 px-3 py-2 text-xs focus:outline-none focus:border-zinc-900 font-mono"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isBookingShipment}
                      className="bg-zinc-900 text-white px-6 py-3 font-bold uppercase tracking-widest text-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {isBookingShipment ? 'Saving Tracking Info...' : 'Save Manual Tracking'}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Customer info, Payment and Workflow Status */}
        <div className="space-y-6">
          
          {/* Status Dropdown */}
          <div className="bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 md:p-8 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-100 pb-3">
              Order Workflow
            </h2>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-500 block">Change Order Status</label>
              <select
                value={order.order_status}
                disabled={isUpdatingStatus || order.order_status === 'delivered' || order.order_status === 'collected' || order.order_status === 'cancelled'}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className={`w-full bg-white border px-4 py-3 text-xs font-bold uppercase tracking-wider rounded cursor-pointer focus:outline-none disabled:opacity-65 ${
                  order.order_status === 'delivered' || order.order_status === 'collected' ? 'border-green-600 text-green-700' :
                  order.order_status === 'cancelled' ? 'border-red-600 text-red-700' :
                  'border-zinc-200 text-zinc-800 focus:border-zinc-900'
                }`}
              >
                <option value="pending_payment">Pending Payment</option>
                <option value="payment_verifying">Payment Verifying</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="collected" disabled={!isCodeVerified}>Collected</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
                <option value="payment_mismatch">Payment Mismatch</option>
              </select>
            </div>

            {/* Collected confirmation button */}
            {order.fulfillment_type === 'pickup' && order.order_status !== 'collected' && (
              <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange('collected', { pickupCode: order.pickup_code })}
                  disabled={isUpdatingStatus}
                  className="w-full bg-green-650 hover:bg-green-700 text-white py-3.5 font-bold uppercase tracking-widest text-[11px] transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer rounded-md"
                >
                  {isUpdatingStatus ? 'Updating Status...' : 'Confirm & Mark Collected'}
                </button>
              </div>
            )}

            {(order.order_status === 'delivered' || order.order_status === 'collected' || order.order_status === 'cancelled') && (
              <p className="text-[10px] text-zinc-650 bg-zinc-50 p-2.5 rounded leading-normal border border-zinc-200">
                This order is in a final state (<strong>{order.order_status}</strong>). Workflow updates are locked.
              </p>
            )}
          </div>

          {/* Customer Details */}
          <div className="bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 md:p-8 space-y-5">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-100 pb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-red" />
              Customer Details
            </h2>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-zinc-500 block uppercase tracking-wider text-[10px] font-bold">Full Name</span>
                <span className="text-zinc-900 font-bold block mt-0.5">{order.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-zinc-550 flex-shrink-0" />
                <span className="text-zinc-700 font-medium truncate">{order.customer_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-zinc-550 flex-shrink-0" />
                <span className="text-zinc-700 font-mono font-medium">{order.customer_phone}</span>
              </div>
              {order.payment_type === 'cod_with_deposit' && order.verified_phone && (
                <div className="pt-2 border-t border-zinc-100 mt-2 space-y-1 bg-zinc-50 border border-zinc-200 p-2.5 rounded">
                  <span className="text-[10px] text-green-700 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> OTP Verified Mobile
                  </span>
                  <span className="text-zinc-900 font-mono font-bold">{order.verified_phone}</span>
                </div>
              )}
            </div>

            {/* Shipping / Collection Details */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 block uppercase tracking-wider text-[10px] font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-650" />
                  {order.fulfillment_type === 'pickup' ? 'Collection Point' : 'Shipping Address'}
                </span>
                {order.fulfillment_type !== 'pickup' && (
                  <button
                    onClick={copyToClipboard}
                    className="text-zinc-600 hover:text-zinc-900 text-[10px] uppercase font-bold tracking-widest border border-zinc-200 hover:border-zinc-300 bg-zinc-50 px-2 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-green-600" /> : <Clipboard className="w-3 h-3" />}
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              
              <div className="text-xs bg-zinc-50 border border-zinc-200 p-4 rounded text-zinc-700 space-y-1.5 leading-relaxed">
                {order.fulfillment_type === 'pickup' ? (
                  <>
                    <p className="font-bold text-zinc-900">📍 YELAHANKA STORE PICKUP</p>
                    <p>DRFTN Store</p>
                    <p>1st Floor, Kogilu Main Rd, above Sri Venkateshwar Vaibhava Veg Hotel, K B Sandra, Maruthi Nagar, Yelahanka, Bengaluru, KA - 560064</p>
                    <p className="font-mono text-zinc-500 mt-2">📞 {order.customer_phone}</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-zinc-900">{order.customer_name}</p>
                    <p>{orderAddress?.line1}</p>
                    {orderAddress?.line2 && <p>{orderAddress.line2}</p>}
                    <p>{orderAddress?.city}, {orderAddress?.state} - {orderAddress?.pincode}</p>
                    <p className="font-mono text-zinc-500 mt-1">{order.customer_phone}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white border border-zinc-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 md:p-8 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-100 pb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-red" />
              Payment Information
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 block font-bold">Payment Status</span>
                <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${
                  order.payment_status === 'paid' ? 'bg-green-500/10 text-green-700' : 'bg-yellow-500/10 text-yellow-700'
                }`}>
                  {order.payment_status}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1.5 border-t border-zinc-100">
                <span className="text-zinc-500 block font-bold">Payment Type</span>
                <span className="font-bold text-zinc-900 uppercase tracking-wider">
                  {order.payment_type === 'cod_with_deposit' ? 'COD + Deposit' : 'Prepaid (Full)'}
                </span>
              </div>

              {order.payment_type === 'cod_with_deposit' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 block font-bold">Paid Deposit</span>
                    <span className="font-bold text-green-700 font-mono">₹200.00</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-amber-50 border border-amber-200 rounded">
                    <span className="text-amber-800 block font-bold uppercase tracking-wider text-[9px]">Remaining cash due</span>
                    <span className="font-extrabold text-amber-700 font-mono text-sm">
                      ₹{(((order.remaining_amount || 0)) / 100).toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              {order.payment_id && (
                <div>
                  <span className="text-zinc-500 block font-mono">Razorpay Payment ID</span>
                  <span className="font-mono font-bold text-zinc-900 block mt-0.5 truncate">{order.payment_id}</span>
                </div>
              )}

              {order.razorpay_order_id && (
                <div>
                  <span className="text-zinc-500 block font-mono">Razorpay Order ID</span>
                  <span className="font-mono font-bold text-zinc-900 block mt-0.5 truncate">{order.razorpay_order_id}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
