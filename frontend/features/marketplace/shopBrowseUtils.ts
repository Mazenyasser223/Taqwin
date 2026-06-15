import type { ShopCategory, ShopCategoryChild } from '../../types';

export function findCategoryNode(
  categories: ShopCategory[],
  slug: string
): ShopCategory | ShopCategoryChild | null {
  for (const parent of categories) {
    if (parent.slug === slug) return parent;
    const walk = (nodes?: ShopCategoryChild[]): ShopCategoryChild | null => {
      if (!nodes) return null;
      for (const n of nodes) {
        if (n.slug === slug) return n;
        const deep = walk(n.children);
        if (deep) return deep;
      }
      return null;
    };
    const found = walk(parent.children);
    if (found) return found;
  }
  return null;
}

/** Full category path from root to slug (for product breadcrumbs). */
export function buildCategoryBreadcrumb(
  categories: ShopCategory[],
  slug: string | null,
  labelFor: (cat: { nameEn: string; nameAr?: string | null }) => string
): { label: string; slug: string }[] {
  if (!slug) return [];

  type Crumb = { label: string; slug: string };

  const walk = (
    nodes: ShopCategory[] | ShopCategoryChild[] | undefined,
    trail: Crumb[]
  ): Crumb[] | null => {
    if (!nodes) return null;
    for (const n of nodes) {
      const next: Crumb[] = [...trail, { label: labelFor(n), slug: n.slug }];
      if (n.slug === slug) return next;
      const deep = walk(n.children, next);
      if (deep) return deep;
    }
    return null;
  };

  return walk(categories, []) ?? [];
}

/** Root category + active slug when browsing a category tree. */
export function findBrowseRoot(
  categories: ShopCategory[],
  slug: string | null
): { root: ShopCategory; activeSlug: string } | null {
  if (!slug) return null;
  for (const parent of categories) {
    if (parent.slug === slug) return { root: parent, activeSlug: slug };
    const walk = (
      nodes: ShopCategoryChild[] | undefined,
      root: ShopCategory
    ): { root: ShopCategory; activeSlug: string } | null => {
      if (!nodes) return null;
      for (const n of nodes) {
        if (n.slug === slug) return { root, activeSlug: slug };
        const deep = walk(n.children, root);
        if (deep) return deep;
      }
      return null;
    };
    const found = walk(parent.children, parent);
    if (found) return found;
  }
  return null;
}

/** Direct subcategories for the horizontal strip (MFB-style). */
export function browseSubcategories(root: ShopCategory): ShopCategoryChild[] {
  return (root.children ?? []).filter((c) => (c.productCount ?? 0) > 0);
}
