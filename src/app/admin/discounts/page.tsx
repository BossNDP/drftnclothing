'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { DiscountCode } from '@/types';
import { Plus, CheckCircle2, XCircle, Search, Trash2, X, Tag } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { DriftModeAdminCard } from '@/components/DriftModeAdminCard';

export default function AdminDiscounts() {
  const { addToast } = useToast();
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create Coupon Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    discount_type: 'percent' as 'percent' | 'flat',
    discount_value: '',
    min_order_value: '',
    usage_limit: '',
    expires_at: '',
    is_active: true,
  });

  const fetchDiscounts = async () => {
    try {
      const data = await db.getDiscountCodes();
      setDiscounts(data);
    } catch (err) {
      console.error(err);
      addToast('Failed to load discount codes', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDiscountActive = async (discount: DiscountCode) => {
    try {
      await db.updateDiscountCode(discount.id, { is_active: !discount.is_active });
      addToast(`${discount.code} is now ${!discount.is_active ? 'Active' : 'Inactive'}`, 'success');
      fetchDiscounts();
    } catch (error) {
      addToast('Failed to update discount', 'error');
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete promo code "${code}"?`)) return;
    try {
      await db.deleteDiscountCode(id);
      addToast(`Promo code "${code}" deleted successfully`, 'success');
      fetchDiscounts();
    } catch (error) {
      console.error(error);
      addToast('Failed to delete discount code', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.code || !newCode.discount_value) {
      addToast('Please enter both code and discount value', 'error');
      return;
    }

    try {
      const val = Number(newCode.discount_value);
      const minVal = newCode.min_order_value ? Number(newCode.min_order_value) : 0;
      
      // Convert values to paise: flat values and min order values are stored in paise
      const payload = {
        code: newCode.code.toUpperCase().trim(),
        discount_type: newCode.discount_type,
        discount_value: newCode.discount_type === 'flat' ? Math.round(val * 100) : val,
        min_order_value: Math.round(minVal * 100),
        usage_limit: newCode.usage_limit ? Number(newCode.usage_limit) : undefined,
        is_active: newCode.is_active,
        expires_at: newCode.expires_at || undefined,
      };

      await db.createDiscountCode(payload);
      addToast('Promo code created successfully', 'success');
      setIsCreateOpen(false);
      setNewCode({
        code: '',
        discount_type: 'percent',
        discount_value: '',
        min_order_value: '',
        usage_limit: '',
        expires_at: '',
        is_active: true,
      });
      fetchDiscounts();
    } catch (error) {
      console.error(error);
      addToast('Failed to create discount code', 'error');
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    !d.code.startsWith('DRIFT') && d.code !== 'DRFTNMODEON20' && d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest uppercase text-zinc-900">Discount Codes</h1>
          <p className="text-zinc-500 text-sm mt-1">Create and manage promotional codes and storewide sales.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="bg-zinc-900 hover:bg-zinc-700 text-white px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Create Custom Code
        </button>
      </div>

      {/* Storewide Drift Mode Sale Controls */}
      <DriftModeAdminCard />

      <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-50/50 border border-zinc-200 text-zinc-900 pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg uppercase"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Loading discount codes...</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Code</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Value</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Min. Order</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Usage</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Expires</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500 text-sm">No discount codes found.</td>
                  </tr>
                ) : (
                  filteredDiscounts.map(discount => (
                    <tr key={discount.id} className="border-b border-zinc-100 hover:bg-zinc-50/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-zinc-900">
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-zinc-400" />
                          {discount.code}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-zinc-900 font-semibold">
                        {discount.discount_type === 'percent' 
                          ? `${discount.discount_value}%` 
                          : `₹${(discount.discount_value / 100).toFixed(2)}`
                        } OFF
                      </td>
                      <td className="p-4 font-mono text-sm text-zinc-600">
                        {discount.min_order_value > 0 
                          ? `₹${(discount.min_order_value / 100).toFixed(2)}` 
                          : 'None'
                        }
                      </td>
                      <td className="p-4 text-sm text-zinc-600">
                        {discount.used_count} {discount.usage_limit ? `/ ${discount.usage_limit}` : 'used'}
                      </td>
                      <td className="p-4 text-sm text-zinc-600">
                        {discount.expires_at 
                          ? new Date(discount.expires_at).toLocaleDateString() 
                          : 'Never'
                        }
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => toggleDiscountActive(discount)}
                          className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                          discount.is_active ? 'bg-green-50 text-green-600 border border-green-100 hover:bg-green-100' : 'bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200'
                        }`}>
                          {discount.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {discount.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(discount.id, discount.code)}
                          className="p-2 text-zinc-500 hover:text-red-600 transition-colors border border-zinc-200 hover:border-red-200 rounded bg-white"
                          title="Delete Coupon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE DISCOUNT SIDE DRAWER MODAL */}
      {isCreateOpen && (
        <>
          <div
            onClick={() => setIsCreateOpen(false)}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm transition-opacity"
          />
          <div className="fixed top-0 bottom-0 right-0 max-w-md w-full z-50 bg-brand-black border-l border-zinc-900 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-350 shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-brand-offwhite flex items-center gap-2">
                  <Tag className="w-4 h-4 text-brand-red" />
                  Create Discount Code
                </h3>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 text-zinc-500 hover:text-brand-red transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-5 text-left">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Coupon Code</label>
                  <input
                    type="text"
                    placeholder="e.g. BLRSTREET"
                    value={newCode.code}
                    onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                    className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-brand-red uppercase tracking-wider font-bold"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Discount Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setNewCode({ ...newCode, discount_type: 'percent' })}
                      className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border text-center transition-all ${
                        newCode.discount_type === 'percent'
                          ? 'bg-brand-offwhite text-brand-black border-brand-offwhite'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCode({ ...newCode, discount_type: 'flat' })}
                      className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border text-center transition-all ${
                        newCode.discount_type === 'flat'
                          ? 'bg-brand-offwhite text-brand-black border-brand-offwhite'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      Flat Rate (₹)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">
                    Discount Value {newCode.discount_type === 'percent' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    placeholder={newCode.discount_type === 'percent' ? '10' : '250'}
                    value={newCode.discount_value}
                    onChange={(e) => setNewCode({ ...newCode, discount_value: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-brand-red font-mono"
                    required
                    min="1"
                    max={newCode.discount_type === 'percent' ? 100 : undefined}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Minimum Order Value (₹)</label>
                  <input
                    type="number"
                    placeholder="999 (0 for no limit)"
                    value={newCode.min_order_value}
                    onChange={(e) => setNewCode({ ...newCode, min_order_value: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-brand-red font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Usage Limit (Total times)</label>
                  <input
                    type="number"
                    placeholder="Blank for unlimited"
                    value={newCode.usage_limit}
                    onChange={(e) => setNewCode({ ...newCode, usage_limit: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-brand-red font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Expiry Date</label>
                  <input
                    type="date"
                    value={newCode.expires_at}
                    onChange={(e) => setNewCode({ ...newCode, expires_at: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-brand-red"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={newCode.is_active}
                    onChange={(e) => setNewCode({ ...newCode, is_active: e.target.checked })}
                    className="rounded border-zinc-800 bg-zinc-950 text-white focus:ring-white"
                  />
                  <label htmlFor="is_active" className="text-xs uppercase tracking-wider text-zinc-400 font-bold select-none cursor-pointer">
                    Enable Code Immediately
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-white hover:bg-zinc-200 text-black py-4 font-bold uppercase tracking-widest text-xs transition-colors mt-4"
                >
                  Create Code
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
