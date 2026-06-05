import type { CatalogPickItem } from './types';

export type WebtebFoodNameEntry = {
  nameAr: string;
  nameEn?: string | null;
  displayName: string;
};

export type WebtebFoodNameLookup = Record<string, WebtebFoodNameEntry>;

function isCatalogPickItem(x: unknown): x is CatalogPickItem {
  return x != null && typeof x === 'object' && 'id' in x && 'name' in x && 'catalog' in x;
}

/** Collect numeric WebTeb ids from stored catalog food picks in onboarding answers. */
export function collectFoodCatalogWebtebIds(data: Record<string, unknown> | null | undefined): number[] {
  if (!data || typeof data !== 'object') return [];
  const ids = new Set<number>();

  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (!isCatalogPickItem(entry) || entry.catalog !== 'food') continue;
      const n = Number(entry.id);
      if (Number.isFinite(n) && n > 0) ids.add(Math.floor(n));
    }
  }

  return [...ids];
}
