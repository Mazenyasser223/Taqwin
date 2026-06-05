import type { Product, ShopCategory } from '../../types';

const SECTION_LIMIT = 8;

export function categorySlugs(cat: ShopCategory): Set<string> {
  return new Set([cat.slug, ...(cat.children?.map((c) => c.slug) ?? [])]);
}

export function productsInCategory(all: Product[], cat: ShopCategory, limit = SECTION_LIMIT): Product[] {
  const slugs = categorySlugs(cat);
  return all.filter((p) => p.category?.slug && slugs.has(p.category.slug)).slice(0, limit);
}

export function offerProducts(all: Product[], limit = SECTION_LIMIT): Product[] {
  return all.filter((p) => p.isOnSale || (p.compareAtPrice && p.compareAtPrice > p.price)).slice(0, limit);
}

export function groupByBrand(products: Product[]): { brand: string; items: Product[] }[] {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.brand.trim() || 'Other';
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([brand, items]) => ({ brand, items }));
}
