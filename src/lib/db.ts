import { Product, Category, Order, DiscountCode, StoreSettings, ContactSubmission } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Redis-backed product cache
//
// Replaces the previous per-process in-memory Map. On multi-instance serverless
// deployments (Vercel) each function cold-start had its own isolated cache,
// so a price/stock change in instance A was invisible to instance B for up to 60s.
// Redis is shared across all instances — one invalidation busts all of them.
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCT_CACHE_KEY = 'dbservice:products:active:v1';
const PRODUCT_CACHE_TTL_SEC = 60;

async function getProductsFromRedisCache(): Promise<any | null> {
  try {
    const { redis } = await import('@/lib/redis');
    const raw = await redis.get(PRODUCT_CACHE_KEY);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null; // Redis miss/error → fall through to Neon
  }
}

async function setProductsInRedisCache(data: any): Promise<void> {
  try {
    const { redis } = await import('@/lib/redis');
    await redis.set(PRODUCT_CACHE_KEY, JSON.stringify(data), { ex: PRODUCT_CACHE_TTL_SEC });
  } catch (err) {
    console.warn('[ProductCache] Failed to write Redis cache:', err);
  }
}

export async function clearProductCache(): Promise<void> {
  try {
    const { redis } = await import('@/lib/redis');
    await redis.del(PRODUCT_CACHE_KEY);
  } catch (err) {
    console.warn('[ProductCache] Failed to clear Redis cache:', err);
  }
}

