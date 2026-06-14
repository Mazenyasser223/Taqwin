import type { AppLanguage } from '../../services/settingsService';
import { resolveFoodDisplayName } from '../nutrition/nutritionLocale';
import { resolveExerciseDisplayName } from '../workouts/exerciseLocale';
import type { CatalogPickItem } from './types';
import type { WebtebFoodNameLookup } from './catalogFoodLookup';

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** Coerce API / onboarding / meal-plan name fields to a plain string (handles `{ name, webtebId }`). */
export function normalizeCatalogDisplayName(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value != null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('name' in o && ('webtebId' in o || 'id' in o || 'catalog' in o)) {
      const nested = normalizeCatalogDisplayName(o.name, '');
      if (nested) return nested;
    }
    for (const key of ['displayName', 'nameEn', 'name', 'nameAr', 'label']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return fallback;
}

function isStoredFoodPick(item: unknown): item is { name: unknown; webtebId?: unknown; id?: unknown } {
  return item != null && typeof item === 'object' && 'name' in item;
}

/** Pick the correct catalog item label for the active UI language. */
export function resolveCatalogPickName(
  item: CatalogPickItem | Record<string, unknown>,
  language: AppLanguage,
  foodLookup?: WebtebFoodNameLookup,
): string {
  const pick = item as CatalogPickItem;
  const nameText = normalizeCatalogDisplayName(pick.name, '');
  const catalog = pick.catalog ?? (isStoredFoodPick(item) && 'webtebId' in item ? 'food' : undefined);

  if (catalog === 'food') {
    const lookupKey = String(pick.id ?? (item as { webtebId?: unknown }).webtebId ?? '');
    const fromDb = lookupKey ? foodLookup?.[lookupKey] : undefined;
    if (fromDb?.displayName) return fromDb.displayName;
    if (fromDb) {
      return resolveFoodDisplayName(fromDb.nameAr, fromDb.nameEn, language);
    }

    const nameAr =
      normalizeCatalogDisplayName(pick.nameAr, '') ||
      (hasArabic(nameText) ? nameText : '');
    const nameEn =
      normalizeCatalogDisplayName(pick.nameEn, '') ||
      (!hasArabic(nameText) ? nameText : undefined);
    return resolveFoodDisplayName(nameAr || nameText, nameEn, language);
  }

  const nameEn =
    normalizeCatalogDisplayName(pick.nameEn, '') ||
    (!hasArabic(nameText) ? nameText : nameText);
  const nameAr =
    normalizeCatalogDisplayName(pick.nameAr, '') ||
    (hasArabic(nameText) ? nameText : null);

  return resolveExerciseDisplayName(
    {
      name: nameEn,
      nameAr,
      displayName: normalizeCatalogDisplayName(pick.displayName, '') || null,
    },
    language,
  );
}
