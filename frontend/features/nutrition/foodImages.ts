import manifest from '../../public/nutrition/foods/manifest.json';
import type { FdcFoodPreview } from '../../types';

const FOOD_IMAGE_BY_WEBTEB_ID: Record<string, string> = manifest;

/** Per-food photo from local nutrition folder; undefined when no mapped photo exists. */
export function foodImageUrl(food: Pick<FdcFoodPreview, 'webtebId'>): string | undefined {
  if (!food.webtebId) return undefined;
  return FOOD_IMAGE_BY_WEBTEB_ID[String(food.webtebId)];
}

export function hasFoodImage(webtebId?: number | null): boolean {
  if (!webtebId) return false;
  return Boolean(FOOD_IMAGE_BY_WEBTEB_ID[String(webtebId)]);
}

export function foodImageManifestCount(): number {
  return Object.keys(FOOD_IMAGE_BY_WEBTEB_ID).length;
}

/** Stable sort: foods with mapped photos first, preserve API order within each group. */
export function sortFoodsPhotosFirst<T extends { webtebId?: number | null }>(foods: T[]): T[] {
  const withPhoto: T[] = [];
  const without: T[] = [];
  for (const food of foods) {
    if (hasFoodImage(food.webtebId)) withPhoto.push(food);
    else without.push(food);
  }
  return withPhoto.length && without.length ? [...withPhoto, ...without] : foods;
}
