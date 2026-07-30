'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { StoreSettings } from '@/types';
import { Save, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';

export default function AdminSettings() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [envStatus, setEnvStatus] = useState({
    razorpay: false,
    shiprocket: false,
    makeWebhook: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      // Hits /api/admin/settings via client-side fetch router in db.ts
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        // Since we are storing values in paise, we convert free shipping threshold and shipping charges to Rupees for easy editing in the admin UI
        setSettings({
          ...data.settings,
          free_shipping_threshold: data.settings.free_shipping_threshold / 100,
          default_shipping_charge: data.settings.default_shipping_charge / 100,
          borzo_surcharge: data.settings.borzo_surcharge / 100,
          borzo_free_threshold: data.settings.borzo_free_threshold / 100,
        });
        if (data.envStatus) {
          setEnvStatus(data.envStatus);
        }
      } else {
        throw new Error('Failed to load settings');
      }
    } catch (error) {
      console.error(error);
      addToast('Failed to load settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    const { name, value, type } = e.target;
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: type === 'number' ? Number(value) : value,
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    
    setIsSaving(true);
    try {
      // Convert values back to paise before saving to database
      const payload = {
        ...settings,
        free_shipping_threshold: Math.round(settings.free_shipping_threshold * 100),
        default_shipping_charge: Math.round(settings.default_shipping_charge * 100),
        borzo_surcharge: Math.round(settings.borzo_surcharge * 100),
        borzo_free_threshold: Math.round(settings.borzo_free_threshold * 100),
      };
      
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save settings');
      
      addToast('Settings updated successfully', 'success');
      fetchSettings();
    } catch (error) {
      console.error(error);
      addToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) {
    return <div className="p-8 text-zinc-500 font-bold uppercase tracking-widest text-sm animate-pulse">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest uppercase text-zinc-900">Store Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Configure global store preferences and verify credentials.</p>
        </div>
      </div>

      {/* Environment Variables Status Dashboard */}
      <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 md:p-8">
        <h2 className="text-sm font-bold text-zinc-900 mb-6 uppercase tracking-widest border-b border-zinc-100 pb-3">
          Environment Connection Dashboard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Razorpay Status */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-400 block font-bold">Razorpay Gateway</span>
              <span className="text-sm font-bold block mt-1 text-zinc-900">Prepaid Payments</span>
            </div>
            {envStatus.razorpay ? (
              <div className="flex items-center gap-1 text-green-600 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-500 text-xs font-bold uppercase tracking-wider">
                <XCircle className="w-4 h-4" /> Unconfigured
              </div>
            )}
          </div>

          {/* Shiprocket Status */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-400 block font-bold">Shiprocket Logistics</span>
              <span className="text-sm font-bold block mt-1 text-zinc-900">Automatic Shipping</span>
            </div>
            {envStatus.shiprocket ? (
              <div className="flex items-center gap-1 text-green-600 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-500 text-xs font-bold uppercase tracking-wider">
                <XCircle className="w-4 h-4" /> Unconfigured
              </div>
            )}
          </div>

          {/* Make.com Status */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-400 block font-bold">Make Webhook URL</span>
              <span className="text-sm font-bold block mt-1 text-zinc-900">WhatsApp Alerts</span>
            </div>
            {envStatus.makeWebhook ? (
              <div className="flex items-center gap-1 text-green-600 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-500 text-xs font-bold uppercase tracking-wider">
                <XCircle className="w-4 h-4" /> Unconfigured
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Maintenance Mode Toggle Card */}
      <div className={`border rounded-[16px] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all mb-8 ${
        String(settings.maintenance_mode) === 'true'
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-white border-zinc-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-900 uppercase tracking-wider">Maintenance Mode</h2>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
              String(settings.maintenance_mode) === 'true' ? 'bg-amber-500 text-black' : 'bg-zinc-200 text-zinc-700'
            }`}>
              {String(settings.maintenance_mode) === 'true' ? 'ACTIVE (ON)' : 'INACTIVE (OFF)'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            When active, all customer-facing routes show an &quot;Under Construction&quot; page and block orders. Admin pages and login remain 100% accessible.
          </p>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={async () => {
            const nextVal = String(settings.maintenance_mode) !== 'true';
            setIsSaving(true);
            try {
              const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maintenance_mode: String(nextVal) }),
              });
              if (!res.ok) throw new Error('Failed to update maintenance mode');
              setSettings((prev) => prev ? { ...prev, maintenance_mode: String(nextVal) } : prev);
              addToast(`Maintenance mode turned ${nextVal ? 'ON' : 'OFF'}`, 'success');
            } catch (err: any) {
              addToast(err.message || 'Failed to update maintenance mode', 'error');
            } finally {
              setIsSaving(false);
            }
          }}
          className={`px-6 py-3 font-bold uppercase tracking-widest text-xs rounded-lg transition-colors cursor-pointer shrink-0 ${
            String(settings.maintenance_mode) === 'true'
              ? 'bg-amber-500 hover:bg-amber-600 text-black font-extrabold'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white'
          }`}
        >
          {String(settings.maintenance_mode) === 'true' ? 'Turn Maintenance Mode OFF' : 'Turn Maintenance Mode ON'}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* General Details */}
        <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 md:p-8">
          <h2 className="text-lg font-bold text-zinc-900 mb-6 uppercase tracking-wider border-b border-zinc-100 pb-2">General Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Store Name</label>
              <input
                type="text"
                name="store_name"
                value={settings.store_name}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Contact WhatsApp Number</label>
              <input
                type="text"
                name="contact_number"
                value={settings.contact_number}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Instagram Handle</label>
              <input
                type="text"
                name="instagram_handle"
                value={settings.instagram_handle}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Shipping Preferences */}
        <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 md:p-8">
          <h2 className="text-lg font-bold text-zinc-900 mb-6 uppercase tracking-wider border-b border-zinc-100 pb-2">Shipping Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Free Shipping Threshold (₹)</label>
              <input
                type="number"
                name="free_shipping_threshold"
                value={settings.free_shipping_threshold}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Default Shipping Charge (₹)</label>
              <input
                type="number"
                name="default_shipping_charge"
                value={settings.default_shipping_charge}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Express Delivery Settings (Borzo) */}
        <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 md:p-8">
          <h2 className="text-lg font-bold text-zinc-900 mb-6 uppercase tracking-wider border-b border-zinc-100 pb-2">Express Delivery Settings (Borzo)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Bangalore Express Pincodes</label>
              <input
                type="text"
                name="blr_pincode_ranges"
                value={settings.blr_pincode_ranges}
                onChange={handleChange}
                placeholder="e.g. 560001-560300"
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Express Surcharge (₹)</label>
              <input
                type="number"
                name="borzo_surcharge"
                value={settings.borzo_surcharge}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Free Express Threshold (₹)</label>
              <input
                type="number"
                name="borzo_free_threshold"
                value={settings.borzo_free_threshold}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Same-Day Cutoff Start Time (HH:MM)</label>
              <input
                type="text"
                name="borzo_cutoff_start"
                value={settings.borzo_cutoff_start}
                onChange={handleChange}
                placeholder="11:00"
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Same-Day Cutoff End Time (HH:MM)</label>
              <input
                type="text"
                name="borzo_cutoff_end"
                value={settings.borzo_cutoff_end}
                onChange={handleChange}
                placeholder="16:00"
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg font-mono"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Borzo Pickup Address</label>
              <input
                type="text"
                name="borzo_pickup_address"
                value={settings.borzo_pickup_address}
                onChange={handleChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-zinc-900 hover:bg-zinc-700 text-white px-8 py-4 font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer rounded-lg"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
            {!isSaving && <Save className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
