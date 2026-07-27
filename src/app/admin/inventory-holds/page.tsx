'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Clock, ShieldAlert, RefreshCw, Trash2, Loader2, CheckCircle2, User } from 'lucide-react';
import { toast } from '@/lib/toast';

interface HoldItem {
  productId: string;
  name: string;
  image: string;
  size: string;
  quantity: number;
  price: number;
}

interface ActiveHold {
  holdId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  secondsRemaining: number;
  extended: boolean;
  items: HoldItem[];
}

export default function AdminInventoryHoldsPage() {
  const [loading, setLoading] = useState(true);
  const [holds, setHolds] = useState<ActiveHold[]>([]);

  const fetchHolds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout/reserve');
      if (res.ok) {
        const data = await res.json();
        setHolds(data.holds || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory holds:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolds();
    const interval = setInterval(fetchHolds, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchHolds]);

  const handleForceRelease = async (holdId: string) => {
    if (!confirm('Are you sure you want to force-release this checkout inventory hold?')) return;
    try {
      const res = await fetch('/api/checkout/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_release', holdId }),
      });
      if (res.ok) {
        toast.success('Hold released successfully');
        fetchHolds();
      }
    } catch (err) {
      toast.error('Failed to release hold');
    }
  };

  const totalReservedUnits = holds.reduce(
    (acc, h) => acc + h.items.reduce((sum, item) => sum + item.quantity, 0),
    0
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-500" />
            <h1 className="text-2xl font-display font-black uppercase text-zinc-900 tracking-tight">
              Active Checkout Inventory Holds
            </h1>
          </div>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Real-time Redis TTL reservation holds created during active checkout sessions (Max 5–8 minutes)
          </p>
        </div>

        <button
          onClick={fetchHolds}
          className="h-9 px-3 bg-white border border-zinc-200 hover:border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-700 flex items-center gap-1.5 shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Holds</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-zinc-400 uppercase">Active Reservations</div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">{holds.length} Sessions</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Locks expire via Redis TTL</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-zinc-400 uppercase">Reserved Garment Units</div>
          <div className="text-2xl font-extrabold text-zinc-900 mt-1">{totalReservedUnits} Units</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Temporarily held during checkout</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-zinc-400 uppercase">Average Checkout TTL</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">5:00 Mins</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Auto-extended +3m on payment</div>
        </div>
      </div>

      {/* Holds Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono font-bold uppercase text-zinc-900">
            Active Holds ({holds.length})
          </h3>
          <span className="text-[10px] font-mono text-zinc-400 uppercase">
            Auto-refreshes every 10s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-[10px] font-bold uppercase text-zinc-400 bg-zinc-50">
                <th className="py-3 px-4">Hold ID</th>
                <th className="py-3 px-4">User / Session</th>
                <th className="py-3 px-4">Reserved Items</th>
                <th className="py-3 px-4">Remaining TTL</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <span>Loading active inventory holds...</span>
                  </td>
                </tr>
              ) : holds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    No active inventory holds currently active in Redis.
                  </td>
                </tr>
              ) : (
                holds.map((hold) => {
                  const mins = Math.floor(hold.secondsRemaining / 60);
                  const secs = hold.secondsRemaining % 60;
                  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                  return (
                    <tr key={hold.holdId} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-zinc-900">{hold.holdId}</td>
                      <td className="py-3 px-4 text-zinc-600">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{hold.userId.slice(0, 16)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {hold.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              {item.image && (
                                <div className="relative w-6 h-7 rounded overflow-hidden shrink-0 border">
                                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                                </div>
                              )}
                              <span className="font-bold text-zinc-800">{item.name}</span>
                              <span className="text-[10px] text-zinc-500">
                                (Size {item.size} × {item.quantity})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded font-bold ${
                          hold.secondsRemaining < 60 ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          ⏱️ {timeFormatted}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {hold.extended ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                            +3m Extended (Payment Open)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                            5m Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleForceRelease(hold.holdId)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase transition-colors"
                        >
                          Force Release
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
