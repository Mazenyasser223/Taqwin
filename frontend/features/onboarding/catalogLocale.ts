import type { AppLanguage } from '../../services/settingsService';
import { resolveFoodDisplayName } from '../nutrition/nutritionLocale';
import { resolveExerciseDisplayName } from '../workouts/exerciseLocale';
import type { CatalogPickItem } from './types';
import type { WebtebFoodNameLookup } from './catalogFoodLookup';

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** Pick the correct catalog item label for the active UI language. */
export function resolveCatalogPickName(
  item: CatalogPickItem,
  language: AppLanguage,
  foodLookup?: WebtebFoodNameLookup,
): string {
  if (item.catalog === 'food') {
    const fromDb = foodLookup?.[item.id];
    if (fromDb?.displayName) return fromDb.displayName;
    if (fromDb) {
      return resolveFoodDisplayName(fromDb.nameAr, fromDb.nameEn, language);
    }

    const nameAr = item.nameAr ?? (hasArabic(item.name) ? item.name : '');
    const nameEn = item.nameEn ?? (!hasArabic(item.name) ? item.name : undefined);
    return resolveFoodDisplayName(nameAr || item.name, nameEn, language);
  }

  const nameEn = item.nameEn ?? (!hasArabic(item.name) ? item.name : item.name);
  const nameAr = item.nameAr ?? (hasArabic(item.name) ? item.name : null);

  return resolveExerciseDisplayName(
    {
      name: nameEn,
      nameAr,
      displayName: item.displayName,
    },
    language,
  );
}
