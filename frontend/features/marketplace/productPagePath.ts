import type { Product } from '../../types';

/** SEO-friendly product page path (HashRouter). Falls back to query modal when no slug. */
export function productPagePath(product: Pick<Product, 'id' | 'slug'>): string | null {
  if (!product.slug?.trim()) return null;
  return `/marketplace/product/${encodeURIComponent(product.slug.trim())}`;
}
