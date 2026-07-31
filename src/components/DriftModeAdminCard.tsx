'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Zap } from 'lucide-react';

export const DriftModeAdminCard: React.FC = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [stats, setStats] = useState<{ totalCodes: number; redeemedCodes: number; conversionRate: number }>({
    totalCodes: 0,
    redeemedCodes: 0,
    conversionRate: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const fetchAdminStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/drift-mode/stats', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIsActive(!!data.is_active);
        setDiscountPercent(data.discount_percent || 20);
        setStats(data.stats || { totalCodes: 0, redeemedCodes: 0, conversionRate: 0 });
      }
    } catch (err) {
      console.error('[DriftModeAdminCard] Failed to fetch stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  const handleToggle = async () => {
    const nextActive = !isActive;
    setIsActive(nextActive);
    setIsUpdating(true);

    try {
      await fetch('/api/drift-mode/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: nextActive,
          discount_percent: discountPercent,
        }),
      });
      fetchAdminStats();
    } catch (err) {
      console.error('[DriftModeAdminCard] Toggle failed:', err);
      setIsActive(!nextActive); // Revert
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePercentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const clamped = isNaN(val) ? 20 : Math.min(100, Math.max(1, val));
    setDiscountPercent(clamped);

    try {
      await fetch('/api/drift-mode/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: isActive,
          discount_percent: clamped,
        }),
      });
    } catch (err) {
      console.error('[DriftModeAdminCard] Discount update failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-zinc-200/60 p-6 rounded-[16px] animate-pulse text-zinc-400 text-xs font-mono">
        LOADING DRIFT MODE...
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200/60 p-6 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-mono font-bold text-xs">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold tracking-wider uppercase text-zinc-900">
              Drift Mode — Launch Discount
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">First-order discount pop-up & top banner trigger</p>
          </div>
        </div>

        {/* Custom minimal black/white toggle */}
        <button
          onClick={handleToggle}
          disabled={isUpdating}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
            isActive ? 'bg-black' : 'bg-zinc-200'
          }`}
          aria-label="Toggle Drift Mode"
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
              isActive ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-100 pt-5">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
            Discount Percentage (%)
          </label>
          <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden w-36">
            <input
              type="number"
              min="1"
              max="100"
              value={discountPercent}
              onChange={handlePercentChange}
              className="w-full px-3 py-2 text-sm font-mono font-bold text-zinc-900 bg-white focus:outline-none"
            />
            <span className="bg-zinc-100 px-3 py-2 text-xs font-mono font-bold text-zinc-500 border-l border-zinc-200">
              %
            </span>
          </div>
        </div>

        {/* Live stats */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
            Conversion Performance
          </span>
          <p className="text-xs font-mono font-bold text-zinc-800 tracking-wide">
            {stats.totalCodes} codes generated · {stats.redeemedCodes} redeemed · {stats.conversionRate}% conversion
          </p>
        </div>
      </div>
    </div>
  );
};

export default DriftModeAdminCard;
