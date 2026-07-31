'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { Order, Product } from '@/types';
import { IndianRupee, ShoppingBag, Package, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import Link from 'next/link';
import { DriftModeAdminCard } from '@/components/DriftModeAdminCard';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [activeUsers, setActiveUsers] = useState<{ id: string; name: string; email: string | null; phone: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedOrders, fetchedProducts, activeUsersRes] = await Promise.all([
          db.getOrders(),
          db.getProducts(),
          fetch('/api/admin/users/active').then(res => res.json()).catch(() => ({ success: false }))
        ]);
        setOrders(fetchedOrders);
        setProducts(fetchedProducts);
        if (activeUsersRes && activeUsersRes.success) {
          setActiveUsersCount(activeUsersRes.count);
          setActiveUsers(activeUsersRes.users || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    
    // Refresh active users every 30 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/users/active');
        const data = await res.json();
        if (res.ok && data.success) {
          setActiveUsersCount(data.count);
          setActiveUsers(data.users || []);
        }
      } catch (e) {
        console.error('Failed to poll active users:', e);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div className="p-8 text-zinc-400 font-bold uppercase tracking-widest text-sm animate-pulse">Loading Dashboard...</div>;
  }

  // Calculate Metrics
  const totalRevenue = orders.filter(o => o.payment_status === 'paid').reduce((acc, curr) => acc + curr.total, 0);
  const totalOrders = orders.length;
  const recentOrders = orders.slice(0, 5);

  // Find low stock items (any size <= 2)
  const lowStockItems = products.filter(p => {
    return Object.values(p.stock_quantity).some(qty => qty <= 2);
  });

  return (
    <div className="space-y-8 animate-fade-in text-zinc-900">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest uppercase text-zinc-900">Dashboard Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">Welcome back. Here&apos;s what&apos;s happening with your store.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-zinc-200/60 p-6 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Revenue</h3>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-brand-red" />
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-zinc-900">₹{(totalRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white border border-zinc-200/60 p-6 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Orders</h3>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-brand-red" />
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-zinc-900">{totalOrders}</p>
        </div>

        <div className="bg-white border border-zinc-200/60 p-6 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Active Products</h3>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-brand-red" />
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-zinc-900">{products.filter(p => p.is_active).length}</p>
        </div>

        <div className="bg-white border border-zinc-200/60 p-6 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Avg. Order Value</h3>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-brand-red" />
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-zinc-900">
            ₹{totalOrders > 0 ? ((totalRevenue / totalOrders) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </p>
        </div>

        <div className="bg-white border border-zinc-200/60 p-6 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Online Users</h3>
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center relative">
              <span className="absolute w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
              <span className="w-2 h-2 rounded-full bg-green-500 relative" />
            </div>
          </div>
          <p className="text-2xl font-mono font-bold text-zinc-900">{activeUsersCount}</p>
        </div>
      </div>

      {/* Drift Mode Admin Card */}
      <DriftModeAdminCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders List */}
        <div className="lg:col-span-2 bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs text-brand-red hover:text-red-600 font-bold uppercase tracking-wider transition-colors">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Order</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Customer</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-zinc-400 text-sm">No recent orders</td>
                  </tr>
                ) : (
                  recentOrders.map(order => (
                    <tr key={order.id} className="border-b border-zinc-100/80 hover:bg-zinc-50/30 transition-colors">
                      <td className="p-4 font-mono text-sm text-zinc-900 font-bold">{order.order_number}</td>
                      <td className="p-4 text-sm text-zinc-600">{order.customer_name}</td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${
                          order.order_status === 'delivered' ? 'bg-green-50 text-green-600 border border-green-100' :
                          order.order_status === 'cancelled' ? 'bg-red-50 text-red-600 border border-red-100' :
                          'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}>
                          {order.order_status}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-sm text-zinc-900 font-bold">₹{(order.total / 100).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">Low Stock Alerts</h2>
          </div>
          <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar bg-zinc-50/20">
            {lowStockItems.length === 0 ? (
              <p className="text-zinc-400 text-sm">All inventory levels are looking good.</p>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} className="flex gap-4 items-center p-3 border border-zinc-100 bg-white rounded-xl shadow-sm">
                  <div className="w-10 h-12 bg-zinc-100 flex-shrink-0 rounded-lg overflow-hidden border border-zinc-100">
                    {item.images[0] && <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{item.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(item.stock_quantity).map(([size, qty]) => {
                        if (qty > 2) return null;
                        return (
                          <span key={size} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">
                            {size}: {qty}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Online Users */}
        <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden mt-6">
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">Active Online Users</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
              {activeUsersCount} Online
            </span>
          </div>
          <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar bg-zinc-50/20">
            {activeUsers.length === 0 ? (
              <p className="text-zinc-400 text-sm">No customers currently online.</p>
            ) : (
              activeUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 border border-zinc-100 bg-white rounded-xl shadow-sm">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-sm font-bold text-zinc-900 truncate">{u.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{u.email || u.phone || 'Anonymous Session'}</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
