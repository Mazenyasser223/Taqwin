import type { ShopCategory } from '../../types';

/** Popular athlete shop categories — shown as quick filters & featured grid. */
export const SHOP_FEATURED_SLUGS = [
  'whey-protein',
  'creatine',
  'pre-workout',
  'protein-bars',
  'mass-gainers',
  'shakers',
  'vitamins',
  'home-equipment',
  'offers-and-discounts',
] as const;

export const SHOP_QUICK_FILTER_SLUGS = [
  'whey-protein',
  'creatine',
  'pre-workout',
  'protein-bars',
  'shakers',
  'vitamins',
] as const;

const MAX_HOME_SECTIONS = 6;
const MAX_FEATURED = 8;

export function pickFeaturedCategories(categories: ShopCategory[], limit = MAX_FEATURED): ShopCategory[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const picked: ShopCategory[] = [];

  for (const slug of SHOP_FEATURED_SLUGS) {
    const cat = bySlug.get(slug);
    if (cat && (cat.productCount ?? 0) > 0) picked.push(cat);
  }

  if (picked.length < limit) {
    const rest = [...categories]
      .filter((c) => (c.productCount ?? 0) > 0 && !picked.some((p) => p.slug === c.slug))
      .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0));
    for (const c of rest) {
      if (picked.length >= limit) break;
      picked.push(c);
    }
  }

  return picked.slice(0, limit);
}

export function pickHomeSectionCategories(categories: ShopCategory[], limit = MAX_HOME_SECTIONS): ShopCategory[] {
  return [...categories]
    .filter((c) => (c.productCount ?? 0) > 0)
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
    .slice(0, limit);
}

export function findCategoryBySlug(categories: ShopCategory[], slug: string): ShopCategory | undefined {
  return categories.find((c) => c.slug === slug);
}
