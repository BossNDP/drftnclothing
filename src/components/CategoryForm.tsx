'use client';

import React, { useState, useEffect } from 'react';
import { Category } from '@/types';
import { ArrowLeft, Trash2, Upload, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';

interface CategoryFormProps {
  initialData?: Category | null;
  mode: 'create' | 'edit';
}

export default function CategoryForm({ initialData, mode }: CategoryFormProps) {
  const { addToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch top-level categories to allow nesting subcategories
  useEffect(() => {
    async function loadParents() {
      try {
        const data = await db.getAllCategories();
        // Do not allow subcategories to have subcategories (only 1 level nested)
        // Also prevent a category from referencing itself as a parent
        const filteredParents = data.filter(
          (c) => !c.parent_id && (mode === 'create' || c.id !== initialData?.id)
        );
        setCategoriesList(filteredParents);
      } catch (err) {
        console.error('Failed to load parents:', err);
      }
    }
    loadParents();
  }, [initialData, mode]);

  // Pre-populate if editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setSlug(initialData.slug);
      setImageUrl(initialData.image_url || '');
      setDescription(initialData.description || '');
      setParentId(initialData.parent_id || '');
      setIsActive(initialData.is_active);
      setDisplayOrder((initialData as any).display_order || 0);
    }
  }, [initialData]);

  // Auto-slugify name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (mode === 'create') {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(generatedSlug);
    }
  };

  const handleSlugBlur = () => {
    const cleaned = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setSlug(cleaned);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    const file = files[0];
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'drftn-categories';

    try {
      const signRes = await fetch('/api/admin/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { timestamp, folder } })
      });

      if (!signRes.ok) throw new Error('Failed to fetch signature');
      const signData = await signRes.json();
      const activeCloudName = signData.cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dtj01pdog';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signData.signature);
      formData.append('folder', folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${activeCloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Cloudinary upload error (${uploadRes.status})`);
      }

      const uploadData = await uploadRes.json();
      // Apply Cloudinary transformations for format and quality optimizations
      const optimizedUrl = uploadData.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
      setImageUrl(optimizedUrl);
      addToast('Image uploaded successfully', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(`Failed to upload image: ${err?.message || err}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return addToast('Category name is required', 'error');
    if (!slug.trim()) return addToast('Category slug is required', 'error');

    setIsSaving(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        image_url: imageUrl || null,
        description: description.trim() || null,
        parent_id: parentId || null,
        is_active: isActive,
        display_order: displayOrder,
      };

      if (mode === 'create') {
        await db.createCategory(payload as any);
        addToast('Category created successfully', 'success');
      } else {
        if (!initialData?.id) throw new Error('Missing category ID');
        await db.updateCategory(initialData.id, payload as any);
        addToast('Category updated successfully', 'success');
      }

      router.push('/admin/categories');
      router.refresh();
    } catch (err) {
      console.error(err);
      addToast(mode === 'create' ? 'Failed to create category' : 'Failed to update category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl animate-fade-in pb-16">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push('/admin/categories')}
          className="p-2 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-brand-offwhite rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest uppercase text-brand-offwhite">
            {mode === 'create' ? 'New Category' : 'Edit Category'}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === 'create' ? 'Create a new product category.' : `Modify details for ${initialData?.name || 'category'}.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/30 border border-zinc-800 p-6 md:p-8 space-y-6">
            <h2 className="text-sm font-bold text-brand-offwhite uppercase tracking-widest border-b border-zinc-800 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white" />
              Category Details
            </h2>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Name</label>
              <input
                type="text"
                placeholder="e.g. Hoodies"
                value={name}
                onChange={handleNameChange}
                className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Slug URL path</label>
              <input
                type="text"
                placeholder="e.g. hoodies"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={handleSlugBlur}
                className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Parent Category</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors font-bold uppercase tracking-wider"
              >
                <option value="">[None] — Set as Top-Level Category</option>
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600 font-mono">Select a parent category to create a nested subcategory.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Description</label>
              <textarea
                placeholder="Describe the collection/category fit or drops..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors resize-none leading-relaxed"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Display Order</label>
              <input
                type="number"
                placeholder="0"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors font-mono"
              />
            </div>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800 p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-sm font-bold text-brand-offwhite uppercase tracking-widest">Category Banner / Image</h2>
            </div>

            <div className="space-y-6">
              <label className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/20 hover:bg-zinc-950/40 p-8 text-center rounded-lg cursor-pointer flex flex-col items-center justify-center gap-2 group transition-all duration-300">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Upload className="w-8 h-8 text-zinc-500 group-hover:text-white transition-colors" />
                <span className="text-xs font-bold uppercase tracking-wider text-brand-offwhite">
                  {isUploading ? 'Uploading to Cloudinary...' : 'Select image'}
                </span>
              </label>

              {imageUrl && (
                <div className="relative bg-zinc-950 border border-zinc-800 group rounded-md overflow-hidden aspect-video">
                  <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end p-2">
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="p-2 h-max bg-brand-black/80 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/30 border border-zinc-800 p-6 md:p-8 space-y-4">
            <h2 className="text-sm font-bold text-brand-offwhite uppercase tracking-widest border-b border-zinc-800 pb-3 mb-2">
              Visibility
            </h2>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs uppercase font-bold text-brand-offwhite">Is Active</span>
                <p className="text-[10px] text-zinc-500">Make visible to consumers immediately</p>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-zinc-850 bg-zinc-950 text-white focus:ring-white w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-white hover:bg-zinc-200 text-black font-extrabold uppercase tracking-widest text-xs py-4 px-6 rounded shadow-lg shadow-white/5 disabled:opacity-50 transition-all duration-300"
          >
            {isSaving ? 'Saving Category...' : mode === 'create' ? 'Create Category' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
