'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Product, Category } from '@/types';
import { ArrowLeft, Trash2, ArrowLeftRight, Upload, Sparkles, MoveLeft, MoveRight, Star, HelpCircle, Camera, Loader2, Plus, Link2, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { RGBA, getDominantColor, renderCompositeOnCanvas, rgbToHsl } from '@/lib/imageProcessor';

interface ProductFormProps {
  initialData?: Product | null;
  mode: 'create' | 'edit';
}

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '26', '28', '30', '32', '34', '36', '38'] as const;
const GENDERS = ['unisex', 'men', 'women'] as const;

export default function ProductForm({ initialData, mode }: ProductFormProps) {
  const { addToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(''); // in Rupees (e.g., 1299)
  const [comparePrice, setComparePrice] = useState(''); // in Rupees
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [gender, setGender] = useState<typeof GENDERS[number]>('unisex');
  const [images, setImages] = useState<string[]>([]);
  const [activeSizes, setActiveSizes] = useState<string[]>(['S', 'M', 'L']);
  const [stock, setStock] = useState<Record<string, number>>({
    XS: 0,
    S: 10,
    M: 10,
    L: 10,
    XL: 0,
    XXL: 0,
  });
  const [isFeatured, setIsFeatured] = useState(false);
  const [pairedWith, setPairedWith] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Shipping & Dimensions States
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>('g');
  const [length, setLength] = useState('');
  const [breadth, setBreadth] = useState('');
  const [height, setHeight] = useState('');

  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ name: string; progress: number }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Native Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // AI & SEO Tags States
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // URL paste input state
  const [urlPasteInputs, setUrlPasteInputs] = useState<string[]>(['']);
  const [urlImageErrors, setUrlImageErrors] = useState<Record<number, boolean>>({});
  
  // Camera inputs & Preview canvas refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [processingImage, setProcessingImage] = useState<File | null>(null);
  const [processingImgUrl, setProcessingImgUrl] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState<RGBA | null>(null);
  const [activeBgOption, setActiveBgOption] = useState<'neutral' | 'dark' | 'gradient'>('neutral');
  const [bgRemovalStatus, setBgRemovalStatus] = useState<string>('');
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [hasGeneratedDescription, setHasGeneratedDescription] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastCutoutBlob, setLastCutoutBlob] = useState<Blob | null>(null);

  // Background removal toggle state (default OFF)
  const [removeBgToggle, setRemoveBgToggle] = useState(false);

  // Duplicate / Similar product name warning state
  const [similarProductWarning, setSimilarProductWarning] = useState<{
    matched: boolean;
    product?: { id: string; name: string; slug: string };
  } | null>(null);

  // Repeatable Colour Variant state (optional — default empty [])
  const [variants, setVariants] = useState<Array<{
    id?: string;
    colour_name: string;
    colour_hex: string;
    images: string[];
    sizes: string[];
    stock_quantity: Record<string, number>;
    sku: string;
    price_override: string;
  }>>([]);

  // Fetch featured products for paired_with dropdown
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

  // Fetch categories on load
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await db.getAllCategories();
        setCategoriesList(data);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
  }, []);

  // Fetch featured products for paired_with dropdown on mount
  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await fetch('/api/admin/products?featured=true&limit=20');
        if (!res.ok) return;
        const data = await res.json();
        const list: Product[] = data.products || data || [];
        setFeaturedProducts(list.filter((p: Product) => p.is_featured));
      } catch {
        // Non-critical, silently ignore
      }
    }
    loadFeatured();
  }, []);

  // Pre-populate if editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setSlug(initialData.slug);
      
      const desc = initialData.description || '';
      if (desc.includes('\n\nTags: ')) {
        const parts = desc.split('\n\nTags: ');
        setDescription(parts[0]);
        setTags(parts[1].split(', ').map(t => t.trim()));
        setTagsInput(parts[1]);
      } else {
        setDescription(desc);
        setTags([]);
        setTagsInput('');
      }

      setPrice((initialData.price / 100).toString());
      setComparePrice(initialData.compare_price ? (initialData.compare_price / 100).toString() : '');
      setCategory(initialData.category || '');
      setSubcategory(initialData.subcategory || '');
      setGender(initialData.gender as any);
      setImages(initialData.images || []);
      setActiveSizes(initialData.sizes || []);
      
      const initialStock = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
      if (initialData.stock_quantity) {
        Object.keys(initialData.stock_quantity).forEach((size) => {
          initialStock[size as keyof typeof initialStock] = Number(initialData.stock_quantity[size]);
        });
      }
      setStock(initialStock);
      setIsFeatured(initialData.is_featured);
      setPairedWith(initialData.paired_with || '');
      setIsActive(initialData.is_active);

      // Load Shipping & Dimensions
      if (initialData.weight_grams) {
        if (initialData.weight_grams >= 1000 && initialData.weight_grams % 1000 === 0) {
          setWeight((initialData.weight_grams / 1000).toString());
          setWeightUnit('kg');
        } else {
          setWeight(initialData.weight_grams.toString());
          setWeightUnit('g');
        }
      } else {
        setWeight('');
        setWeightUnit('g');
      }
      setLength(initialData.length_cm ? initialData.length_cm.toString() : '');
      setBreadth(initialData.breadth_cm ? initialData.breadth_cm.toString() : '');
      setHeight(initialData.height_cm ? initialData.height_cm.toString() : '');

      // Always reset variants to match the saved product (may be empty for products with no colour variants)
      setVariants(
        initialData.variants && initialData.variants.length > 0
          ? initialData.variants.map((v) => ({
              id: v.id,
              colour_name: v.colour_name,
              colour_hex: v.colour_hex || '#18181B',
              images: v.images || [],
              sizes: v.sizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
              stock_quantity: v.stock_quantity || { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
              sku: v.sku || '',
              price_override: v.price_override ? (v.price_override / 100).toString() : '',
            }))
          : []
      );
    }
  }, [initialData?.id]);

  // Debounced product name similarity check (~500ms) on create mode
  useEffect(() => {
    if (mode !== 'create' || !name.trim() || name.trim().length < 2) {
      setSimilarProductWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await db.checkProductSimilarity(name.trim());
        if (res.matched && res.product) {
          setSimilarProductWarning(res);
        } else {
          setSimilarProductWarning(null);
        }
      } catch {
        setSimilarProductWarning(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [name, mode]);

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

  const toggleSize = (size: string) => {
    setActiveSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleStockChange = (size: string, value: number) => {
    setStock((prev) => ({
      ...prev,
      [size]: Math.max(0, value),
    }));
  };

  // Image Upload handler with client validations & upload progress
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    // Client-side format and size checks
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`"${file.name}" exceeds 5MB size limit.`);
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        errors.push(`"${file.name}" has invalid format. Use JPEG, PNG, or WebP.`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      errors.forEach((err) => addToast(err, 'error'));
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadingFiles(validFiles.map(f => ({ name: f.name, progress: 0 })));

    const uploadedUrls: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = 'drftn-products';

      try {
        const signRes = await fetch('/api/admin/cloudinary-sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: { timestamp, folder } })
        });

        if (!signRes.ok) throw new Error('Failed to get signature');
        const signData = await signRes.json();
        const activeCloudName = signData.cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dtj01pdog';

        // Perform XHR request to track real-time upload progress percentage
        const url = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append('file', file);
          formData.append('api_key', signData.apiKey);
          formData.append('timestamp', String(timestamp));
          formData.append('signature', signData.signature);
          formData.append('folder', folder);

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadingFiles(prev => 
                prev.map((f, idx) => idx === i ? { ...f, progress } : f)
              );
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const res = JSON.parse(xhr.responseText);
              resolve(res.secure_url);
            } else {
              let errMsg = `Upload failed (${xhr.status})`;
              try {
                const res = JSON.parse(xhr.responseText);
                if (res.error?.message) errMsg = res.error.message;
              } catch {}
              reject(new Error(errMsg));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error')));
          xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

          xhr.open('POST', `https://api.cloudinary.com/v1_1/${activeCloudName}/image/upload`);
          xhr.send(formData);
        });

        const optimizedUrl = url.replace('/upload/', '/upload/f_auto,q_auto/');
        uploadedUrls.push(optimizedUrl);
      } catch (err: any) {
        console.error(err);
        addToast(`Failed to upload "${file.name}": ${err?.message || err}`, 'error');
      }
    }

    if (uploadedUrls.length > 0) {
      setImages((prev) => [...prev, ...uploadedUrls]);
      addToast(`${uploadedUrls.length} image(s) uploaded successfully`, 'success');
    }
    setIsUploading(false);
    setUploadingFiles([]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    addToast('Image removed from collection', 'info');
  };

  // Reordering grid handlers (native HTML5 drag-and-drop)
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...images];
    const draggedItem = reordered[draggedIndex];
    reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);
    setImages(reordered);
    setDraggedIndex(null);
    addToast('Image order updated', 'info');
  };

  const handleTagsBlur = () => {
    if (!tagsInput.trim()) {
      setTags([]);
      return;
    }
    const parsed = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    setTags(parsed);
  };

  const removeTag = (tagToRemove: string) => {
    const updated = tags.filter(t => t !== tagToRemove);
    setTags(updated);
    setTagsInput(updated.join(', '));
  };

  // ── URL Paste Handlers ──────────────────────────────────────────────────
  const handleUrlInputChange = (index: number, value: string) => {
    setUrlPasteInputs(prev => prev.map((u, i) => (i === index ? value : u)));
    setUrlImageErrors(prev => ({ ...prev, [index]: false }));
  };

  const handleAddUrlRow = () => {
    if (urlPasteInputs.length >= 8) return;
    setUrlPasteInputs(prev => [...prev, '']);
  };

  const handleRemoveUrlRow = (index: number) => {
    setUrlPasteInputs(prev => prev.filter((_, i) => i !== index));
    setUrlImageErrors(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleMoveUrlUp = (index: number) => {
    if (index === 0) return;
    setUrlPasteInputs(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const handleMoveUrlDown = (index: number) => {
    setUrlPasteInputs(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleAddUrlsToGallery = () => {
    const validUrls = urlPasteInputs.filter((u, idx) => u.trim() !== '' && !urlImageErrors[idx]);
    if (validUrls.length === 0) {
      addToast('No valid image URLs to add — enter at least one URL and ensure it loads.', 'error');
      return;
    }
    setImages(prev => [...prev, ...validUrls]);
    setUrlPasteInputs(['']);
    setUrlImageErrors({});
    addToast(`${validUrls.length} image URL(s) added to gallery`, 'success');
  };

  // Helper to optimize and downscale transparent cutout blob to prevent payload size errors
  const optimizeTransparentBlob = async (rawBlob: Blob, maxDim = 1600): Promise<Blob> => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(rawBlob);
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load cutout image'));
      });
      URL.revokeObjectURL(url);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return rawBlob;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const optimizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      return optimizedBlob || rawBlob;
    } catch (err) {
      console.warn('[optimizeTransparentBlob error]:', err);
      return rawBlob;
    }
  };

  // Upload transparent cutout blob to server route with direct Cloudinary fallback
  const uploadBgRemovedImage = async (blob: Blob, fileName: string) => {
    setIsUploading(true);
    setBgRemovalStatus('Enhancing & uploading...');
    setUploadError(null);

    try {
      // 1. Optimize transparent blob on canvas (max 1600px) to prevent payload size errors
      const optimizedBlob = await optimizeTransparentBlob(blob, 1600);

      // 2. Primary upload via server-side route
      const uploadFormData = new FormData();
      uploadFormData.append('file', optimizedBlob, `bg-removed-${fileName}`);

      const uploadRes = await fetch('/api/admin/products/upload-image', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server upload failed (HTTP ${uploadRes.status})`);
      }

      const uploadData = await uploadRes.json();
      if (!uploadData?.secure_url) {
        throw new Error('Cloudinary upload returned invalid URL');
      }

      const secureUrl: string = uploadData.secure_url;

      // 4. Auto-populate into Paste Cloudinary URLs input row
      setUrlPasteInputs(prev => {
        if (prev.length === 0 || (prev.length === 1 && !prev[0].trim())) {
          return [secureUrl!];
        }
        if (!prev[0].trim()) {
          const next = [...prev];
          next[0] = secureUrl!;
          return next;
        }
        if (!prev[prev.length - 1].trim()) {
          const next = [...prev];
          next[next.length - 1] = secureUrl!;
          return next;
        }
        if (prev.length < 8) {
          return [...prev, secureUrl!];
        }
        return prev;
      });

      addToast('Photo enhanced & uploaded to Cloudinary!', 'success');

      // Auto-trigger description generation if first image
      if (!hasGeneratedDescription) {
        generateDescription(optimizedBlob);
        setHasGeneratedDescription(true);
      }

      // Reset processing states
      setProcessingImage(null);
      setProcessingImgUrl(null);
      setLastCutoutBlob(null);
      setUploadError(null);
    } catch (err: any) {
      console.error('[uploadBgRemovedImage Error]:', err);
      setUploadError(err.message || 'Failed to upload to Cloudinary');
      addToast(`Upload failed: ${err.message || err}`, 'error');
    } finally {
      setIsUploading(false);
      setIsRemovingBg(false);
      setBgRemovalStatus('');
    }
  };

  const retryCloudinaryUpload = async () => {
    if (lastCutoutBlob) {
      await uploadBgRemovedImage(lastCutoutBlob, processingImage?.name || 'garment.png');
    } else if (processingImage) {
      await processImageBackground(processingImage);
    }
  };

  // Intercept uploads or camera captures to run background removal
  const processImageBackground = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      addToast(`"${file.name}" exceeds 5MB size limit.`, 'error');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      addToast(`"${file.name}" has invalid format. Use JPEG, PNG, or WebP.`, 'error');
      return;
    }

    setProcessingImage(file);
    setIsRemovingBg(true);
    setUploadError(null);
    setBgRemovalStatus('Downloading AI cutout model (first load takes a few seconds)...');

    try {
      // Import @imgly and onnxruntime-web
      const [{ removeBackground }, ort] = await Promise.all([
        import('@imgly/background-removal'),
        // @ts-ignore
        import('onnxruntime-web'),
      ]);

      // Serve WASM from /public/ort-wasm/ instead of webpack's broken relative path
      ort.env.wasm.wasmPaths = '/ort-wasm/';
      
      setBgRemovalStatus('Processing clean cutout...');
      const transparentBlob = await removeBackground(file, {
        device: 'cpu',
        model: 'isnet',
        progress: (key: string, current: number, total: number) => {
          const pct = Math.round((current / total) * 100);
          setBgRemovalStatus(`Processing clean cutout... ${pct}%`);
        }
      });

      const transparentUrl = URL.createObjectURL(transparentBlob);
      setProcessingImgUrl(transparentUrl);
      setLastCutoutBlob(transparentBlob);

      setBgRemovalStatus('Analyzing garment color palette...');
      const img = new Image();
      img.src = transparentUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load cutout image element'));
      });

      const domColor = getDominantColor(img);
      setDominantColor(domColor);

      // Auto-upload the bg-removed image to Cloudinary via server route
      await uploadBgRemovedImage(transparentBlob, file.name);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed during background removal process');
      addToast(`Failed to strip background: ${err.message || err}`, 'error');
      setIsRemovingBg(false);
      setBgRemovalStatus('');
    }
  };

  // Keep preview canvas updated as options toggle
  useEffect(() => {
    if (!processingImgUrl || !dominantColor || !previewCanvasRef.current) return;

    const img = new Image();
    img.src = processingImgUrl;
    img.onload = () => {
      renderCompositeOnCanvas({
        canvas: previewCanvasRef.current!,
        cutoutImg: img,
        backgroundStyle: activeBgOption,
        dominantColor,
      });
    };
  }, [processingImgUrl, activeBgOption, dominantColor]);

  const uploadRemainingImagesDirectly = async (validFiles: File[]) => {
    setIsUploading(true);
    setUploadingFiles((prev) => [
      ...prev,
      ...validFiles.map((f) => ({ name: f.name, progress: 0 })),
    ]);

    const uploadedUrls: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];

      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        if (removeBgToggle) {
          uploadFormData.append('removeBackground', 'true');
        }

        const res = await fetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.secure_url) {
          uploadedUrls.push(data.secure_url);
        }
      } catch (err: any) {
        console.error('[Upload Image Error]:', err);
        addToast(`Failed to upload "${file.name}": ${err.message || err}`, 'error');
      }
    }

    if (uploadedUrls.length > 0) {
      setImages((prev) => [...prev, ...uploadedUrls]);
      addToast(`${uploadedUrls.length} image(s) uploaded successfully`, 'success');
    }
    setIsUploading(false);
    setUploadingFiles((prev) => prev.filter((pf) => !validFiles.some((vf) => vf.name === pf.name)));
  };

  // Create high-res composite, upload to Cloudinary, and trigger description pre-fill
  const handleApplyAndUpload = async () => {
    if (!previewCanvasRef.current || !processingImage || !dominantColor) return;

    setIsUploading(true);
    setBgRemovalStatus('Generating studio composition...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 1200;

      const img = new Image();
      img.src = processingImgUrl!;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      renderCompositeOnCanvas({
        canvas,
        cutoutImg: img,
        backgroundStyle: activeBgOption,
        dominantColor,
      });

      const compositeBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to output canvas blob'));
          },
          'image/jpeg',
          0.9
        );
      });

      setBgRemovalStatus('Uploading composite image...');
      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = 'drftn-products';

      const signRes = await fetch('/api/admin/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { timestamp, folder } })
      });

      if (!signRes.ok) throw new Error('Failed to fetch Cloudinary API signature');
      const signData = await signRes.json();

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const formData = new FormData();
      formData.append('file', compositeBlob, `processed-${processingImage.name}`);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signData.signature);
      formData.append('folder', folder);

      const xhrRes = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Cloudinary response error'));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network upload failed')));
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
        xhr.send(formData);
      });

      const url = xhrRes.secure_url;
      const optimizedUrl = url.replace('/upload/', `/upload/f_auto,q_auto/`);

      setImages((prev) => [...prev, optimizedUrl]);
      addToast('Studio image generated and added successfully', 'success');

      // Auto-trigger description generation if first image
      if (!hasGeneratedDescription) {
        generateDescription(compositeBlob);
        setHasGeneratedDescription(true);
      }
    } catch (err: any) {
      console.error(err);
      addToast(`Failed to save processed image: ${err.message || err}`, 'error');
    } finally {
      setIsUploading(false);
      setBgRemovalStatus('');
      setProcessingImage(null);
      setProcessingImgUrl(null);
      setDominantColor(null);
    }
  };

  const handleUploadOriginal = async () => {
    if (!processingImage) return;

    setIsUploading(true);
    setBgRemovalStatus('Uploading original image...');

    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = 'drftn-products';

      const signRes = await fetch('/api/admin/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { timestamp, folder } })
      });

      if (!signRes.ok) throw new Error('Failed to fetch Cloudinary API signature');
      const signData = await signRes.json();

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const formData = new FormData();
      formData.append('file', processingImage);
      formData.append('api_key', signData.apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signData.signature);
      formData.append('folder', folder);

      const xhrRes = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Cloudinary response error'));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network upload failed')));
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
        xhr.send(formData);
      });

      const url = xhrRes.secure_url;
      const optimizedUrl = url.replace('/upload/', `/upload/f_auto,q_auto/`);

      setImages((prev) => [...prev, optimizedUrl]);
      addToast('Original image added successfully', 'success');

      // Auto-trigger description generation if first image
      if (!hasGeneratedDescription) {
        generateDescription(processingImage);
        setHasGeneratedDescription(true);
      }
    } catch (err: any) {
      console.error(err);
      addToast(`Upload failed: ${err.message || err}`, 'error');
    } finally {
      setIsUploading(false);
      setBgRemovalStatus('');
      setProcessingImage(null);
      setProcessingImgUrl(null);
      setDominantColor(null);
    }
  };

  const generateDescription = async (imageFile: File | Blob) => {
    setIsGeneratingDescription(true);
    setBgRemovalStatus('Generating product description with Gemini Flash...');

    try {
      const img = new Image();
      img.src = URL.createObjectURL(imageFile);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for description'));
      });

      // Compress preview for AI (384x384 JPEG)
      const canvasSmall = document.createElement('canvas');
      canvasSmall.width = 384;
      canvasSmall.height = 384;
      const ctxSmall = canvasSmall.getContext('2d');
      if (ctxSmall) {
        ctxSmall.drawImage(img, 0, 0, 384, 384);
        const dataUrl = canvasSmall.toDataURL('image/jpeg', 0.85);
        const compressedBase64 = dataUrl.split(',')[1];

        const genRes = await fetch('/api/admin/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compressedBase64,
            mimeType: 'image/jpeg'
          })
        });

        if (genRes.ok) {
          const genData = await genRes.json();
          if (genData.warning) {
            addToast(genData.warning, 'info');
          }
          if (genData.title) {
            setName(genData.title);
            const generatedSlug = genData.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)+/g, '');
            setSlug(generatedSlug);
          }
          if (genData.description) {
            setDescription(genData.description);
          }
          if (genData.tags && genData.tags.length > 0) {
            setTags(genData.tags);
            setTagsInput(genData.tags.join(', '));
          }
          addToast('AI title, description, and tags generated!', 'success');
        }
      }
    } catch (err: any) {
      console.error(err);
      addToast(`Failed to generate AI copywriting: ${err.message || err}`, 'error');
    } finally {
      setIsGeneratingDescription(false);
      setBgRemovalStatus('');
    }
  };

  const makePrimary = (index: number) => {
    if (index === 0) return;
    const reordered = [...images];
    const target = reordered[index];
    reordered.splice(index, 1);
    reordered.unshift(target);
    setImages(reordered);
    addToast('Cover image updated successfully', 'success');
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return addToast('Product name is required', 'error');
    if (!slug.trim()) return addToast('Product slug is required', 'error');
    if (!description.trim()) return addToast('Product description is required', 'error');
    if (!price || isNaN(Number(price))) return addToast('Valid product price is required', 'error');
    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) return addToast('Product weight is required and must be greater than 0', 'error');
    if (images.length === 0) return addToast('Please upload at least one product image', 'error');
    if (activeSizes.length === 0) return addToast('Please select at least one active size', 'error');

    setIsSaving(true);

    try {
      // Build stock record based on active sizes, default 0 for inactive
      const finalStock: Record<string, number> = {};
      AVAILABLE_SIZES.forEach((size) => {
        finalStock[size] = activeSizes.includes(size) ? (stock[size] || 0) : 0;
      });

      const finalDescription = tags.length > 0 
        ? `${description.trim()}\n\nTags: ${tags.join(', ')}`
        : description.trim();

      // Process variants
      const formattedVariants = variants.map((v, idx) => {
        const vStock: Record<string, number> = {};
        AVAILABLE_SIZES.forEach((size) => {
          vStock[size] = v.sizes.includes(size) ? (v.stock_quantity[size] || 0) : 0;
        });

        const colName = v.colour_name.trim() || `Variant ${idx + 1}`;
        const autoSku = `DRFTN-${slug.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${colName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)}-${idx + 1}`;

        return {
          id: v.id,
          colour_name: colName,
          colour_hex: v.colour_hex || '#18181B',
          images: v.images && v.images.length > 0 ? v.images : images,
          sizes: v.sizes && v.sizes.length > 0 ? v.sizes : activeSizes,
          stock_quantity: vStock,
          sku: v.sku.trim() || autoSku,
          price_override: v.price_override ? Math.round(Number(v.price_override) * 100) : null,
        };
      });

      const parsedPrice = !isNaN(Number(price)) && Number(price) > 0 ? Math.round(Number(price) * 100) : 0;
      const parsedCompare = comparePrice && !isNaN(Number(comparePrice)) && Number(comparePrice) > 0 ? Math.round(Number(comparePrice) * 100) : null;
      const parsedWeight = weight && !isNaN(Number(weight)) && Number(weight) > 0
        ? (weightUnit === 'kg' ? Math.round(Number(weight) * 1000) : Math.round(Number(weight)))
        : 250;
      const parsedLength = length && !isNaN(Number(length)) && Number(length) > 0 ? Math.round(Number(length)) : null;
      const parsedBreadth = breadth && !isNaN(Number(breadth)) && Number(breadth) > 0 ? Math.round(Number(breadth)) : null;
      const parsedHeight = height && !isNaN(Number(height)) && Number(height) > 0 ? Math.round(Number(height)) : null;
      const validPairedWith = isFeatured && pairedWith && /^[0-9a-fA-F-]{36}$/.test(pairedWith.trim()) ? pairedWith.trim() : null;
      const cleanSubcategory = subcategory && subcategory.trim() ? subcategory.trim() : null;

      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: finalDescription,
        price: parsedPrice,
        base_price: parsedPrice,
        compare_price: parsedCompare,
        category,
        subcategory: cleanSubcategory,
        gender,
        images,
        sizes: activeSizes,
        stock_quantity: finalStock,
        is_featured: isFeatured,
        paired_with: validPairedWith,
        is_active: isActive,
        weight_grams: parsedWeight,
        length_cm: parsedLength,
        breadth_cm: parsedBreadth,
        height_cm: parsedHeight,
        variants: formattedVariants,
      };

      if (mode === 'create') {
        try {
          await db.createProduct(payload as any);
          addToast('Product created successfully', 'success');
        } catch (createErr: any) {
          // Slug collision auto-suffixing
          if (createErr?.message?.includes('slug') || createErr?.message?.includes('unique constraint') || createErr?.message?.includes('already exists')) {
            const suffixedSlug = `${slug.trim()}-2`;
            payload.slug = suffixedSlug;
            await db.createProduct(payload as any);
            addToast(`Slug collision detected! Adjusted slug to "${suffixedSlug}"`, 'info');
            addToast('Product created successfully', 'success');
          } else {
            throw createErr;
          }
        }
      } else {
        if (!initialData?.id) throw new Error('Missing product ID for updates');
        await db.updateProduct(initialData.id, payload as any);
        addToast('Product updated successfully', 'success');
      }

      // Reset background removal toggle after save
      setRemoveBgToggle(false);

      router.push('/admin/products');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      addToast(mode === 'create' ? 'Failed to create product' : 'Failed to update product', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl animate-fade-in pb-16 relative">
      {/* Global progress indicator bar */}
      {(isSaving || isUploading || isGeneratingDescription) && (
        <div className="fixed top-0 left-0 w-full h-[3px] bg-zinc-100 z-[999] overflow-hidden">
          <div className="bg-zinc-900 h-full animate-infinite-loading" />
        </div>
      )}
      
      {/* Header back */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest uppercase text-zinc-900">
            {mode === 'create' ? 'New Product' : 'Edit Product'}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === 'create' ? 'Create a new streetwear piece.' : `Modify details for ${initialData?.name || 'product'}.`}
          </p>
        </div>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Basic Form Info */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Info */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-200/60 pb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-red" />
              General Details
            </h2>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Product Name</label>
              <input
                type="text"
                placeholder="e.g. Essential Black Tee"
                value={name}
                onChange={handleNameChange}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all"
                required
              />
              {/* Inline warning banner if similar product exists */}
              {similarProductWarning && similarProductWarning.matched && similarProductWarning.product && (
                <div className="mt-2 bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-md flex items-start justify-between gap-3 text-xs leading-relaxed shadow-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Similar product exists: </span>
                      <a
                        href={`/admin/products/${similarProductWarning.product.id}/edit`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold text-amber-950 hover:text-black"
                      >
                        &quot;{similarProductWarning.product.name}&quot;
                      </a>
                      . Did you mean to add a colour variant to that product instead? Otherwise, consider a more distinct name.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimilarProductWarning(null)}
                    className="text-amber-700 hover:text-amber-950 font-bold text-base leading-none"
                    title="Dismiss warning"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
 
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Slug URL path</label>
              <input
                type="text"
                placeholder="e.g. essential-black-tee"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={handleSlugBlur}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-mono"
                required
              />
            </div>
 
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Description</label>
                {images.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setIsGeneratingDescription(true);
                        setBgRemovalStatus('Generating product details with Gemini...');
                        // Server-side fetch avoids CORS restrictions on Cloudinary URLs
                        const genRes = await fetch('/api/admin/generate-description', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ imageUrl: images[0] }),
                        });
                        if (!genRes.ok) {
                          const errData = await genRes.json().catch(() => ({}));
                          throw new Error(errData.error || `HTTP ${genRes.status}`);
                        }
                        const genData = await genRes.json();
                        if (genData.title) {
                          setName(genData.title);
                          setSlug(genData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                        }
                        if (genData.description) setDescription(genData.description);
                        if (genData.tags?.length > 0) {
                          setTags(genData.tags);
                          setTagsInput(genData.tags.join(', '));
                        }
                        addToast('AI title, description & tags generated!', 'success');
                      } catch (err: any) {
                        console.error(err);
                        addToast(`Failed to generate AI copy: ${err.message || err}`, 'error');
                      } finally {
                        setIsGeneratingDescription(false);
                        setBgRemovalStatus('');
                      }
                    }}
                    disabled={isGeneratingDescription || isUploading}
                    className="text-[10px] uppercase font-bold tracking-widest text-zinc-900 hover:text-zinc-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate with AI
                  </button>
                )}
              </div>
              <textarea
                placeholder="Describe the product fit, fabric weight (e.g. 240 GSM heavy cotton), design aesthetic, details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all resize-none leading-relaxed"
                required
              />
            </div>
 
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">SEO Search Tags (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. oversized, distressed, premium fleece, boxy fit"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onBlur={handleTagsBlur}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-mono"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <span key={tag} className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-zinc-100 text-zinc-600 border border-zinc-200/80 rounded-sm flex items-center gap-1.5">
                      {tag}
                      <button 
                        type="button" 
                        onClick={() => removeTag(tag)} 
                        className="text-zinc-500 hover:text-brand-red font-mono leading-none text-xs"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sizing & Stock */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-200/60 pb-3">
              Sizes & Inventory Levels
            </h2>
 
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Select Active Sizes</span>
                <div className="flex flex-wrap gap-3">
                  {AVAILABLE_SIZES.map((size) => {
                    const isActiveSize = activeSizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`w-12 h-12 font-mono font-bold text-xs border uppercase tracking-wider flex items-center justify-center transition-all ${
                          isActiveSize
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
 
              {activeSizes.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-zinc-200/60">
                  <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Quantities in Stock</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {activeSizes.map((size) => (
                      <div key={size} className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Size {size} Qty</label>
                        <input
                          type="number"
                          value={stock[size] ?? 0}
                          onChange={(e) => handleStockChange(size, parseInt(e.target.value) || 0)}
                          className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-3 py-2 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-mono"
                          min="0"
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colour Variants Repeatable Section */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-red" />
                  Colour Variants ({variants.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Configure swatches, per-variant images, stock breakdown, SKUs, and optional price overrides.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newIndex = variants.length + 1;
                  const autoCol = `Colour ${newIndex}`;
                  setVariants((prev) => [
                    ...prev,
                    {
                      colour_name: autoCol,
                      colour_hex: '#18181B',
                      images: [],
                      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
                      stock_quantity: { XS: 0, S: 5, M: 5, L: 5, XL: 0, XXL: 0 },
                      sku: `DRFTN-${slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${autoCol.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)}`,
                      price_override: '',
                    },
                  ]);
                  addToast(`Added new variant "${autoCol}"`, 'info');
                }}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Colour Variant
              </button>
            </div>

            <div className="space-y-6">
              {variants.map((variant, vIdx) => (
                <div key={vIdx} className="border border-zinc-200 bg-zinc-50/40 p-5 rounded-lg space-y-5 relative">
                  <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full border border-zinc-400 shadow-sm shrink-0"
                        style={{ backgroundColor: variant.colour_hex || '#18181B' }}
                      />
                      <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-900">
                        Variant #{vIdx + 1}: {variant.colour_name || 'Unnamed Colour'}
                      </span>
                    </div>
                    {variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setVariants((prev) => prev.filter((_, i) => i !== vIdx));
                          addToast(`Removed variant "${variant.colour_name}"`, 'info');
                        }}
                        className="text-zinc-400 hover:text-brand-red text-xs font-bold uppercase flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Colour Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Colour Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Pitch Black, Washed Olive"
                        value={variant.colour_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariants((prev) =>
                            prev.map((v, i) => (i === vIdx ? { ...v, colour_name: val } : v))
                          );
                        }}
                        className="w-full bg-white border border-zinc-200 text-zinc-900 px-3 py-2 text-xs focus:outline-none focus:border-zinc-950 transition-all"
                        required
                      />
                    </div>

                    {/* Swatch Picker */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Swatch Colour (Hex)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={variant.colour_hex || '#18181B'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((prev) =>
                              prev.map((v, i) => (i === vIdx ? { ...v, colour_hex: val } : v))
                            );
                          }}
                          className="w-9 h-9 border border-zinc-200 rounded p-0.5 cursor-pointer bg-white"
                        />
                        <input
                          type="text"
                          placeholder="#000000"
                          value={variant.colour_hex}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((prev) =>
                              prev.map((v, i) => (i === vIdx ? { ...v, colour_hex: val } : v))
                            );
                          }}
                          className="flex-1 bg-white border border-zinc-200 text-zinc-900 px-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-950 transition-all uppercase"
                        />
                      </div>
                    </div>

                    {/* SKU */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Variant SKU</label>
                      <input
                        type="text"
                        placeholder="e.g. DRFTN-TEE-BLK-01"
                        value={variant.sku}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariants((prev) =>
                            prev.map((v, i) => (i === vIdx ? { ...v, sku: val } : v))
                          );
                        }}
                        className="w-full bg-white border border-zinc-200 text-zinc-900 px-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-950 transition-all uppercase"
                        required
                      />
                    </div>

                    {/* Price Override */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        Price Override (₹ Rupees, optional)
                      </label>
                      <input
                        type="number"
                        placeholder={`Falls back to base price (₹${price || '0'})`}
                        value={variant.price_override}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariants((prev) =>
                            prev.map((v, i) => (i === vIdx ? { ...v, price_override: val } : v))
                          );
                        }}
                        className="w-full bg-white border border-zinc-200 text-zinc-900 px-3 py-2 text-xs focus:outline-none focus:border-zinc-950 transition-all font-mono"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Per-Variant Size Stock Breakdown */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200/80">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                      Variant Stock breakdown by size
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {AVAILABLE_SIZES.map((size) => (
                        <div key={size} className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-500 font-mono block text-center">
                            {size}
                          </label>
                          <input
                            type="number"
                            value={variant.stock_quantity[size] ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setVariants((prev) =>
                                prev.map((v, i) =>
                                  i === vIdx
                                    ? {
                                        ...v,
                                        stock_quantity: {
                                          ...v.stock_quantity,
                                          [size]: val,
                                        },
                                      }
                                    : v
                                )
                              );
                            }}
                            className="w-full bg-white border border-zinc-200 text-zinc-900 px-2 py-1.5 text-xs text-center font-mono focus:outline-none focus:border-zinc-950 transition-all"
                            min="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cloudinary Image Uploader */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                Product Media
                <span className="text-[10px] text-zinc-500 font-normal lowercase">(JPEG, PNG, WebP — max 5MB per file)</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-1">Upload multiple product images. First image is used as main thumbnail.</p>
            </div>

            <div className="space-y-6">
              {/* ── URL Paste Panel ─────────────────────────────────────────── */}
              <div className="border border-zinc-200 bg-zinc-50/40 p-5 rounded-lg space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-brand-red" />
                    Paste Cloudinary URLs
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Paste image URLs directly. First row becomes the preview shown on the shop grid (sort_order&nbsp;0).
                  </p>
                </div>

                <div className="space-y-3">
                  {urlPasteInputs.map((url, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      {/* Live thumbnail */}
                      <div className="w-12 h-14 shrink-0 border border-zinc-200 bg-zinc-100 rounded overflow-hidden flex items-center justify-center">
                        {url.trim() ? (
                          urlImageErrors[idx] ? (
                            <span className="text-[8px] text-red-500 font-bold text-center px-0.5 leading-tight">Bad URL</span>
                          ) : (
                            <img
                              src={url}
                              alt={`url-preview-${idx}`}
                              className="w-full h-full object-cover"
                              onError={() => setUrlImageErrors(prev => ({ ...prev, [idx]: true }))}
                              onLoad={() => setUrlImageErrors(prev => ({ ...prev, [idx]: false }))}
                            />
                          )
                        ) : (
                          <Camera className="w-4 h-4 text-zinc-300" />
                        )}
                      </div>

                      {/* Input + controls */}
                      <div className="flex-1 space-y-1">
                        {idx === 0 && (
                          <span className="text-[9px] text-brand-red font-bold uppercase tracking-widest">
                            ★ Preview image — shown on shop grid (sort_order 0)
                          </span>
                        )}
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="url"
                            placeholder={idx === 0 ? 'https://res.cloudinary.com/…' : 'Additional image URL'}
                            value={url}
                            onChange={e => handleUrlInputChange(idx, e.target.value)}
                            className={`flex-1 bg-white border text-zinc-900 px-3 py-2 text-xs focus:outline-none transition-all font-mono ${
                              urlImageErrors[idx]
                                ? 'border-red-400 focus:ring-1 focus:ring-red-400'
                                : 'border-zinc-200 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleMoveUrlUp(idx)}
                            disabled={idx === 0}
                            className="p-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                            title="Move up"
                          >
                            <MoveLeft className="w-3 h-3 rotate-90" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveUrlDown(idx)}
                            disabled={idx >= urlPasteInputs.length - 1}
                            className="p-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                            title="Move down"
                          >
                            <MoveRight className="w-3 h-3 rotate-90" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveUrlRow(idx)}
                            disabled={urlPasteInputs.length === 1}
                            className="p-1.5 border border-zinc-200 bg-white hover:bg-red-50 hover:border-red-300 text-zinc-500 hover:text-brand-red disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {urlImageErrors[idx] && (
                          <p className="text-[10px] text-red-500">
                            Couldn’t load this URL — check for typos or access restrictions.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 pt-2 border-t border-zinc-200/60">
                  <button
                    type="button"
                    onClick={handleAddUrlRow}
                    disabled={urlPasteInputs.length >= 8}
                    className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add another image
                  </button>
                  <button
                    type="button"
                    onClick={handleAddUrlsToGallery}
                    disabled={urlPasteInputs.every(u => !u.trim())}
                    className="ml-auto px-5 py-2 bg-zinc-900 text-white text-[10px] uppercase font-bold tracking-widest hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded shadow-sm"
                  >
                    Add to Gallery ↓
                  </button>
                </div>
              </div>

              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const rawFiles = Array.from(e.target.files || []);
                  if (rawFiles.length === 0) return;

                  const validFiles = rawFiles.filter(
                    (f) => f.size <= 5 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
                  );

                  if (validFiles.length < rawFiles.length) {
                    addToast(`${rawFiles.length - validFiles.length} file(s) ignored (exceeded 5MB or invalid format).`, 'info');
                  }
                  if (validFiles.length === 0) return;

                  if (removeBgToggle) {
                    // Background Removal ON: process first image with AI cutout Studio
                    processImageBackground(validFiles[0]);
                    if (validFiles.length > 1) {
                      uploadRemainingImagesDirectly(validFiles.slice(1));
                    }
                  } else {
                    // Background Removal OFF: upload ALL images directly to Cloudinary
                    uploadRemainingImagesDirectly(validFiles);
                  }

                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (removeBgToggle) {
                    processImageBackground(file);
                  } else {
                    uploadRemainingImagesDirectly([file]);
                  }

                  e.target.value = '';
                }}
              />

              {/* Background Removal Toggle Switch */}
              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-4 rounded-lg shadow-sm">
                <div>
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                    Remove Background (Cloudinary AI / remove.bg)
                  </span>
                  <span className="text-[11px] text-zinc-500 block">
                    Automatically strip background before uploading to Cloudinary
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveBgToggle(!removeBgToggle)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    removeBgToggle ? 'bg-zinc-900' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      removeBgToggle ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {!processingImage && !uploadError ? (
                /* Drag and Drop Upload Area */
                <div 
                  className="border-2 border-dashed border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 p-8 text-center rounded-lg flex flex-col items-center justify-center gap-4 transition-all duration-300"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const rawFiles = Array.from(e.dataTransfer.files || []);
                    if (rawFiles.length === 0) return;

                    const validFiles = rawFiles.filter(
                      (f) => f.size <= 5 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
                    );

                    if (validFiles.length < rawFiles.length) {
                      addToast(`${rawFiles.length - validFiles.length} file(s) ignored (exceeded 5MB or invalid format).`, 'info');
                    }
                    if (validFiles.length === 0) return;

                    if (removeBgToggle) {
                      processImageBackground(validFiles[0]);
                      if (validFiles.length > 1) {
                        uploadRemainingImagesDirectly(validFiles.slice(1));
                      }
                    } else {
                      uploadRemainingImagesDirectly(validFiles);
                    }
                  }}
                >
                  <Upload className="w-8 h-8 text-zinc-400" />
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 block">
                      Add Product Image
                    </span>
                    <span className="text-[10px] text-zinc-500 block">Drag & drop garment photo here, or use options below:</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 hover:border-zinc-350 text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-zinc-200 text-zinc-650 hover:text-zinc-900 hover:border-zinc-350 text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5 text-brand-red" />
                      Take Photo
                    </button>
                  </div>
                </div>
              ) : (
                /* AI Studio Studio Builder / Upload Progress & Error */
                <div className="bg-white border border-zinc-200 p-6 rounded-lg space-y-6 shadow-md">
                  <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-xs uppercase font-extrabold tracking-widest text-zinc-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-amber animate-pulse" />
                        Automated Image Pipeline
                      </span>
                      {processingImage && (
                        <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[280px]">File: {processingImage.name}</p>
                      )}
                    </div>
                    {(isRemovingBg || isUploading || isGeneratingDescription) && (
                      <span className="text-[10px] uppercase font-bold text-brand-red tracking-wider font-mono flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing...
                      </span>
                    )}
                  </div>

                  {/* Inline Error State */}
                  {uploadError && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-md space-y-3">
                      <div className="flex items-center gap-2 text-red-700 font-semibold text-xs">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Upload Error: {uploadError}</span>
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        Cloudinary upload encountered an issue. You can retry the upload, or cancel and manually paste a Cloudinary URL into the field above.
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={retryCloudinaryUpload}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700 transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Retry Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadError(null);
                            setProcessingImage(null);
                            setProcessingImgUrl(null);
                            setLastCutoutBlob(null);
                            setIsRemovingBg(false);
                            setIsUploading(false);
                            setBgRemovalStatus('');
                          }}
                          className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-xs font-bold uppercase rounded hover:bg-zinc-100 transition-colors"
                        >
                          Cancel & Fall Back to Manual Paste
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading Progress State */}
                  {bgRemovalStatus && (
                    <div className="space-y-2 bg-zinc-50 p-4 border border-zinc-200 rounded-md">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-widest block">
                        Processing & Uploading...
                      </span>
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-red shrink-0" />
                        <span className="text-xs text-zinc-600 font-body">{bgRemovalStatus}</span>
                      </div>
                    </div>
                  )}

                  {!isRemovingBg && processingImgUrl && dominantColor && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      {/* Interactive Composite Preview Canvas */}
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">Real-time studio composite</span>
                        <canvas 
                          ref={previewCanvasRef} 
                          className="w-full max-w-[220px] aspect-[3/4] border border-zinc-200 bg-zinc-50 rounded shadow-lg transition-all duration-300"
                          width={450}
                          height={600}
                        />
                      </div>

                      {/* Backdrop Choice Panels */}
                      <div className="space-y-4">
                        <span className="text-xs uppercase font-bold text-zinc-500 tracking-wider block border-b border-zinc-150 pb-2">Select Studio Backdrop</span>
                        <div className="grid grid-cols-1 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setActiveBgOption('neutral')}
                            className={`p-3 border rounded text-left transition-all ${
                              activeBgOption === 'neutral'
                                ? 'bg-zinc-50 border-zinc-900 text-zinc-900 shadow-sm'
                                : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider">Matched Neutral</span>
                              <div className="w-3.5 h-3.5 rounded-full border border-zinc-800" style={{ backgroundColor: `hsl(${rgbToHsl(dominantColor.r, dominantColor.g, dominantColor.b).h}, 10%, 93%)` }} />
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1">Soft complementary desaturated tone derived from garment pixels.</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveBgOption('dark')}
                            className={`p-3 border rounded text-left transition-all ${
                              activeBgOption === 'dark'
                                ? 'bg-zinc-900 border-zinc-900 text-white'
                                : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider">Charcoal Brand Dark</span>
                              <div className="w-3.5 h-3.5 rounded-full border border-zinc-800 bg-[#121212]" />
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1">Standard dark studio catalog backdrop (#121212).</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveBgOption('gradient')}
                            className={`p-3 border rounded text-left transition-all ${
                              activeBgOption === 'gradient'
                                ? 'bg-zinc-50 border-zinc-900 text-zinc-900 shadow-sm'
                                : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider">Studio Soft Gradient</span>
                              <div className="w-3.5 h-3.5 rounded-full border border-zinc-800" style={{ background: `linear-gradient(135deg, hsl(${rgbToHsl(dominantColor.r, dominantColor.g, dominantColor.b).h}, 15%, 88%), hsl(${rgbToHsl(dominantColor.r, dominantColor.g, dominantColor.b).h}, 8%, 70%))` }} />
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1">Responsive radial light dispersion centering the product details.</p>
                          </button>
                        </div>

                        {/* Interactive triggers */}
                        <div className="flex gap-3 pt-3 flex-wrap">
                          <button
                            type="button"
                            onClick={handleApplyAndUpload}
                            disabled={isUploading}
                            className="flex-[2] bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-900 text-[11px] font-extrabold uppercase tracking-widest py-2.5 px-4 rounded shadow-sm transition-all disabled:opacity-50 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 min-w-[150px]"
                          >
                            {isUploading ? 'Uploading...' : 'Apply & Add to Gallery'}
                          </button>
                          <button
                            type="button"
                            onClick={handleUploadOriginal}
                            disabled={isUploading}
                            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold uppercase tracking-widest py-2.5 px-4 rounded transition-all disabled:opacity-50 whitespace-nowrap shadow-sm disabled:bg-zinc-150 disabled:text-zinc-400"
                            title="Skip AI Cutout and use the original image"
                          >
                            Use Original
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProcessingImage(null);
                              setProcessingImgUrl(null);
                              setDominantColor(null);
                            }}
                            disabled={isUploading}
                            className="px-4 py-2.5 border border-zinc-200 hover:border-zinc-300 text-zinc-500 hover:text-zinc-900 text-[11px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar View */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-3 bg-zinc-50 p-4 border border-zinc-200 rounded">
                  <span className="text-xs uppercase font-bold text-zinc-500 font-mono tracking-wider block">Uploading Files ({uploadingFiles.length})</span>
                  <div className="space-y-2">
                    {uploadingFiles.map((file, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <span>{file.progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-zinc-900 h-full transition-all duration-200" 
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Thumbnail Grid */}
              {images.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Uploaded Images ({images.length})</span>
                    <div className="group relative flex items-center">
                      <HelpCircle className="w-3.5 h-3.5 text-zinc-500 cursor-help" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 leading-normal rounded shadow-xl hidden group-hover:block z-50 font-normal">
                        Drag thumbnails horizontally to reorder gallery. Click star to set main listing cover image.
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {images.map((url, idx) => {
                      const isDragTarget = draggedIndex !== null && draggedIndex !== idx;
                      return (
                        <div 
                          key={url} 
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(idx)}
                          className={`relative aspect-[3/4] bg-zinc-50 border border-zinc-200 group rounded-md overflow-hidden cursor-move transition-all duration-300 ${
                            draggedIndex === idx ? 'opacity-40 scale-95 border-zinc-900' : ''
                          } ${isDragTarget ? 'hover:border-zinc-400' : ''}`}
                        >
                          <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover select-none pointer-events-none hover:opacity-90 transition-opacity" />
                          
                          {/* Top-left Indicator (Cover status) */}
                          {idx === 0 && (
                            <div className="absolute top-2 left-2 bg-zinc-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider shadow pointer-events-none">
                              Cover
                            </div>
                          )}

                          {/* Hover Action Controls */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeImage(idx);
                                }}
                                className="p-1.5 bg-brand-black/80 hover:bg-brand-red text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                                title="Delete Image"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  makePrimary(idx);
                                }}
                                className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-[9px] font-bold uppercase tracking-wider cursor-pointer ${
                                  idx === 0
                                    ? 'bg-brand-red text-white'
                                    : 'bg-brand-black/80 hover:bg-brand-offwhite hover:text-brand-black text-zinc-400'
                                }`}
                                title={idx === 0 ? 'Primary Image' : 'Make Primary Cover'}
                              >
                                <Star className="w-3 h-3 fill-current" />
                                <span>Cover</span>
                              </button>
                              
                              <span className="font-mono text-[9px] bg-zinc-950/80 px-1 py-0.5 rounded">#{idx + 1}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-zinc-550 italic mt-2">
                    * Tip: Drag and drop preview frames to adjust sequence order on the product details page.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Attributes, Publishing, and Pricing details */}
        <div className="space-y-6">
          
          {/* Pricing */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-200/60 pb-3">
              Pricing Details
            </h2>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block font-mono">Retail Price (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold font-mono text-zinc-400 text-sm">₹</span>
                <input
                  type="number"
                  placeholder="e.g. 1299"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 pl-9 pr-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-mono"
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block font-mono">Compare Price (₹ MRP)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold font-mono text-zinc-400 text-sm">₹</span>
                <input
                  type="number"
                  placeholder="e.g. 1999"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 pl-9 pr-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-mono"
                  min="0"
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Strikethrough price. Leave blank if the product is not on discount.
              </p>
            </div>
          </div>

          {/* Shipping Details */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-6 text-left">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-200/60 pb-3">
              Shipping & Dimensions
            </h2>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Weight</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="e.g. 250"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="flex-1 bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-mono"
                  required
                  min="1"
                />
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value as 'g' | 'kg')}
                  className="bg-zinc-50 border border-zinc-200 text-zinc-900 px-3 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all font-bold"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Box Dimensions (Optional)</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">L (cm)</span>
                  <input
                    type="number"
                    placeholder="Length"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-zinc-950 transition-all font-mono"
                    min="1"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">B (cm)</span>
                  <input
                    type="number"
                    placeholder="Breadth"
                    value={breadth}
                    onChange={(e) => setBreadth(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-zinc-950 transition-all font-mono"
                    min="1"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">H (cm)</span>
                  <input
                    type="number"
                    placeholder="Height"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-zinc-950 transition-all font-mono"
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-6">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-200/60 pb-3">
              Classification
            </h2>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Category</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubcategory(''); // Reset subcategory when category changes
                }}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all uppercase tracking-wider font-bold"
                required
              >
                <option value="" disabled>[Select Category]</option>
                {categoriesList.filter(c => !c.parent_id && c.is_active).map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {category && (() => {
              const currentParent = categoriesList.find(c => c.slug === category);
              const subs = currentParent ? categoriesList.filter(c => c.parent_id === currentParent.id && c.is_active) : [];
              if (subs.length === 0) return null;
              return (
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Subcategory</label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all uppercase tracking-wider font-bold"
                  >
                    <option value="">[None] — No Subcategory</option>
                    {subs.map((sub) => (
                      <option key={sub.id} value={sub.slug}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Gender targeting</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all uppercase tracking-wider font-bold"
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visibility Controls */}
          <div className="bg-white border border-zinc-200/80 shadow-sm p-6 md:p-8 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest border-b border-zinc-200/60 pb-3 mb-2">
              Publishing Options
            </h2>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs uppercase font-bold text-zinc-900">Featured piece</span>
                <p className="text-[10px] text-zinc-500">Show on homepage featured rows</p>
              </div>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded border-zinc-300 bg-white text-zinc-900 focus:ring-zinc-900 w-4 h-4 cursor-pointer"
              />
            </div>

            {/* paired_with — optional override, only shown when featured */}
            {isFeatured && (
              <div className="pt-2 border-t border-zinc-200/60 space-y-1.5">
                <span className="text-xs uppercase font-bold text-zinc-900">Pair with (optional)</span>
                <p className="text-[10px] text-zinc-500">
                  Force this product to be paired with another featured product on The Edit.
                  Leave blank to let the auto-priority algorithm choose.
                </p>
                <select
                  value={pairedWith}
                  onChange={(e) => setPairedWith(e.target.value)}
                  className="w-full border border-zinc-200 bg-white text-zinc-900 text-xs py-2 px-3 rounded focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="">Auto-match (recommended)</option>
                  {featuredProducts
                    .filter((p) => p.id !== (initialData?.id ?? ''))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60">
              <div className="space-y-0.5">
                <span className="text-xs uppercase font-bold text-zinc-900">Is Active</span>
                <p className="text-[10px] text-zinc-500">Make visible to consumers immediately</p>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-zinc-300 bg-white text-zinc-900 focus:ring-zinc-900 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-900 font-extrabold uppercase tracking-widest text-xs py-4 px-6 rounded shadow-sm disabled:opacity-50 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200 transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-900" />}
            {isSaving ? 'Saving Piece...' : mode === 'create' ? 'Publish Piece' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Live storefront catalog card preview */}
      <div className="border-t border-zinc-200 pt-8 mt-12 space-y-6">
        <div>
          <h2 className="text-sm font-extrabold text-zinc-900 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-amber" />
            Live Storefront Grid Preview
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Shows exactly how this garment renders on the live COLLECTIONS store listing grid (refreshes in real-time).
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-sm sm:max-w-none">
          <div className="group flex flex-col product-card border border-zinc-200 bg-white p-4 rounded-md shadow-sm">
            {/* Image Container */}
            <div className="product-card-image bg-zinc-50 relative overflow-hidden aspect-[3/4]">
              {images[0] ? (
                <img
                  src={images[0]}
                  alt={name || 'Preview Piece'}
                  className="w-full h-full object-cover transition-transform duration-700 ease-luxury"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-50 text-[10px] uppercase font-bold tracking-widest font-mono p-4 text-center">
                  <span>No cover image</span>
                  <span className="text-[8px] text-zinc-500 font-normal lowercase mt-1">(upload / process image above)</span>
                </div>
              )}
              
              <div className="product-card-overlay" aria-hidden="true" />

              {/* Sale/Discount Badge */}
              {comparePrice && Number(comparePrice) > Number(price) && (
                <span className="absolute top-3 left-3 border border-zinc-200 bg-zinc-900/90 text-white text-[9px] tracking-[0.2em] font-semibold py-1 px-2.5 uppercase backdrop-blur-sm z-10">
                  Sale
                </span>
              )}
            </div>

            {/* Product Details */}
            <div className="pt-3 space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-semibold">
                {category || '[Category]'}
              </p>
              <h3 className="text-xs font-semibold text-zinc-800 tracking-wide uppercase line-clamp-1 group-hover:text-brand-red transition-colors duration-200 font-body">
                {name || 'Untitled Streetwear Piece'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 font-body">
                  ₹{Number(price) ? Number(price).toLocaleString('en-IN') : '0'}
                </span>
                {comparePrice && Number(comparePrice) > Number(price) && (
                  <span className="text-[10px] text-zinc-400 line-through font-mono">
                    ₹{Number(comparePrice).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
