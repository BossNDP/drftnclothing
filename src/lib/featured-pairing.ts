import type { Product } from '@/types';

export interface FeaturedSlidePair {
  id: string;
  label: string;
  leftProduct: Product;
  rightProduct: Product;
}

// Priority order — earlier = higher priority in pairing
const TOP_PRIORITY_ORDER = ['hoodie', 'sweatshirt', 't-shirt', 'shirt', 'jacket'];
const BOTTOM_PRIORITY_ORDER = ['denim-baggy', 'denim-relaxed', 'cargo', 'formal-pants', 'denim'];

const TOP_CATEGORIES = new Set([
  't-shirts', 'hoodies', 'sweatshirts', 'sweatshirt', 'shirts', 'jackets',
]);
const BOTTOM_CATEGORIES = new Set([
  'denims', 'formal-pants', 'pants', 'bottoms', 'cargo', 'shorts',
]);

const DEFAULT_LABELS = [
  'THE EDIT // 01',
  'HEAVYWEIGHT DROPS',
  'OVERSIZED SILHOUETTES',
  'CURATED ARCHIVE',
];

/** Returns priority index for a top (lower = higher priority) */
function topPriorityOf(p: Product): number {
  const cat = (p.category || '').toLowerCase().trim();
  const sub = (p.subcategory || '').toLowerCase().trim();
  const haystack = `${cat} ${sub}`;
  for (let i = 0; i < TOP_PRIORITY_ORDER.length; i++) {
    if (haystack.includes(TOP_PRIORITY_ORDER[i])) return i;
  }
  return TOP_PRIORITY_ORDER.length; // lowest priority
}

/** Returns priority index for a bottom (lower = higher priority) */
function bottomPriorityOf(p: Product): number {
  const cat = (p.category || '').toLowerCase().trim();
  const sub = (p.subcategory || '').toLowerCase().trim();
  const haystack = `${cat} ${sub}`;
  for (let i = 0; i < BOTTOM_PRIORITY_ORDER.length; i++) {
    if (haystack.includes(BOTTOM_PRIORITY_ORDER[i])) return i;
  }
  return BOTTOM_PRIORITY_ORDER.length;
}

/**
 * Auto-pairs 8 featured products into 4 paired slides.
 *
 * Algorithm (runs once at cache-generation time):
 * 1. Honor any manual `paired_with` overrides first.
 * 2. Sort remaining tops by TOP_PRIORITY_ORDER, bottoms by BOTTOM_PRIORITY_ORDER.
 * 3. Greedily match top[i] ↔ bottom[i].
 * 4. If uneven, pair same-category leftovers together as fallback.
 * 5. All featured products always appear — none dropped.
 */
export function pairFeaturedProducts(products: Product[]): FeaturedSlidePair[] {
  if (!products || products.length === 0) return [];

  // Normalize lookup map
  const byId = new Map<string, Product>(products.map((p) => [p.id, p]));
  const used = new Set<string>();
  const pairs: { left: Product; right: Product }[] = [];

  // ── PASS 1: Honor manual paired_with overrides ──────────────────────────
  for (const p of products) {
    if (used.has(p.id)) continue;
    const partnerId = p.paired_with;
    if (partnerId && byId.has(partnerId) && !used.has(partnerId)) {
      pairs.push({ left: p, right: byId.get(partnerId)! });
      used.add(p.id);
      used.add(partnerId);
    }
  }

  // ── PASS 2: Priority-sorted automatic pairing ────────────────────────────
  const remaining = products.filter((p) => !used.has(p.id));

  const tops = remaining
    .filter((p) => TOP_CATEGORIES.has((p.category || '').toLowerCase().trim()))
    .sort((a, b) => topPriorityOf(a) - topPriorityOf(b));

  const bottoms = remaining
    .filter((p) => BOTTOM_CATEGORIES.has((p.category || '').toLowerCase().trim()))
    .sort((a, b) => bottomPriorityOf(a) - bottomPriorityOf(b));

  const others = remaining.filter(
    (p) =>
      !TOP_CATEGORIES.has((p.category || '').toLowerCase().trim()) &&
      !BOTTOM_CATEGORIES.has((p.category || '').toLowerCase().trim())
  );

  // Greedily pair top[i] with bottom[i]
  while (tops.length > 0 && bottoms.length > 0) {
    const t = tops.shift()!;
    const b = bottoms.shift()!;
    used.add(t.id);
    used.add(b.id);
    pairs.push({ left: t, right: b });
  }

  // Remaining tops paired with each other
  while (tops.length >= 2) {
    const a = tops.shift()!;
    const b = tops.shift()!;
    used.add(a.id);
    used.add(b.id);
    pairs.push({ left: a, right: b });
  }

  // Remaining bottoms paired with each other
  while (bottoms.length >= 2) {
    const a = bottoms.shift()!;
    const b = bottoms.shift()!;
    used.add(a.id);
    used.add(b.id);
    pairs.push({ left: a, right: b });
  }

  // Pair any orphaned singles (tops, bottoms, others) together
  const singles = [...tops, ...bottoms, ...others].filter((p) => !used.has(p.id));
  while (singles.length >= 2) {
    const a = singles.shift()!;
    const b = singles.shift()!;
    used.add(a.id);
    used.add(b.id);
    pairs.push({ left: a, right: b });
  }
  // If still a single leftover, pair with first product (safety net)
  if (singles.length === 1 && products.length > 1) {
    const orphan = singles[0];
    const fallbackPartner = products.find((p) => p.id !== orphan.id)!;
    pairs.push({ left: orphan, right: fallbackPartner });
  }

  return pairs.slice(0, 4).map((pair, idx) => ({
    id: `slide-${idx + 1}`,
    label:
      (pair.left as any).featured_label ||
      (pair.right as any).featured_label ||
      DEFAULT_LABELS[idx] ||
      'THE EDIT',
    leftProduct: pair.left,
    rightProduct: pair.right,
  }));
}
