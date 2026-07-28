'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Send, Users, Package, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, Smartphone, ShoppingBag } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { dbService } from '@/lib/db';
import { Product } from '@/types';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  url: string | null;
  audience_type: 'general' | 'product';
  product_id: string | null;
  sent_count: number;
  failed_count: number;
  sent_at: string;
}

type AudienceType = 'general' | 'product';

export default function AdminNotificationsPage() {
  const { addToast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>('general');
  const [selectedProductId, setSelectedProductId] = useState('');

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [result, setResult] = useState<{ successful: number; failed: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isOrderAlertEnabled, setIsOrderAlertEnabled] = useState(false);
  const [isTogglingOrderAlert, setIsTogglingOrderAlert] = useState(false);

  // Check browser notification status on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      return;
    }
    setBrowserPermission(Notification.permission);

    // Check if SW already has an active push subscription
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
          // Order alert is enabled as long as this browser has any active general subscription
          setIsOrderAlertEnabled(!!sub);
        });
      }).catch(() => {});
    }
  }, []);

  // Load products and logs on mount
  useEffect(() => {
    async function init() {
      try {
        const [prods, logsRes] = await Promise.all([
          dbService.getAllProducts(),
          fetch('/api/admin/push/logs').then((r) => r.json()),
        ]);
        setProducts(prods);
        setLogs(logsRes.logs ?? []);
      } catch (err) {
        console.error(err);
        addToast('Failed to load data', 'error');
      } finally {
        setIsLoadingLogs(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch subscriber count whenever audience changes
  const fetchCount = useCallback(async () => {
    setSubscriberCount(null);
    setIsLoadingCount(true);
    try {
      let url = '';
      if (audienceType === 'general') {
        url = '/api/admin/push/announce-drop';
      } else if (audienceType === 'product' && selectedProductId) {
        url = `/api/admin/push/announce-product?productId=${selectedProductId}`;
      } else {
        setIsLoadingCount(false);
        return;
      }
      const res = await fetch(url);
      const data = await res.json();
      setSubscriberCount(data.count ?? 0);
    } catch {
      setSubscriberCount(0);
    } finally {
      setIsLoadingCount(false);
    }
  }, [audienceType, selectedProductId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const refreshLogs = async () => {
    const res = await fetch('/api/admin/push/logs');
    const data = await res.json();
    setLogs(data.logs ?? []);
  };

  const handleSubscribeThisBrowser = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      addToast('Push notifications are not supported in this browser', 'error');
      return;
    }
    try {
      setIsSubscribing(true);
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission !== 'granted') {
        addToast('Permission denied. Enable notifications in browser settings.', 'error');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const rawKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!rawKey) {
        throw new Error('VAPID public key not configured');
      }
      const { urlBase64ToUint8Array } = await import('@/lib/vapid');
      const applicationServerKey = urlBase64ToUint8Array(rawKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.toJSON().keys?.p256dh, auth: subscription.toJSON().keys?.auth },
          productId: null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save subscription');

      localStorage.setItem('push_alerts_subscribed', 'true');
      window.dispatchEvent(new Event('push-subscription-changed'));

      setIsSubscribed(true);
      setIsOrderAlertEnabled(true);
      addToast('This browser is now subscribed! Subscriber count will update.', 'success');
      await fetchCount();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Subscription failed', 'error');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendClick = () => {
    if (!title.trim() || !body.trim()) {
      addToast('Title and body are required', 'error');
      return;
    }
    if (audienceType === 'product' && !selectedProductId) {
      addToast('Please select a product', 'error');
      return;
    }
    if (!subscriberCount) {
      addToast('No subscribers in this audience', 'error');
      return;
    }
    setConfirming(true);
  };

  const handleConfirmedSend = async () => {
    setConfirming(false);
    setIsSending(true);
    setResult(null);
    try {
      const endpoint =
        audienceType === 'general'
          ? '/api/admin/push/announce-drop'
          : '/api/admin/push/announce-product';

      const payload: Record<string, string> = {
        title: title.trim(),
        body: body.trim(),
        url: targetUrl.trim() || '/',
      };
      if (audienceType === 'product') {
        payload.productId = selectedProductId;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');

      setResult({ successful: data.successful ?? 0, failed: data.failed ?? 0 });
      addToast(`Sent to ${data.successful} subscribers!`, 'success');

      // Clear form
      setTitle('');
      setBody('');
      setTargetUrl('');

      // Refresh logs and count
      await Promise.all([refreshLogs(), fetchCount()]);
    } catch (err: any) {
      addToast(err.message || 'Failed to send notification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="space-y-6 animate-fade-in text-zinc-900">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest uppercase text-zinc-900">
            Push Notifications
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Broadcast drop alerts and back-in-stock notifications to subscribers.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold tracking-widest uppercase">
          <Bell className="w-3.5 h-3.5" />
          Notification Composer
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === LEFT: Composer Form === */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-800 mb-5 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Compose Message
            </h2>

            {/* Title */}
            <div className="space-y-1 mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                Notification Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New Drop: Stitch Hoodie — Limited Run"
                maxLength={80}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
              />
              <p className="text-[10px] text-zinc-400 text-right">{title.length}/80</p>
            </div>

            {/* Body */}
            <div className="space-y-1 mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                Message Body *
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="e.g. Only 50 units. Grab it before it's gone."
                rows={3}
                maxLength={200}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition resize-none"
              />
              <p className="text-[10px] text-zinc-400 text-right">{body.length}/200</p>
            </div>

            {/* Target URL */}
            <div className="space-y-1 mb-6">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                Target URL (on notification click)
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://drftn.in/shop (leave blank for homepage)"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
              />
            </div>

            {/* Audience Selector */}
            <div className="space-y-3 mb-6">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">
                Audience *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* General drop subscribers */}
                <label
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    audienceType === 'general'
                      ? 'border-zinc-900 bg-zinc-50 shadow-sm'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="audience"
                    value="general"
                    checked={audienceType === 'general'}
                    onChange={() => { setAudienceType('general'); setSelectedProductId(''); }}
                    className="mt-0.5 accent-zinc-900"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-800">
                      <Users className="w-3.5 h-3.5" />
                      General Drop Subscribers
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      All users who opted in for new drop alerts
                    </p>
                  </div>
                </label>

                {/* Product-specific subscribers */}
                <label
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    audienceType === 'product'
                      ? 'border-zinc-900 bg-zinc-50 shadow-sm'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="audience"
                    value="product"
                    checked={audienceType === 'product'}
                    onChange={() => setAudienceType('product')}
                    className="mt-0.5 accent-zinc-900"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-800">
                      <Package className="w-3.5 h-3.5" />
                      Back-in-Stock Subscribers
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Users waiting for a specific product
                    </p>
                  </div>
                </label>
              </div>

              {/* Product dropdown */}
              {audienceType === 'product' && (
                <div className="relative">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full appearance-none border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition pr-8"
                  >
                    <option value="">— Select a product —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Send Button + Result */}
            <div className="space-y-3">
              {!confirming ? (
                <button
                  onClick={handleSendClick}
                  disabled={isSending || !title.trim() || !body.trim()}
                  className="w-full bg-zinc-900 text-white py-3 font-bold uppercase tracking-widest text-xs hover:bg-zinc-700 transition-colors rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? 'Sending...' : 'Send Notification'}
                </button>
              ) : (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">
                        Send to {subscriberCount?.toLocaleString()} subscriber{subscriberCount !== 1 ? 's' : ''}?
                      </p>
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        <strong>{title}</strong> — {body}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmedSend}
                      className="flex-1 bg-zinc-900 text-white py-2 font-bold uppercase tracking-widest text-xs hover:bg-zinc-700 transition-colors rounded-lg"
                    >
                      Confirm Send
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="flex-1 border border-zinc-200 text-zinc-600 py-2 font-bold uppercase tracking-widest text-xs hover:bg-zinc-50 transition-colors rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {result && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold text-emerald-800">
                    Sent to {result.successful} subscribers
                    {result.failed > 0 && (
                      <span className="text-amber-600 font-normal ml-1">
                        ({result.failed} failed — stale subscriptions removed)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === RIGHT: Audience Reach Panel === */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-800 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Audience Reach
            </h2>
            <div className="text-center py-6">
              {isLoadingCount ? (
                <div className="space-y-2">
                  <div className="h-10 w-20 bg-zinc-100 rounded animate-pulse mx-auto" />
                  <div className="h-3 w-28 bg-zinc-100 rounded animate-pulse mx-auto" />
                </div>
              ) : (
                <>
                  <p className="text-5xl font-black text-zinc-900 tabular-nums">
                    {subscriberCount?.toLocaleString() ?? '—'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-2 uppercase tracking-widest font-bold">
                    {audienceType === 'general'
                      ? 'General drop subscribers'
                      : selectedProductId
                      ? `Waiting for ${selectedProduct?.name ?? 'this product'}`
                      : 'Select a product to see count'}
                  </p>
                </>
              )}
            </div>
            {subscriberCount === 0 && !isLoadingCount && (
              <p className="text-[11px] text-zinc-400 text-center border-t border-zinc-100 pt-4 mt-2">
                No subscribers in this audience yet. Subscribers opt in via the website prompt or a sold-out product page.
              </p>
            )}
          </div>

          {/* Subscribe This Browser panel */}
          <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-5 space-y-3">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              Subscribe This Browser
            </h3>

            {/* Permission status badge */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                browserPermission === 'granted' ? 'bg-emerald-500' :
                browserPermission === 'denied' ? 'bg-red-500' : 'bg-amber-400'
              }`} />
              <span className="text-xs text-zinc-600 font-medium">
                {browserPermission === 'granted'
                  ? isSubscribed ? 'Subscribed & ready to receive' : 'Permission granted — not yet subscribed'
                  : browserPermission === 'denied'
                  ? 'Blocked — enable in browser settings'
                  : browserPermission === 'unsupported'
                  ? 'Not supported in this browser'
                  : 'Permission not yet requested'}
              </span>
            </div>

            {browserPermission === 'denied' && (
              <p className="text-[10px] text-red-500 bg-red-50 border border-red-100 rounded p-2">
                Go to browser Settings → Privacy → Notifications and allow this site.
              </p>
            )}

            {browserPermission !== 'denied' && browserPermission !== 'unsupported' && !isSubscribed && (
              <button
                onClick={handleSubscribeThisBrowser}
                disabled={isSubscribing}
                className="w-full border border-zinc-900 text-zinc-900 py-2.5 font-bold uppercase tracking-widest text-xs hover:bg-zinc-900 hover:text-white transition-colors rounded-lg flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Bell className="w-3.5 h-3.5" />
                {isSubscribing ? 'Subscribing...' : 'Subscribe This Browser'}
              </button>
            )}

            {isSubscribed && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                This browser will receive notifications when you send one above.
              </div>
            )}

            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Use this to test — subscribe here, then send a notification. It will appear as a desktop OS notification in your top-right corner.
            </p>
          </div>

          {/* Order Alerts Toggle */}
          <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-5 space-y-3">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              Order Alerts
            </h3>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Receive an instant push notification on this device every time a new order is placed — including COD pre-orders.
            </p>

            {browserPermission === 'unsupported' ? (
              <p className="text-[10px] text-zinc-400 bg-zinc-50 border border-zinc-100 rounded p-2">
                Push notifications are not supported in this browser.
              </p>
            ) : browserPermission === 'denied' ? (
              <p className="text-[10px] text-red-500 bg-red-50 border border-red-100 rounded p-2">
                Notifications blocked. Go to browser Settings → Privacy → Notifications and allow this site, then reload.
              </p>
            ) : isOrderAlertEnabled ? (
              <>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Order alerts active on this device
                </div>
                <button
                  id="admin-order-alerts-toggle"
                  onClick={async () => {
                    try {
                      setIsTogglingOrderAlert(true);
                      if ('serviceWorker' in navigator) {
                        const reg = await navigator.serviceWorker.ready;
                        const sub = await reg.pushManager.getSubscription();
                        if (sub) {
                          await fetch('/api/push/unsubscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ endpoint: sub.endpoint }),
                          });
                          await sub.unsubscribe();
                        }
                      }
                      localStorage.removeItem('push_alerts_subscribed');
                      setIsOrderAlertEnabled(false);
                      setIsSubscribed(false);
                      addToast('Order alerts disabled for this browser.', 'info');
                      await fetchCount();
                    } catch (e: any) {
                      addToast(e.message || 'Failed to unsubscribe', 'error');
                    } finally {
                      setIsTogglingOrderAlert(false);
                    }
                  }}
                  disabled={isTogglingOrderAlert}
                  className="w-full border border-zinc-300 text-zinc-600 py-2.5 font-bold uppercase tracking-widest text-xs hover:bg-zinc-50 transition-colors rounded-lg flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {isTogglingOrderAlert ? 'Disabling...' : 'Disable Order Alerts'}
                </button>
              </>
            ) : (
              <button
                id="admin-order-alerts-toggle"
                onClick={async () => {
                  try {
                    setIsTogglingOrderAlert(true);
                    // Reuse the full subscribe flow
                    await handleSubscribeThisBrowser();
                    setIsOrderAlertEnabled(true);
                  } catch (e: any) {
                    addToast(e.message || 'Failed to enable order alerts', 'error');
                  } finally {
                    setIsTogglingOrderAlert(false);
                  }
                }}
                disabled={isTogglingOrderAlert}
                className="w-full bg-zinc-900 text-white py-2.5 font-bold uppercase tracking-widest text-xs hover:bg-zinc-700 transition-colors rounded-lg flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {isTogglingOrderAlert ? 'Enabling...' : 'Enable Order Alerts'}
              </button>
            )}
          </div>

          {/* Tips card */}
          <div className="bg-zinc-900 text-white rounded-[16px] p-5 space-y-3">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
              Tips
            </h3>
            <ul className="space-y-2 text-xs text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">→</span>
                Keep titles under 60 characters for full visibility on lock screens.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">→</span>
                Use &ldquo;Back-in-Stock&rdquo; audience to only reach fans of a specific sold-out item.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-0.5">→</span>
                Failed sends are auto-removed (expired/revoked browser subscriptions).
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* === Send History === */}
      <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-800">
            Send History
          </h2>
        </div>
        {isLoadingLogs ? (
          <div className="p-8 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-zinc-100 rounded animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-sm">
            No notifications sent yet. Compose your first message above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Title / Body
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hidden md:table-cell">
                    Audience
                  </th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Delivered
                  </th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hidden sm:table-cell">
                    Failed
                  </th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hidden lg:table-cell">
                    Sent At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-zinc-900 text-xs">{log.title}</p>
                      <p className="text-zinc-500 text-[11px] mt-0.5 truncate max-w-xs">{log.body}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.audience_type === 'general'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {log.audience_type === 'general' ? (
                          <><Users className="w-2.5 h-2.5" /> General</>
                        ) : (
                          <><Package className="w-2.5 h-2.5" /> Product</>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-700 font-bold text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {log.sent_count}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                      {log.failed_count > 0 ? (
                        <div className="flex items-center justify-center gap-1 text-amber-600 font-bold text-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          {log.failed_count}
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                      <span className="text-[11px] text-zinc-400">
                        {new Date(log.sent_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