function sanitizeProductFields(fields: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    // Integer dimension fields
    if (['length_cm', 'breadth_cm', 'height_cm'].includes(key)) {
      if (value === '' || value === null || value === false) {
        sanitized[key] = null;
      } else {
        const num = Number(value);
        sanitized[key] = isNaN(num) || num <= 0 ? null : Math.round(num);
      }
      continue;
    }

    if (key === 'weight_grams') {
      if (value === '' || value === null || value === false) {
        sanitized[key] = 250;
      } else {
        const num = Number(value);
        sanitized[key] = isNaN(num) || num <= 0 ? 250 : Math.round(num);
      }
      continue;
    }

    // UUID field paired_with
    if (key === 'paired_with') {
      if (!value || typeof value !== 'string' || value.trim() === '' || !/^[0-9a-fA-F-]{36}$/.test(value.trim())) {
        sanitized[key] = null;
      } else {
        sanitized[key] = value.trim();
      }
      continue;
    }

    // Text field subcategory
    if (key === 'subcategory') {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        sanitized[key] = null;
      } else {
        sanitized[key] = value.trim();
      }
      continue;
    }

    // Numeric field compare_price
    if (key === 'compare_price') {
      if (value === '' || value === null || value === 0) {
        sanitized[key] = null;
      } else {
        const num = Number(value);
        sanitized[key] = isNaN(num) || num <= 0 ? null : Math.round(num);
      }
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export const dbService = {
  // -----------------------------------------------------------------------
  // CATEGORIES
  // -----------------------------------------------------------------------
  async getCategories(): Promise<Category[]> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, asc } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.is_active, true))
        .orderBy(asc(schema.categories.display_order));
      
      return results.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        image_url: r.image_url || '',
        description: r.description || '',
        parent_id: r.parent_id || null,
        is_active: r.is_active,
        display_order: r.display_order || 0,
        created_at: r.created_at.toISOString(),
      }));
    } else {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      return data.categories || [];
    }
  },

  async getAllCategories(): Promise<Category[]> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { desc } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(schema.categories)
        .orderBy(desc(schema.categories.created_at));
      
      return results.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        image_url: r.image_url || '',
        description: r.description || '',
        parent_id: r.parent_id || null,
        is_active: r.is_active,
        display_order: r.display_order || 0,
        created_at: r.created_at.toISOString(),
      }));
    } else {
      const res = await fetch('/api/admin/categories');
      if (!res.ok) throw new Error('Failed to fetch admin categories');
      const data = await res.json();
      return data.categories || [];
    }
  },

  async createCategory(cat: Omit<Category, 'id'>): Promise<Category> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      
      const [inserted] = await db
        .insert(schema.categories)
        .values({
          name: cat.name,
          slug: cat.slug,
          image_url: cat.image_url,
          description: cat.description,
          parent_id: cat.parent_id,
          is_active: cat.is_active !== undefined ? cat.is_active : true,
          display_order: cat.display_order !== undefined ? cat.display_order : 0,
        })
        .returning();
      
      return {
        id: inserted.id,
        name: inserted.name,
        slug: inserted.slug,
        image_url: inserted.image_url || '',
        description: inserted.description || '',
        parent_id: inserted.parent_id || null,
        is_active: inserted.is_active,
        display_order: inserted.display_order || 0,
        created_at: inserted.created_at.toISOString(),
      };
    } else {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat),
      });
      if (!res.ok) throw new Error('Failed to create category');
      const data = await res.json();
      return data.category;
    }
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const [updated] = await db
        .update(schema.categories)
        .set({
          name: updates.name,
          slug: updates.slug,
          image_url: updates.image_url,
          description: updates.description,
          parent_id: updates.parent_id,
          is_active: updates.is_active,
          display_order: updates.display_order,
          updated_at: new Date(),
        })
        .where(eq(schema.categories.id, id))
        .returning();

      if (!updated) throw new Error('Category not found');

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        image_url: updated.image_url || '',
        description: updated.description || '',
        parent_id: updated.parent_id || null,
        is_active: updated.is_active,
        display_order: updated.display_order || 0,
        created_at: updated.created_at.toISOString(),
      };
    } else {
      const res = await fetch(`/api/admin/categories?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update category');
      const data = await res.json();
      return data.category;
    }
  },

  async deleteCategory(id: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const deleted = await db
        .delete(schema.categories)
        .where(eq(schema.categories.id, id))
        .returning();
      
      return deleted.length > 0;
    } else {
      const res = await fetch(`/api/admin/categories?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete category');
      }
      const data = await res.json();
      return data.success;
    }
  },

  // -----------------------------------------------------------------------
  // PRODUCTS
  // -----------------------------------------------------------------------
  async getProducts(): Promise<Product[]> {
    if (typeof window === 'undefined') {
      // ── Redis cache check ─────────────────────────────────────────────────
      const cachedData = await getProductsFromRedisCache();
      if (cachedData) return cachedData;

      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, desc, inArray, asc } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.is_active, true))
        .orderBy(desc(schema.products.created_at));
      
      if (results.length === 0) {
        await setProductsInRedisCache([]);
        return [];
      }

      const productIds = results.map((r: any) => r.id);
      const allImages = await db
        .select()
        .from(schema.productImages)
        .where(inArray(schema.productImages.product_id, productIds))
        .orderBy(asc(schema.productImages.sort_order));

      const allVariants = await db
        .select()
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.product_id, productIds))
        .orderBy(asc(schema.productVariants.created_at));

      const variantsByProductId = allVariants.reduce((acc: Record<string, any[]>, v: any) => {
        if (!acc[v.product_id]) acc[v.product_id] = [];
        acc[v.product_id].push({
          id: v.id,
          product_id: v.product_id,
          colour_name: v.colour_name,
          colour_hex: v.colour_hex,
          images: v.images || [],
          sizes: v.sizes || [],
          stock_quantity: v.stock_quantity || {},
          stock_qty: v.stock_qty || 0,
          sku: v.sku,
          price_override: v.price_override,
          is_active: v.is_active,
          created_at: v.created_at ? v.created_at.toISOString() : undefined,
        });
        return acc;
      }, {} as Record<string, any[]>);

      const imagesByProductId = allImages.reduce((acc: Record<string, string[]>, img: any) => {
        if (img.sort_order !== 99) {
          if (!acc[img.product_id]) acc[img.product_id] = [];
          acc[img.product_id].push(img.image_url);
        }
        return acc;
      }, {} as Record<string, string[]>);

      const hiddenImageByProductId = allImages.reduce((acc: Record<string, string>, img: any) => {
        if (img.sort_order === 99) {
          acc[img.product_id] = img.image_url;
        }
        return acc;
      }, {} as Record<string, string>);
      
      const formatted = results.map((r: any) => {
        const prodVariants = variantsByProductId[r.id] || [];
        const fallbackImgs = imagesByProductId[r.id] && imagesByProductId[r.id].length > 0
          ? imagesByProductId[r.id]
          : (prodVariants[0]?.images || r.images || []);

        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description || '',
          price: r.price,
          base_price: r.price,
          compare_price: r.compare_price || undefined,
          category: r.category,
          subcategory: r.subcategory || undefined,
          gender: r.gender,
          images: fallbackImgs,
          hidden_detail_image: hiddenImageByProductId[r.id] || undefined,
          sizes: r.sizes,
          stock_quantity: r.stock_quantity,
          is_featured: r.is_featured,
          paired_with: r.paired_with ?? null,
          is_active: r.is_active,
          weight_grams: r.weight_grams,
          length_cm: r.length_cm,
          breadth_cm: r.breadth_cm,
          height_cm: r.height_cm,
          units_sold: r.units_sold ?? 0,
          created_at: r.created_at.toISOString(),
          variants: prodVariants,
        };
      });

      // ── Write Redis cache ─────────────────────────────────────────────
      await setProductsInRedisCache(formatted);
      return formatted;
    } else {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      return data.products || [];
    }
  },

  async getAllProducts(): Promise<Product[]> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { desc, inArray, asc } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(schema.products)
        .orderBy(desc(schema.products.created_at));
      
      if (results.length === 0) return [];

      const productIds = results.map((r: any) => r.id);
      const allImages = await db
        .select()
        .from(schema.productImages)
        .where(inArray(schema.productImages.product_id, productIds))
        .orderBy(asc(schema.productImages.sort_order));

      const allVariants = await db
        .select()
        .from(schema.productVariants)
        .where(inArray(schema.productVariants.product_id, productIds))
        .orderBy(asc(schema.productVariants.created_at));

      const variantsByProductId = allVariants.reduce((acc: Record<string, any[]>, v: any) => {
        if (!acc[v.product_id]) acc[v.product_id] = [];
        acc[v.product_id].push({
          id: v.id,
          product_id: v.product_id,
          colour_name: v.colour_name,
          colour_hex: v.colour_hex,
          images: v.images || [],
          sizes: v.sizes || [],
          stock_quantity: v.stock_quantity || {},
          stock_qty: v.stock_qty || 0,
          sku: v.sku,
          price_override: v.price_override,
          is_active: v.is_active,
          created_at: v.created_at ? v.created_at.toISOString() : undefined,
        });
        return acc;
      }, {} as Record<string, any[]>);

      const imagesByProductId = allImages.reduce((acc: Record<string, string[]>, img: any) => {
        if (img.sort_order !== 99) {
          if (!acc[img.product_id]) acc[img.product_id] = [];
          acc[img.product_id].push(img.image_url);
        }
        return acc;
      }, {} as Record<string, string[]>);

      const hiddenImageByProductId = allImages.reduce((acc: Record<string, string>, img: any) => {
        if (img.sort_order === 99) {
          acc[img.product_id] = img.image_url;
        }
        return acc;
      }, {} as Record<string, string>);
      
      return results.map((r: any) => {
        const prodVariants = variantsByProductId[r.id] || [];
        const fallbackImgs = imagesByProductId[r.id] && imagesByProductId[r.id].length > 0
          ? imagesByProductId[r.id]
          : (prodVariants[0]?.images || r.images || []);

        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description || '',
          price: r.price,
          base_price: r.price,
          compare_price: r.compare_price || undefined,
          category: r.category,
          subcategory: r.subcategory || undefined,
          gender: r.gender,
          images: fallbackImgs,
          hidden_detail_image: hiddenImageByProductId[r.id] || undefined,
          sizes: r.sizes,
          stock_quantity: r.stock_quantity,
          is_featured: r.is_featured,
          paired_with: r.paired_with ?? null,
          is_active: r.is_active,
          weight_grams: r.weight_grams,
          length_cm: r.length_cm,
          breadth_cm: r.breadth_cm,
          height_cm: r.height_cm,
          created_at: r.created_at.toISOString(),
          variants: prodVariants,
        };
      });
    } else {
      const res = await fetch('/api/admin/products');
      if (!res.ok) throw new Error('Failed to fetch admin products');
      const data = await res.json();
      return data.products || [];
    }
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    if (typeof window === 'undefined') {
      const { dbHttp } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, and, asc } = await import('drizzle-orm');
      
      const [prod] = await dbHttp
        .select()
        .from(schema.products)
        .where(and(
          eq(schema.products.slug, slug),
          eq(schema.products.is_active, true)
        ))
        .limit(1);
      
      if (!prod) return null;

      // Parallelize image and variant fetches using stateless HTTP neon() connection
      const [productImgs, rawVariants] = await Promise.all([
        dbHttp
          .select()
          .from(schema.productImages)
          .where(eq(schema.productImages.product_id, prod.id))
          .orderBy(asc(schema.productImages.sort_order)),
        dbHttp
          .select()
          .from(schema.productVariants)
          .where(eq(schema.productVariants.product_id, prod.id))
          .orderBy(asc(schema.productVariants.created_at)),
      ]);

      const variants = rawVariants.map((v: any) => ({
        id: v.id,
        product_id: v.product_id,
        colour_name: v.colour_name,
        colour_hex: v.colour_hex,
        images: v.images || [],
        sizes: v.sizes || [],
        stock_quantity: v.stock_quantity || {},
        stock_qty: v.stock_qty || 0,
        sku: v.sku,
        price_override: v.price_override,
        is_active: v.is_active,
        created_at: v.created_at ? v.created_at.toISOString() : undefined,
      }));

      const images: string[] = [];
      let hiddenDetailImage: string | undefined = undefined;

      for (const img of productImgs) {
        if (img.sort_order === 99) {
          hiddenDetailImage = img.image_url;
        } else {
          images.push(img.image_url);
        }
      }

      const finalImgs = images.length > 0 ? images : (variants[0]?.images || prod.images || []);

      return {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        description: prod.description || '',
        price: prod.price,
        base_price: prod.price,
        compare_price: prod.compare_price || undefined,
        category: prod.category,
        subcategory: prod.subcategory || undefined,
        gender: prod.gender,
        images: finalImgs,
        hidden_detail_image: hiddenDetailImage,
        sizes: prod.sizes,
        stock_quantity: prod.stock_quantity,
        is_featured: prod.is_featured,
        paired_with: prod.paired_with ?? null,
        is_active: prod.is_active,
        weight_grams: prod.weight_grams,
        length_cm: prod.length_cm,
        breadth_cm: prod.breadth_cm,
        height_cm: prod.height_cm,
        created_at: prod.created_at.toISOString(),
        variants,
      };
    } else {
      const res = await fetch(`/api/products?slug=${slug}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch product');
      const data = await res.json();
      return data.product || null;
    }
  },

  async getRelatedProducts(category: string, currentProductId: string, limit = 4): Promise<Product[]> {
    if (typeof window === 'undefined') {
      const { dbHttp } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, ne, and, desc, inArray, asc } = await import('drizzle-orm');

      const rawList = await dbHttp
        .select()
        .from(schema.products)
        .where(and(
          eq(schema.products.category, category),
          ne(schema.products.id, currentProductId),
          eq(schema.products.is_active, true)
        ))
        .orderBy(desc(schema.products.created_at))
        .limit(limit);

      if (rawList.length === 0) return [];

      const pIds = rawList.map((p: any) => p.id);
      const [allImages, allVariants] = await Promise.all([
        dbHttp
          .select()
          .from(schema.productImages)
          .where(inArray(schema.productImages.product_id, pIds))
          .orderBy(asc(schema.productImages.sort_order)),
        dbHttp
          .select()
          .from(schema.productVariants)
          .where(inArray(schema.productVariants.product_id, pIds))
          .orderBy(asc(schema.productVariants.created_at)),
      ]);

      const imagesByProductId = allImages.reduce((acc: Record<string, string[]>, img: any) => {
        if (img.sort_order !== 99) {
          if (!acc[img.product_id]) acc[img.product_id] = [];
          acc[img.product_id].push(img.image_url);
        }
        return acc;
      }, {} as Record<string, string[]>);

      const variantsByProductId = allVariants.reduce((acc: Record<string, any[]>, v: any) => {
        if (!acc[v.product_id]) acc[v.product_id] = [];
        acc[v.product_id].push(v);
        return acc;
      }, {} as Record<string, any[]>);

      return rawList.map((prod: any) => {
        const prodVariants = variantsByProductId[prod.id] || [];
        const fallbackImgs = (imagesByProductId[prod.id] && imagesByProductId[prod.id].length > 0)
          ? imagesByProductId[prod.id]
          : (prodVariants[0]?.images && prodVariants[0].images.length > 0 ? prodVariants[0].images : (prod.images && prod.images.length > 0 ? prod.images : []));

        return {
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          description: prod.description || '',
          price: prod.price,
          base_price: prod.price,
          compare_price: prod.compare_price || undefined,
          category: prod.category,
          subcategory: prod.subcategory || undefined,
          gender: prod.gender,
          images: fallbackImgs,
          sizes: prod.sizes,
          stock_quantity: prod.stock_quantity,
          is_featured: prod.is_featured,
          paired_with: prod.paired_with ?? null,
          is_active: prod.is_active,
          weight_grams: prod.weight_grams,
          created_at: prod.created_at ? new Date(prod.created_at).toISOString() : new Date().toISOString(),
        };
      });
    } else {
      const res = await fetch(`/api/products?category=${category}&limit=${limit}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.products || [];
    }
  },

  async getHomepageProducts(limit?: number): Promise<Product[]> {
    if (typeof window === 'undefined') {
      const { dbHttp } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, desc, inArray, asc } = await import('drizzle-orm');

      let query = dbHttp
        .select()
        .from(schema.products)
        .where(eq(schema.products.is_active, true))
        .orderBy(desc(schema.products.is_featured), desc(schema.products.created_at));

      const rawList = limit ? await query.limit(limit) : await query;
      if (rawList.length === 0) return [];

      const pIds = rawList.map((p: any) => p.id);
      const [allImages, allVariants] = await Promise.all([
        dbHttp
          .select()
          .from(schema.productImages)
          .where(inArray(schema.productImages.product_id, pIds))
          .orderBy(asc(schema.productImages.sort_order)),
        dbHttp
          .select()
          .from(schema.productVariants)
          .where(inArray(schema.productVariants.product_id, pIds))
          .orderBy(asc(schema.productVariants.created_at)),
      ]);

      const imagesByProductId = allImages.reduce((acc: Record<string, string[]>, img: any) => {
        if (img.sort_order !== 99) {
          if (!acc[img.product_id]) acc[img.product_id] = [];
          acc[img.product_id].push(img.image_url);
        }
        return acc;
      }, {} as Record<string, string[]>);

      const variantsByProductId = allVariants.reduce((acc: Record<string, any[]>, v: any) => {
        if (!acc[v.product_id]) acc[v.product_id] = [];
        acc[v.product_id].push(v);
        return acc;
      }, {} as Record<string, any[]>);

      return rawList.map((prod: any) => {
        const prodVariants = variantsByProductId[prod.id] || [];
        const fallbackImgs = (imagesByProductId[prod.id] && imagesByProductId[prod.id].length > 0)
          ? imagesByProductId[prod.id]
          : (prodVariants[0]?.images && prodVariants[0].images.length > 0 ? prodVariants[0].images : (prod.images && prod.images.length > 0 ? prod.images : []));

        return {
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          description: prod.description || '',
          price: prod.price,
          base_price: prod.price,
          compare_price: prod.compare_price || undefined,
          category: prod.category,
          subcategory: prod.subcategory || undefined,
          gender: prod.gender,
          images: fallbackImgs,
          sizes: prod.sizes,
          stock_quantity: prod.stock_quantity,
          is_featured: prod.is_featured,
          paired_with: prod.paired_with ?? null,
          is_active: prod.is_active,
          weight_grams: prod.weight_grams,
          created_at: prod.created_at ? new Date(prod.created_at).toISOString() : new Date().toISOString(),
        };
      });
    } else {
      const url = limit ? `/api/products?limit=${limit}` : `/api/products`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.products || [];
    }
  },

  async getCategoryThumbnails(): Promise<Record<string, string>> {
    if (typeof window === 'undefined') {
      const { unstable_cache } = await import('next/cache');
      
      const fetchCachedThumbnails = unstable_cache(
        async () => {
          const { dbHttp } = await import('@/db');
          const schema = await import('@/db/schema');
          const { eq, desc, inArray, asc } = await import('drizzle-orm');

          // Fetch active products
          const prods = await dbHttp
            .select()
            .from(schema.products)
            .where(eq(schema.products.is_active, true))
            .orderBy(desc(schema.products.created_at));

          if (prods.length === 0) return { all: '' };

          // Fetch all images & variants in batch
          const pIds = prods.map((p: any) => p.id);
          const [allImages, allVariants] = await Promise.all([
            dbHttp
              .select()
              .from(schema.productImages)
              .where(inArray(schema.productImages.product_id, pIds))
              .orderBy(asc(schema.productImages.sort_order)),
            dbHttp
              .select()
              .from(schema.productVariants)
              .where(inArray(schema.productVariants.product_id, pIds))
              .orderBy(asc(schema.productVariants.created_at)),
          ]);

          const imagesByProductId = allImages.reduce((acc: Record<string, string[]>, img: any) => {
            if (img.sort_order !== 99) {
              if (!acc[img.product_id]) acc[img.product_id] = [];
              acc[img.product_id].push(img.image_url);
            }
            return acc;
          }, {} as Record<string, string[]>);

          const variantsByProductId = allVariants.reduce((acc: Record<string, any[]>, v: any) => {
            if (!acc[v.product_id]) acc[v.product_id] = [];
            acc[v.product_id].push(v);
            return acc;
          }, {} as Record<string, any[]>);

          const getPrimaryImage = (p: any) => {
            if (imagesByProductId[p.id] && imagesByProductId[p.id].length > 0) {
              return imagesByProductId[p.id][0];
            }
            const pVars = variantsByProductId[p.id] || [];
            if (pVars[0]?.images && pVars[0].images.length > 0) {
              return pVars[0].images[0];
            }
            if (p.images && p.images.length > 0) {
              return p.images[0];
            }
            return '';
          };

          const thumbnails: Record<string, string> = {};

          // Select for each category
          const categories = Array.from(new Set(prods.map((p: any) => p.category)));
          for (const cat of categories) {
            const catProds = prods.filter((p: any) => p.category === cat);
            // Try featured products first, then most recently created active product
            const featured = catProds.filter((p: any) => p.is_featured);
            const chosen = featured.length > 0 ? featured[0] : catProds[0];
            if (cat) {
              thumbnails[cat as string] = getPrimaryImage(chosen);
            }
          }

          // Select overall for 'all' (overall featured, else most recent product image)
          const overallFeatured = prods.filter((p: any) => p.is_featured);
          const overallChosen = overallFeatured.length > 0 ? overallFeatured[0] : prods[0];
          thumbnails['all'] = getPrimaryImage(overallChosen);

          return thumbnails;
        },
        ['category-thumbnails-cache-key'],
        { revalidate: 600, tags: ['category-thumbnails'] }
      );

      return fetchCachedThumbnails();
    } else {
      const res = await fetch('/api/categories/thumbnails');
      const data = await res.json();
      return data.thumbnails || { all: '' };
    }
  },

  async createProduct(prod: Omit<Product, 'id'> & { base_price?: number; variants?: any[] }): Promise<Product> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      
      const priceVal = prod.base_price ?? prod.price;

      const rawInsertData = {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: priceVal,
        compare_price: prod.compare_price,
        category: prod.category,
        subcategory: prod.subcategory,
        gender: prod.gender,
        sizes: prod.sizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        stock_quantity: prod.stock_quantity || { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
        is_featured: prod.is_featured !== undefined ? prod.is_featured : false,
        paired_with: prod.paired_with,
        is_active: prod.is_active !== undefined ? prod.is_active : true,
        weight_grams: prod.weight_grams,
        length_cm: prod.length_cm,
        breadth_cm: prod.breadth_cm,
        height_cm: prod.height_cm,
      };

      const cleanInsertData = sanitizeProductFields(rawInsertData);

      const [inserted] = await db
        .insert(schema.products)
        .values(cleanInsertData as any)
        .returning();

      if (prod.images && prod.images.length > 0) {
        await db.insert(schema.productImages).values(
          prod.images.map((img, index) => ({
            product_id: inserted.id,
            image_url: img,
            sort_order: index,
            alt_text: `${inserted.name} - Image ${index + 1}`
          }))
        );
      }

      // Create product_variants — only if the user explicitly provided them (optional)
      const variantsToCreate = prod.variants && prod.variants.length > 0 ? prod.variants : [];

      const insertedVariants: any[] = [];
      for (const v of variantsToCreate) {
        const stockMap = v.stock_quantity || { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
        const totalStock = Object.values(stockMap).reduce((a: number, b: any) => a + Number(b || 0), 0);
        const [vRow] = await db
          .insert(schema.productVariants)
          .values({
            product_id: inserted.id,
            colour_name: v.colour_name || 'Standard',
            colour_hex: v.colour_hex || null,
            images: v.images || [],
            sizes: v.sizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
            stock_quantity: stockMap,
            stock_qty: totalStock,
            sku: v.sku || `DRFTN-${inserted.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${(v.colour_name || 'VAR').toUpperCase().slice(0, 5)}-${Math.floor(100 + Math.random() * 900)}`,
            price_override: v.price_override ? Number(v.price_override) : null,
            is_active: v.is_active !== undefined ? v.is_active : true,
          })
          .returning();
        
        insertedVariants.push({
          id: vRow.id,
          product_id: vRow.product_id,
          colour_name: vRow.colour_name,
          colour_hex: vRow.colour_hex,
          images: vRow.images || [],
          sizes: vRow.sizes || [],
          stock_quantity: vRow.stock_quantity || {},
          stock_qty: vRow.stock_qty || 0,
          sku: vRow.sku,
          price_override: vRow.price_override,
          is_active: vRow.is_active,
          created_at: vRow.created_at.toISOString(),
        });
      }

      // Seed Redis stock gate keys
      try {
        const { redis } = await import('@/lib/redis');
        for (const [size, qty] of Object.entries(inserted.stock_quantity || {})) {
          await redis.set(`stock:${inserted.id}:${size}`, qty);
        }
      } catch (redisErr) {
        console.error('Failed to seed Redis stock gate on createProduct:', redisErr);
      }

      // Bust the shared product cache so all instances see the new product
      await clearProductCache();

      return {
        id: inserted.id,
        name: inserted.name,
        slug: inserted.slug,
        description: inserted.description || '',
        price: inserted.price,
        base_price: inserted.price,
        compare_price: inserted.compare_price || undefined,
        category: inserted.category,
        subcategory: inserted.subcategory || undefined,
        gender: inserted.gender,
        images: prod.images || (insertedVariants[0]?.images || []),
        sizes: inserted.sizes,
        stock_quantity: inserted.stock_quantity,
        is_featured: inserted.is_featured,
        paired_with: inserted.paired_with ?? null,
        is_active: inserted.is_active,
        weight_grams: inserted.weight_grams,
        length_cm: inserted.length_cm,
        breadth_cm: inserted.breadth_cm,
        height_cm: inserted.height_cm,
        created_at: inserted.created_at.toISOString(),
        variants: insertedVariants,
      };
    } else {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prod),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create product');
      }
      const data = await res.json();
      return data.product;
    }
  },

  async updateProduct(id: string, updates: Partial<Product> & { base_price?: number; variants?: any[] }): Promise<Product> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, asc } = await import('drizzle-orm');
      
      const { images, variants, base_price, id: _id, created_at: _cat, units_sold: _us, ...productFields } = updates;

      const cleanFields = sanitizeProductFields(productFields);

      const [oldProduct] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, id));

      const updateData: any = {
        ...cleanFields,
        updated_at: new Date(),
      };
      if (base_price !== undefined) {
        const pNum = Number(base_price);
        if (!isNaN(pNum) && pNum > 0) updateData.price = Math.round(pNum);
      }

      let updated: any;
      try {
        const [res] = await db
          .update(schema.products)
          .set(updateData)
          .where(eq(schema.products.id, id))
          .returning();
        updated = res;
      } catch (updateErr: any) {
        console.warn('[updateProduct] Primary update failed:', updateErr?.message || updateErr);
        if (updateErr?.message?.includes('slug') || updateErr?.message?.includes('unique constraint') || updateErr?.code === '23505') {
          console.warn(`[updateProduct] Slug collision for "${updateData.slug}". Retrying with original slug...`);
          if (oldProduct?.slug) {
            updateData.slug = oldProduct.slug;
          } else {
            updateData.slug = `${updateData.slug}-${Math.floor(100 + Math.random() * 900)}`;
          }
          const [res] = await db
            .update(schema.products)
            .set(updateData)
            .where(eq(schema.products.id, id))
            .returning();
          updated = res;
        } else {
          console.error('[updateProduct] Unrecoverable DB update error:', updateErr);
          throw updateErr;
        }
      }

      if (!updated) throw new Error('Product not found');

      // Sync variants if provided — variants is always sent (empty [] = no variants for this product)
      if (variants !== undefined && Array.isArray(variants)) {
        // Delete existing variants, then re-insert whatever was submitted (may be empty)
        await db.delete(schema.productVariants).where(eq(schema.productVariants.product_id, id));
        for (const v of variants) {
          const stockMap = v.stock_quantity || { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
          const totalStock = Object.values(stockMap).reduce((a: number, b: any) => a + Number(b || 0), 0);
          await db.insert(schema.productVariants).values({
            product_id: id,
            colour_name: v.colour_name || 'Standard',
            colour_hex: v.colour_hex || null,
            images: v.images || [],
            sizes: v.sizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
            stock_quantity: stockMap,
            stock_qty: totalStock,
            sku: v.sku || `DRFTN-${updated.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${(v.colour_name || 'VAR').toUpperCase().slice(0, 5)}-${Math.floor(100 + Math.random() * 900)}`,
            price_override: v.price_override ? Number(v.price_override) : null,
            is_active: v.is_active !== undefined ? v.is_active : true,
          });
        }
      }

      // Update Redis stock gate keys
      if (updates.stock_quantity) {
        try {
          const { redis } = await import('@/lib/redis');
          for (const [size, qty] of Object.entries(updated.stock_quantity as Record<string, number> || {})) {
            await redis.set(`stock:${updated.id}:${size}`, qty);
          }
        } catch (redisErr) {
          console.error('Failed to update Redis stock gate on updateProduct:', redisErr);
        }
      }

      // Bust the shared product cache so all instances see updated price/stock
      await clearProductCache();

      // Check if stock went from 0 to >0
      if (oldProduct && updates.stock_quantity) {
        const oldTotalStock = Object.values(oldProduct.stock_quantity as Record<string, number>).reduce((a, b) => a + b, 0);
        const newTotalStock = Object.values(updated.stock_quantity as Record<string, number>).reduce((a, b) => a + b, 0);
        
        if (oldTotalStock === 0 && newTotalStock > 0) {
          try {
            const { pushSubscriptions } = await import('@/db/schema');
            const { isNull, and } = await import('drizzle-orm');
            const { sendPushNotification } = await import('@/lib/push');

            const subscribers = await db
              .select()
              .from(pushSubscriptions)
              .where(
                and(
                  eq(pushSubscriptions.product_id, id),
                  isNull(pushSubscriptions.notified_at)
                )
              );
            
            if (subscribers.length > 0) {
              const payload = {
                title: 'Back in Stock!',
                body: `${updated.name} is now back in stock. Grab yours before it's gone again.`,
                url: `/shop/${updated.slug}`,
              };
              
              await Promise.allSettled(
                subscribers.map((sub: any) => sendPushNotification(sub, payload))
              );
              
              await db
                .update(pushSubscriptions)
                .set({ notified_at: new Date() })
                .where(
                  and(
                    eq(pushSubscriptions.product_id, id),
                    isNull(pushSubscriptions.notified_at)
                  )
                );
            }
          } catch (e) {
            console.error('Failed to process restock notifications:', e);
          }
        }
      }

      if (images !== undefined) {
        await db.delete(schema.productImages).where(eq(schema.productImages.product_id, id));
        if (images.length > 0) {
          await db.insert(schema.productImages).values(
            images.map((img, index) => ({
              product_id: id,
              image_url: img,
              sort_order: index,
              alt_text: `${updated.name} - Image ${index + 1}`
            }))
          );
        }
      }

      const productImgs = await db
        .select()
        .from(schema.productImages)
        .where(eq(schema.productImages.product_id, id))
        .orderBy(asc(schema.productImages.sort_order));

      const updatedVariants = await db
        .select()
        .from(schema.productVariants)
        .where(eq(schema.productVariants.product_id, id))
        .orderBy(asc(schema.productVariants.created_at));

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description || '',
        price: updated.price,
        base_price: updated.price,
        compare_price: updated.compare_price || undefined,
        category: updated.category,
        subcategory: updated.subcategory || undefined,
        gender: updated.gender,
        images: productImgs.map((img: any) => img.image_url),
        sizes: updated.sizes,
        stock_quantity: updated.stock_quantity,
        is_featured: updated.is_featured,
        paired_with: updated.paired_with ?? null,
        is_active: updated.is_active,
        weight_grams: updated.weight_grams,
        length_cm: updated.length_cm,
        breadth_cm: updated.breadth_cm,
        height_cm: updated.height_cm,
        created_at: updated.created_at.toISOString(),
        variants: updatedVariants.map((v: any) => ({
          id: v.id,
          product_id: v.product_id,
          colour_name: v.colour_name,
          colour_hex: v.colour_hex,
          images: v.images || [],
          sizes: v.sizes || [],
          stock_quantity: v.stock_quantity || {},
          stock_qty: v.stock_qty || 0,
          sku: v.sku,
          price_override: v.price_override,
          is_active: v.is_active,
          created_at: v.created_at ? v.created_at.toISOString() : undefined,
        })),
      };
    } else {
      const res = await fetch(`/api/admin/products?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update product');
      }
      const data = await res.json();
      return data.product;
    }
  },

  async checkProductSimilarity(name: string): Promise<{ matched: boolean; product?: { id: string; name: string; slug: string } }> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { sql } = await import('drizzle-orm');

      const cleanName = name.trim();
      if (!cleanName || cleanName.length < 2) return { matched: false };

      try {
        const results: any = await db.execute(
          sql`SELECT id, name, slug, similarity(name, ${cleanName}) as score FROM products WHERE similarity(name, ${cleanName}) > 0.4 ORDER BY score DESC LIMIT 1;`
        );
        const row = (results.rows || results)[0] as any;
        if (row && row.id) {
          return {
            matched: true,
            product: { id: row.id, name: row.name, slug: row.slug },
          };
        }
      } catch (pgErr) {
        console.warn('[dbService] pg_trgm similarity check failed, falling back to JS normalized check:', pgErr);
      }

      const allProds = await db.select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug }).from(schema.products);
      const targetNorm = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const p of allProds) {
        const pNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (pNorm === targetNorm || (targetNorm.length > 3 && pNorm.includes(targetNorm)) || (pNorm.length > 3 && targetNorm.includes(pNorm))) {
          return {
            matched: true,
            product: { id: p.id, name: p.name, slug: p.slug },
          };
        }
      }

      return { matched: false };
    } else {
      const res = await fetch(`/api/admin/products/check-similarity?name=${encodeURIComponent(name)}`);
      if (!res.ok) return { matched: false };
      return await res.json();
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const deleted = await db
        .delete(schema.products)
        .where(eq(schema.products.id, id))
        .returning();

      // Bust the shared product cache so the deleted product disappears immediately
      await clearProductCache();

      return deleted.length > 0;
    } else {
      const res = await fetch(`/api/admin/products?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete product');
      const data = await res.json();
      return data.success;
    }
  },

  // -----------------------------------------------------------------------
  // ORDERS
  // -----------------------------------------------------------------------
  async getOrders(): Promise<Order[]> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { desc } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.created_at));

      return results.map((r: any) => ({
        id: r.id,
        order_number: r.order_number,
        customer_name: r.customer_name,
        customer_email: r.customer_email,
        customer_phone: r.customer_phone,
        shipping_address: r.shipping_address,
        items: r.items,
        subtotal: r.subtotal,
        shipping_charge: r.shipping_charge,
        total: r.total,
        payment_status: r.payment_status === 'refunded' ? 'failed' : r.payment_status,
        payment_id: r.payment_id || undefined,
        order_status: r.order_status,
        fulfillment_type: r.fulfillment_type || 'delivery',
        pickup_status: r.pickup_status || null,
        pickup_code: r.pickup_code || null,
        tracking_number: r.tracking_number || undefined,
        courier_partner: r.courier_partner || undefined,
        courier_provider: r.courier_provider || null,
        zone: r.zone || null,
        invoice_number: r.invoice_number || null,
        payment_type: r.payment_type || 'prepaid',
        deposit_amount: r.deposit_amount || null,
        remaining_amount: r.remaining_amount || null,
        deposit_status: r.deposit_status || null,
        verified_phone: r.verified_phone || null,
        created_at: r.created_at.toISOString(),
      }));
    } else {
      const res = await fetch('/api/admin/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      return data.orders || [];
    }
  },

  async getOrderById(id: string): Promise<Order | null> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const [r] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, id))
        .limit(1);

      if (!r) return null;

      return {
        id: r.id,
        order_number: r.order_number,
        customer_name: r.customer_name,
        customer_email: r.customer_email,
        customer_phone: r.customer_phone,
        shipping_address: r.shipping_address,
        items: r.items,
        subtotal: r.subtotal,
        shipping_charge: r.shipping_charge,
        total: r.total,
        payment_status: r.payment_status === 'refunded' ? 'failed' : r.payment_status,
        payment_id: r.payment_id || undefined,
        order_status: r.order_status,
        fulfillment_type: r.fulfillment_type || 'delivery',
        pickup_status: r.pickup_status || null,
        pickup_code: r.pickup_code || null,
        tracking_number: r.tracking_number || undefined,
        courier_partner: r.courier_partner || undefined,
        courier_provider: r.courier_provider || null,
        zone: r.zone || null,
        invoice_number: r.invoice_number || null,
        payment_type: r.payment_type || 'prepaid',
        deposit_amount: r.deposit_amount || null,
        remaining_amount: r.remaining_amount || null,
        deposit_status: r.deposit_status || null,
        verified_phone: r.verified_phone || null,
        created_at: r.created_at.toISOString(),
      };
    } else {
      const res = await fetch(`/api/admin/orders?id=${id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch order');
      const data = await res.json();
      return data.order || null;
    }
  },

  async getOrderByTracking(orderNumber: string, contact: string): Promise<Order | null> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const cleanNumber = orderNumber.trim().toUpperCase();
      const cleanContact = contact.trim().toLowerCase();

      const results = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.order_number, cleanNumber));

      const found = results.find((o: any) => 
        o.customer_phone.includes(cleanContact) || 
        o.customer_email.toLowerCase() === cleanContact
      );

      if (!found) return null;

      return {
        id: found.id,
        order_number: found.order_number,
        customer_name: found.customer_name,
        customer_email: found.customer_email,
        customer_phone: found.customer_phone,
        shipping_address: found.shipping_address,
        items: found.items,
        subtotal: found.subtotal,
        shipping_charge: found.shipping_charge,
        total: found.total,
        payment_status: found.payment_status === 'refunded' ? 'failed' : found.payment_status,
        payment_id: found.payment_id || undefined,
        order_status: found.order_status,
        tracking_number: found.tracking_number || undefined,
        courier_partner: found.courier_partner || undefined,
        payment_type: found.payment_type || 'prepaid',
        deposit_amount: found.deposit_amount || null,
        remaining_amount: found.remaining_amount || null,
        deposit_status: found.deposit_status || null,
        verified_phone: found.verified_phone || null,
        created_at: found.created_at.toISOString(),
      };
    } else {
      const res = await fetch(`/api/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(contact)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to track order');
      const data = await res.json();
      
      // Return order object mapped from sanitized tracker response
      return {
        id: 'track-order-id',
        order_number: data.order_number,
        customer_name: 'Customer',
        customer_email: '',
        customer_phone: contact,
        shipping_address: { line1: '', city: '', state: '', pincode: '' },
        items: data.items,
        subtotal: data.subtotal || 0,
        shipping_charge: data.shipping_charge || 0,
        total: data.total || 0,
        discount_amount: data.discount_amount || 0,
        payment_status: 'paid',
        order_status: data.order_status,
        tracking_number: data.tracking_number,
        courier_partner: data.courier_partner,
        created_at: data.created_at,
      };
    }
  },

  async createOrder(order: Omit<Order, 'id' | 'order_number' | 'created_at'>): Promise<Order> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { count } = await import('drizzle-orm');
      
      const resultOrder = await db.transaction(async (tx: any) => {
        const crypto = await import('crypto');
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let retries = 5;
        let insertedOrder: any = null;

        while (retries > 0) {
          const bytes = crypto.randomBytes(6);
          let randomStr = '';
          for (let i = 0; i < 6; i++) {
            randomStr += chars[bytes[i] % chars.length];
          }
          const orderNumber = `DRFTN-${randomStr}`;

          try {
            const [newOrder] = await tx.insert(schema.orders).values({
              order_number: orderNumber,
              customer_name: order.customer_name,
              customer_email: order.customer_email,
              customer_phone: order.customer_phone,
              shipping_address: order.shipping_address,
              items: order.items,
              subtotal: order.subtotal,
              shipping_charge: order.shipping_charge,
              discount_code: order.discount_code,
              discount_amount: order.discount_amount,
              total: order.total,
              payment_status: order.payment_status,
              payment_id: order.payment_id,
              order_status: order.order_status || 'placed',
              tracking_number: order.tracking_number,
              courier_partner: order.courier_partner,
            }).returning();

            insertedOrder = newOrder;
            break; // Insertion successful
          } catch (err: any) {
            const isUniqueViolation =
              err?.code === '23505' ||
              err?.message?.includes('orders_order_number_unique') ||
              err?.message?.includes('unique constraint');

            if (isUniqueViolation && retries > 1) {
              retries--;
              console.warn(`[OrderNumber Collision] ${orderNumber} already exists. Retrying with new random code (${retries} attempts left)...`);
            } else {
              throw err;
            }
          }
        }

        return insertedOrder;
      });

      return {
        id: resultOrder.id,
        order_number: resultOrder.order_number,
        customer_name: resultOrder.customer_name,
        customer_email: resultOrder.customer_email,
        customer_phone: resultOrder.customer_phone,
        shipping_address: resultOrder.shipping_address,
        items: resultOrder.items,
        subtotal: resultOrder.subtotal,
        shipping_charge: resultOrder.shipping_charge,
        total: resultOrder.total,
        payment_status: resultOrder.payment_status === 'refunded' ? 'failed' : resultOrder.payment_status,
        payment_id: resultOrder.payment_id || undefined,
        order_status: resultOrder.order_status,
        tracking_number: resultOrder.tracking_number || undefined,
        courier_partner: resultOrder.courier_partner || undefined,
        created_at: resultOrder.created_at.toISOString(),
      };
    } else {
      // client-side order creation handles calling create order API
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: order.items.map(i => ({ productId: i.id, size: i.size, quantity: i.quantity })),
          discountCode: order.discount_code || undefined,
          customerInfo: {
            name: order.customer_name,
            email: order.customer_email,
            phone: order.customer_phone,
            address: order.shipping_address
          }
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit order');
      }
      const data = await res.json();
      
      // Construct a minimal Order object to satisfy frontend return type
      return {
        id: data.orderId || 'temp-id',
        order_number: data.orderNumber || 'DRFTN-TEMP',
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        shipping_address: order.shipping_address,
        items: order.items,
        subtotal: order.subtotal,
        shipping_charge: order.shipping_charge,
        total: data.total || order.total,
        payment_status: order.payment_status,
        order_status: 'placed',
      };
    }
  },

  async updateOrderStatus(
    id: string,
    updates: {
      order_status?: Order['order_status'];
      payment_status?: Order['payment_status'];
      tracking_number?: string;
      courier_partner?: string;
      pickup_status?: Order['pickup_status'];
    }
  ): Promise<Order> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const [updated] = await db
        .update(schema.orders)
        .set({
          order_status: updates.order_status,
          payment_status: updates.payment_status as any,
          tracking_number: updates.tracking_number,
          courier_partner: updates.courier_partner,
          pickup_status: updates.pickup_status as any,
          updated_at: new Date(),
        })
        .where(eq(schema.orders.id, id))
        .returning();

      if (!updated) throw new Error('Order not found');

      return {
        id: updated.id,
        order_number: updated.order_number,
        customer_name: updated.customer_name,
        customer_email: updated.customer_email,
        customer_phone: updated.customer_phone,
        shipping_address: updated.shipping_address,
        items: updated.items,
        subtotal: updated.subtotal,
        shipping_charge: updated.shipping_charge,
        total: updated.total,
        payment_status: updated.payment_status === 'refunded' ? 'failed' : updated.payment_status,
        payment_id: updated.payment_id || undefined,
        order_status: updated.order_status,
        fulfillment_type: updated.fulfillment_type || 'delivery',
        pickup_status: updated.pickup_status || null,
        pickup_code: updated.pickup_code || null,
        tracking_number: updated.tracking_number || undefined,
        courier_partner: updated.courier_partner || undefined,
        created_at: updated.created_at.toISOString(),
      };
    } else {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: updates.order_status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      
      // Mock returned updated order
      return {
        id,
        order_number: 'DRFTN-UPDATED',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        shipping_address: { line1: '', city: '', state: '', pincode: '' },
        items: [],
        subtotal: 0,
        shipping_charge: 0,
        total: 0,
        payment_status: updates.payment_status || 'paid',
        order_status: updates.order_status || 'placed',
        tracking_number: updates.tracking_number,
        courier_partner: updates.courier_partner,
      };
    }
  },

  // -----------------------------------------------------------------------
  // DISCOUNT CODES
  // -----------------------------------------------------------------------
  async getDiscountCodes(): Promise<DiscountCode[]> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { desc } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(schema.discountCodes)
        .orderBy(desc(schema.discountCodes.created_at));

      return results.map((r: any) => ({
        id: r.id,
        code: r.code,
        discount_type: r.discount_type,
        discount_value: r.discount_value,
        min_order_value: r.min_order_value,
        usage_limit: r.usage_limit || undefined,
        used_count: r.used_count,
        is_active: r.is_active,
        expires_at: r.expires_at ? r.expires_at.toISOString() : undefined,
      }));
    } else {
      const res = await fetch('/api/admin/discounts');
      if (!res.ok) throw new Error('Failed to fetch discount codes');
      const data = await res.json();
      return data.discountCodes || [];
    }
  },

  async getDiscountCodeByCode(code: string): Promise<DiscountCode | null> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const cleanCode = code.toUpperCase().trim();
      const [discount] = await db
        .select()
        .from(schema.discountCodes)
        .where(and(
          eq(schema.discountCodes.code, cleanCode),
          eq(schema.discountCodes.is_active, true)
        ))
        .limit(1);

      if (!discount) return null;

      return {
        id: discount.id,
        code: discount.code,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        min_order_value: discount.min_order_value,
        usage_limit: discount.usage_limit || undefined,
        used_count: discount.used_count,
        is_active: discount.is_active,
        expires_at: discount.expires_at ? discount.expires_at.toISOString() : undefined,
      };
    } else {
      // Validate code by hitting validate endpoint with mock subtotal of ₹1000
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: 999900 }),
      });
      const data = await res.json();
      if (!data.valid) return null;
      return {
        id: 'coupon-code-id',
        code: code.toUpperCase().trim(),
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_order_value: 0,
        used_count: 0,
        is_active: true,
      };
    }
  },

  async createDiscountCode(discount: Omit<DiscountCode, 'id' | 'used_count'>): Promise<DiscountCode> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      
      const cleanCode = discount.code.toUpperCase().trim();
      const [inserted] = await db
        .insert(schema.discountCodes)
        .values({
          code: cleanCode,
          discount_type: discount.discount_type,
          discount_value: discount.discount_value,
          min_order_value: discount.min_order_value,
          usage_limit: discount.usage_limit,
          used_count: 0,
          is_active: discount.is_active !== undefined ? discount.is_active : true,
          expires_at: discount.expires_at ? new Date(discount.expires_at) : null,
        })
        .returning();

      return {
        id: inserted.id,
        code: inserted.code,
        discount_type: inserted.discount_type,
        discount_value: inserted.discount_value,
        min_order_value: inserted.min_order_value,
        usage_limit: inserted.usage_limit || undefined,
        used_count: inserted.used_count,
        is_active: inserted.is_active,
        expires_at: inserted.expires_at ? inserted.expires_at.toISOString() : undefined,
      };
    } else {
      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discount),
      });
      if (!res.ok) throw new Error('Failed to create discount code');
      const data = await res.json();
      return data.discountCode;
    }
  },

  async updateDiscountCode(id: string, updates: Partial<DiscountCode>): Promise<DiscountCode> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const updatesMap: any = { ...updates };
      if (updatesMap.code) updatesMap.code = updatesMap.code.toUpperCase().trim();
      if (updatesMap.expires_at !== undefined) updatesMap.expires_at = updatesMap.expires_at ? new Date(updatesMap.expires_at) : null;

      const [updated] = await db
        .update(schema.discountCodes)
        .set(updatesMap)
        .where(eq(schema.discountCodes.id, id))
        .returning();

      if (!updated) throw new Error('Discount code not found');

      return {
        id: updated.id,
        code: updated.code,
        discount_type: updated.discount_type,
        discount_value: updated.discount_value,
        min_order_value: updated.min_order_value,
        usage_limit: updated.usage_limit || undefined,
        used_count: updated.used_count,
        is_active: updated.is_active,
        expires_at: updated.expires_at ? updated.expires_at.toISOString() : undefined,
      };
    } else {
      const res = await fetch(`/api/admin/discounts?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update discount code');
      const data = await res.json();
      return data.discountCode;
    }
  },

  async deleteDiscountCode(id: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      
      const deleted = await db
        .delete(schema.discountCodes)
        .where(eq(schema.discountCodes.id, id))
        .returning();
      
      return deleted.length > 0;
    } else {
      const res = await fetch(`/api/admin/discounts?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete discount code');
      const data = await res.json();
      return data.success;
    }
  },

  async incrementDiscountCodeUsage(code: string): Promise<void> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, sql } = await import('drizzle-orm');
      
      const cleanCode = code.toUpperCase().trim();
      await db
        .update(schema.discountCodes)
        .set({ used_count: sql`${schema.discountCodes.used_count} + 1` })
        .where(eq(schema.discountCodes.code, cleanCode));
    }
  },

  // -----------------------------------------------------------------------
  // SETTINGS
  // -----------------------------------------------------------------------
  async getSettings(): Promise<StoreSettings> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      
      const rows = await db.select().from(schema.settings);
      
      const settingsObj: StoreSettings = {
        store_name: 'DRFTN CLOTHING',
        contact_number: '+91 7406164512',
        instagram_handle: '@drftnclothing',
        free_shipping_threshold: 99900,
        default_shipping_charge: 9900,
        razorpay_key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholderkey',
        razorpay_key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
        nimbuspost_api_key: process.env.SHIPROCKET_EMAIL || 'shiprocket_placeholder',
        blr_pincode_ranges: '560001-560300',
        borzo_surcharge: 15000,
        borzo_free_threshold: 149900,
        borzo_cutoff_start: '11:00',
        borzo_cutoff_end: '16:00',
        borzo_pickup_address: 'DRFTN Store, Yelahanka, Bengaluru',
      };

      rows.forEach((row: any) => {
        if (row.key === 'free_shipping_threshold') {
          settingsObj.free_shipping_threshold = Number(row.value);
        } else if (row.key === 'default_shipping_charge') {
          settingsObj.default_shipping_charge = Number(row.value);
        } else if (row.key === 'store_whatsapp') {
          settingsObj.contact_number = row.value;
        } else if (row.key === 'blr_pincode_ranges') {
          settingsObj.blr_pincode_ranges = row.value;
        } else if (row.key === 'borzo_surcharge') {
          settingsObj.borzo_surcharge = Number(row.value);
        } else if (row.key === 'borzo_free_threshold') {
          settingsObj.borzo_free_threshold = Number(row.value);
        } else if (row.key === 'borzo_cutoff_start') {
          settingsObj.borzo_cutoff_start = row.value;
        } else if (row.key === 'borzo_cutoff_end') {
          settingsObj.borzo_cutoff_end = row.value;
        } else if (row.key === 'borzo_pickup_address') {
          settingsObj.borzo_pickup_address = row.value;
        }
      });

      return settingsObj;
    } else {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      return data.settings;
    }
  },

  async updateSettings(updates: Partial<StoreSettings>): Promise<StoreSettings> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      
      const promises = Object.entries(updates).map(async ([key, value]) => {
        let dbKey = key;
        if (key === 'contact_number') dbKey = 'store_whatsapp';

        return db
          .insert(schema.settings)
          .values({ key: dbKey, value: String(value), updated_at: new Date() })
          .onConflictDoUpdate({
            target: schema.settings.key,
            set: { value: String(value), updated_at: new Date() },
          });
      });

      await Promise.all(promises);
      return this.getSettings();
    } else {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      const data = await res.json();
      return data.settings;
    }
  },

  // -----------------------------------------------------------------------
  // CONTACT SUBMISSIONS
  // -----------------------------------------------------------------------
  async createContactSubmission(sub: Omit<ContactSubmission, 'id'>): Promise<ContactSubmission> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      
      const [inserted] = await db
        .insert(schema.contactMessages)
        .values({
          name: sub.name,
          email: sub.email,
          message: sub.message,
        })
        .returning();

      return {
        id: inserted.id,
        name: inserted.name,
        email: inserted.email,
        message: inserted.message,
        created_at: inserted.created_at.toISOString(),
      };
    } else {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error('Failed to submit message');
      const data = await res.json();
      return data.submission;
    }
  },

  async getContactSubmissions(): Promise<ContactSubmission[]> {
    if (typeof window === 'undefined') {
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { desc } = await import('drizzle-orm');
      
      const results = await db
        .select()
        .from(schema.contactMessages)
        .orderBy(desc(schema.contactMessages.created_at));

      return results.map((r: any) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        message: r.message,
        created_at: r.created_at.toISOString(),
      }));
    } else {
      const res = await fetch('/api/admin/contacts');
      if (!res.ok) throw new Error('Failed to fetch submissions');
      const data = await res.json();
      return data.submissions || [];
    }
  },

  // -----------------------------------------------------------------------
  // WISHLIST (Neon PostgreSQL + Drizzle ORM)
  // -----------------------------------------------------------------------
  async ensureWishlistTableExists(): Promise<void> {
    if (typeof window === 'undefined') {
      try {
        const { db } = await import('@/db');
        const { sql } = await import('drizzle-orm');
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS wishlist (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT wishlist_user_product_unique UNIQUE(user_id, product_id)
          );
          CREATE INDEX IF NOT EXISTS wishlist_user_id_idx ON wishlist(user_id);
          CREATE INDEX IF NOT EXISTS wishlist_product_id_idx ON wishlist(product_id);
          
          ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;

          CREATE TABLE IF NOT EXISTS wishlist_campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_name TEXT NOT NULL,
            email_type TEXT NOT NULL,
            recipient_count INTEGER NOT NULL DEFAULT 0,
            subject TEXT NOT NULL,
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by TEXT
          );
        `);
      } catch (err) {
        console.warn('[Wishlist] Table creation notice:', err);
      }
    }
  },

  async getUserWishlistProducts(userId: string): Promise<Product[]> {
    if (typeof window === 'undefined') {
      await this.ensureWishlistTableExists();
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, desc } = await import('drizzle-orm');

      const wishlistRows = await db
        .select({ productId: schema.wishlist.product_id })
        .from(schema.wishlist)
        .where(eq(schema.wishlist.user_id, userId))
        .orderBy(desc(schema.wishlist.created_at));

      if (wishlistRows.length === 0) return [];

      const productIds = wishlistRows.map((r: any) => r.productId);
      const allProducts = await this.getProducts();
      const productMap = new Map(allProducts.map((p) => [p.id, p]));
      
      const result: Product[] = [];
      for (const id of productIds) {
        const found = productMap.get(id);
        if (found) result.push(found);
      }
      return result;
    } else {
      const res = await fetch('/api/wishlist');
      if (!res.ok) return [];
      const data = await res.json();
      return data.products || [];
    }
  },

  async getUserWishlistProductIds(userId: string): Promise<string[]> {
    if (typeof window === 'undefined') {
      await this.ensureWishlistTableExists();
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { eq, desc } = await import('drizzle-orm');

      const wishlistRows = await db
        .select({ productId: schema.wishlist.product_id })
        .from(schema.wishlist)
        .where(eq(schema.wishlist.user_id, userId))
        .orderBy(desc(schema.wishlist.created_at));

      return wishlistRows.map((r: any) => r.productId);
    } else {
      const res = await fetch('/api/wishlist?idsOnly=true');
      if (!res.ok) return [];
      const data = await res.json();
      return data.productIds || [];
    }
  },

  async addToWishlist(userId: string, productId: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      await this.ensureWishlistTableExists();
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      
      await db
        .insert(schema.wishlist)
        .values({
          user_id: userId,
          product_id: productId,
        })
        .onConflictDoNothing();
      return true;
    } else {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      return res.ok;
    }
  },

  async removeFromWishlist(userId: string, productId: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      await this.ensureWishlistTableExists();
      const { db } = await import('@/db');
      const schema = await import('@/db/schema');
      const { and, eq } = await import('drizzle-orm');

      await db
        .delete(schema.wishlist)
        .where(and(eq(schema.wishlist.user_id, userId), eq(schema.wishlist.product_id, productId)));
      return true;
    } else {
      const res = await fetch('/api/wishlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      return res.ok;
    }
  }
};

export const db = dbService;
export default dbService;
