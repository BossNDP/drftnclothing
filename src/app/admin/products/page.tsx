'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { Product } from '@/types';
import { Plus, Edit2, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { useRouter } from 'next/navigation';

export default function AdminProducts() {
  const { addToast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkWeightInput, setBulkWeightInput] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleBulkWeightUpdate = async () => {
    if (!bulkWeightInput || isNaN(Number(bulkWeightInput))) {
      return addToast('Please enter a valid weight', 'error');
    }
    const weightVal = Math.round(Number(bulkWeightInput));
    if (weightVal <= 0) {
      return addToast('Weight must be at least 1 gram', 'error');
    }
    setIsUpdatingBulk(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          weight_grams: weightVal,
        }),
      });

      if (!res.ok) throw new Error('Bulk update failed');

      addToast(`Updated weight for ${selectedIds.length} products`, 'success');
      setSelectedIds([]);
      setIsBulkModalOpen(false);
      setBulkWeightInput('');
      fetchProducts();
    } catch (err) {
      console.error(err);
      addToast('Failed to update products', 'error');
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredProducts.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectProduct = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await db.getAllProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      addToast('Failed to load products', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleProductActive = async (product: Product) => {
    if (actionLoadingId) return;
    setActionLoadingId(product.id);
    try {
      await db.updateProduct(product.id, { is_active: !product.is_active });
      addToast(`${product.name} is now ${!product.is_active ? 'Active' : 'Draft'}`, 'success');
      await fetchProducts();
    } catch (error) {
      addToast('Failed to update product', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (actionLoadingId) return;
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    setActionLoadingId(id);
    try {
      await db.deleteProduct(id);
      addToast(`Product "${name}" deleted successfully`, 'success');
      await fetchProducts();
    } catch (error) {
      console.error(error);
      addToast('Failed to delete product', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in text-zinc-900">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest uppercase text-zinc-900">Products</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your catalog, stock levels, and pricing.</p>
        </div>
        <button
          onClick={() => router.push('/admin/products/new')}
          className="bg-zinc-900 text-white px-6 py-3 font-bold uppercase tracking-widest text-xs hover:bg-zinc-800 transition-colors flex items-center gap-2 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      <div className="bg-white border border-zinc-200/60 rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-50/50 border border-zinc-200 text-zinc-900 pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
            />
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">
                {selectedIds.length} Selected
              </span>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] uppercase tracking-widest font-bold px-4 py-2.5 rounded-lg transition-colors shadow-sm"
              >
                Set Weight
              </button>
            </div>
          )}
        </div>

        <div>
          {isLoading ? (
            <div className="p-8 text-center text-zinc-400 text-sm">Loading products...</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/70">
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 w-10">
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        />
                      </th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 w-16">Image</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Details</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Price</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Stock by Size</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-400 text-sm">No products found.</td>
                      </tr>
                    ) : (
                      filteredProducts.map(product => {
                        const totalStock = Object.values(product.stock_quantity).reduce((a, b) => a + b, 0);
                        const isMissingWeight = !product.weight_grams || product.weight_grams === 0;
                        return (
                          <tr key={product.id} className={`border-b border-zinc-100 hover:bg-zinc-50/20 transition-colors ${
                            isMissingWeight ? 'bg-red-50/10 hover:bg-red-50/20' : ''
                          }`}>
                            <td className="p-4 w-10">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(product.id)}
                                onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                              />
                            </td>
                            <td className="p-4">
                              <div className="w-12 h-16 bg-zinc-100 border border-zinc-200 rounded-lg overflow-hidden">
                                {product.images[0] && (
                                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="text-sm font-bold text-zinc-900">{product.name}</p>
                              <p className="text-xs text-zinc-400 uppercase tracking-wider mt-1 font-semibold">
                                {product.category} • {product.gender}
                                {product.weight_grams ? ` • ${product.weight_grams >= 1000 ? `${(product.weight_grams / 1000).toFixed(1)}kg` : `${product.weight_grams}g`}` : ''}
                              </p>
                              {isMissingWeight && (
                                <span className="inline-block mt-1 text-[9px] font-extrabold tracking-widest bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded uppercase">
                                  ⚠️ Missing Weight
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="text-sm font-mono font-bold text-zinc-900">₹{(product.price / 100).toFixed(2)}</div>
                              {product.compare_price && (
                                <div className="text-xs font-mono text-zinc-400 line-through">₹{(product.compare_price / 100).toFixed(2)}</div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1 mb-1">
                                {Object.entries(product.stock_quantity).map(([size, qty]) => (
                                  <span key={size} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                    qty <= 2 
                                      ? 'bg-red-50 text-red-500 border-red-100' 
                                      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                                  }`}>
                                    {size}:{qty}
                                  </span>
                                ))}
                              </div>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Total: {totalStock}</p>
                            </td>
                            <td className="p-4">
                              <button 
                                onClick={() => toggleProductActive(product)}
                                className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-colors ${
                                  product.is_active 
                                    ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' 
                                    : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'
                                }`}
                              >
                                {product.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {product.is_active ? 'Active' : 'Draft'}
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => router.push(`/admin/products/${product.id}/edit`)}
                                  className="p-2 text-zinc-400 hover:text-zinc-950 transition-colors border border-zinc-200 hover:bg-zinc-50 rounded bg-white shadow-sm"
                                  title="Edit Product"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(product.id, product.name)}
                                  className="p-2 text-zinc-400 hover:text-brand-red transition-colors border border-zinc-200 hover:bg-zinc-50 rounded bg-white shadow-sm"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-zinc-100">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 text-sm">No products found.</div>
                ) : (
                  filteredProducts.map(product => {
                    const totalStock = Object.values(product.stock_quantity).reduce((a, b) => a + b, 0);
                    const isMissingWeight = !product.weight_grams || product.weight_grams === 0;
                    return (
                      <div key={product.id} className={`p-4 space-y-4 hover:bg-zinc-50/30 transition-colors ${
                        isMissingWeight ? 'bg-red-50/10' : 'bg-white'
                      }`}>
                        {/* Upper row: Checkbox, Image and details */}
                        <div className="flex gap-4 items-start">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(product.id)}
                            onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 mt-2"
                          />
                          <div className="w-16 h-20 bg-zinc-100 border border-zinc-200 rounded-lg overflow-hidden shrink-0">
                            {product.images[0] && (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <h3 className="text-sm font-bold text-zinc-900 truncate">{product.name}</h3>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                              {product.category} • {product.gender}
                              {product.weight_grams ? ` • ${product.weight_grams >= 1000 ? `${(product.weight_grams / 1000).toFixed(1)}kg` : `${product.weight_grams}g`}` : ''}
                            </p>
                            {isMissingWeight && (
                              <span className="inline-block mt-1 text-[9px] font-extrabold tracking-widest bg-red-50 text-red-500 border border-red-150 px-2 py-0.5 rounded uppercase">
                                ⚠️ Missing Weight
                              </span>
                            )}
                            <div className="mt-2 flex items-baseline gap-2">
                              <span className="text-sm font-mono font-bold text-zinc-900">₹{(product.price / 100).toFixed(2)}</span>
                              {product.compare_price && (
                                <span className="text-xs font-mono text-zinc-400 line-through">₹{(product.compare_price / 100).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Stock quantities by size */}
                        <div className="border-t border-zinc-100 pt-3 text-left">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold block mb-1.5">Stock by Size (Total: {totalStock})</span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(product.stock_quantity).map(([size, qty]) => (
                              <span key={size} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded ${
                                qty <= 2 
                                  ? 'bg-red-50 text-red-500 border-red-100' 
                                  : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                              }`}>
                                {size}:{qty}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions row */}
                        <div className="border-t border-zinc-100 pt-3 flex items-center justify-between gap-4">
                          {/* Status */}
                          <button 
                            onClick={() => toggleProductActive(product)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-colors ${
                              product.is_active 
                                ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' 
                                : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {product.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {product.is_active ? 'Active' : 'Draft'}
                          </button>

                          {/* Edit / Delete Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/admin/products/${product.id}/edit`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors rounded-lg shadow-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(product.id, product.name)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-red border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors rounded-lg shadow-sm"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-[16px] max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-widest border-b border-zinc-100 pb-2 text-left">
              Bulk Set Weight
            </h3>
            <p className="text-xs text-zinc-500 text-left">
              Set the weight for {selectedIds.length} selected products.
            </p>
            <div className="space-y-2 text-left">
              <label className="text-xs uppercase tracking-wider text-zinc-400 font-bold block">
                Weight (Grams)
              </label>
              <input
                type="number"
                value={bulkWeightInput}
                onChange={(e) => setBulkWeightInput(e.target.value)}
                placeholder="e.g. 250"
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:border-zinc-900 transition-colors rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setBulkWeightInput('');
                }}
                className="border border-zinc-200 text-zinc-650 hover:bg-zinc-50 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingBulk || !bulkWeightInput}
                onClick={handleBulkWeightUpdate}
                className="bg-zinc-900 text-white hover:bg-zinc-800 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {isUpdatingBulk ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
