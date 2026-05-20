import type { FdcFoodPreview } from '../../types';

/** Food label in the active UI language (API sends name + nameEn). */
export function foodDisplayName(preview: FdcFoodPreview, lang: 'en' | 'ar'): string {
  if (lang === 'ar') return preview.name;
  return preview.nameEn ?? preview.name;
}

export function foodDisplayCategory(
  preview: FdcFoodPreview,
  lang: 'en' | 'ar',
  fallback = 'USDA',
): string {
  if (lang === 'ar') return preview.foodCategory || fallback;
  return preview.foodCategoryEn ?? preview.foodCategory ?? fallback;
}
