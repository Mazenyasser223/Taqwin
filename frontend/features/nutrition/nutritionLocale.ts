import type { TranslationKey } from '../../lib/i18n/translations';
import type { AppLanguage } from '../../services/settingsService';
import { resolveCategoryId } from './nutritionCategoryTheme';

/** WebTeb serving-unit labels (Arabic) → English UI */
const SERVING_UNIT_EN: Record<string, string> = {
  غرام: 'gram',
  جرام: 'gram',
  كأس: 'cup',
  'كبير جدا': 'extra large',
  'كبير جداً': 'extra large',
  ضحم: 'jumbo',
  كبير: 'large',
  متوسط: 'medium',
  صغيرة: 'small',
  صغير: 'small',
};

export function catTranslationKey(categoryId: string): TranslationKey {
  return `nutrition.cat.${resolveCategoryId(categoryId)}` as TranslationKey;
}

export function resolveCategoryLabel(
  categoryId: string | null | undefined,
  foodCategory: string | null | undefined,
  t: (key: TranslationKey, params?: Record<string, string>) => string,
  language: AppLanguage
): string {
  if (categoryId) {
    const key = catTranslationKey(categoryId);
    const translated = t(key);
    if (translated !== key) return translated;
  }
  if (language === 'ar' && foodCategory) return foodCategory;
  if (foodCategory && language === 'en') {
    return foodCategory;
  }
  return foodCategory || t('nutrition.unknownCategory');
}

export function resolveFoodDisplayName(
  nameAr: string,
  nameEn: string | null | undefined,
  language: AppLanguage
): string {
  const ar = (nameAr || '').trim();
  const en = (nameEn || '').trim();
  if (language === 'en' && en) return en;
  return ar || en;
}

export function localizeServingUnitLabel(label: string, language: AppLanguage): string {
  const trimmed = (label || '').trim();
  if (!trimmed) return trimmed;
  if (language === 'ar') return trimmed;
  return SERVING_UNIT_EN[trimmed] ?? trimmed;
}

export function formatUnitWeightHint(
  grams: number,
  t: (key: TranslationKey, params?: Record<string, string>) => string
): string {
  return t('nutrition.unitWeightHint', { grams: String(grams) });
}

export { localizeNutrientName } from './webtebNutrientEn';

/** e.g. "100 غرام" → "100 gram" in English. */
export function localizeServingLabel(label: string | null | undefined, language: AppLanguage): string {
  const trimmed = (label || '').trim();
  if (!trimmed || language === 'ar') return trimmed;
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (m) return `${m[1]} ${localizeServingUnitLabel(m[2].trim(), language)}`;
  return localizeServingUnitLabel(trimmed, language);
}
