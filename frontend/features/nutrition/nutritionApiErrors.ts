import type { TranslationKey } from '../../lib/i18n/translations';

/** Map backend error strings to i18n keys (EN messages from API). */
const API_ERROR_KEYS: Record<string, TranslationKey> = {
  'WebTeb food database is not imported yet. Run: npm run import:webteb':
    'nutrition.errorWebtebNotImported',
  'Food not found in WebTeb database': 'nutrition.errorFoodNotFound',
  'Food item not found': 'nutrition.errorFoodItemNotFound',
  'Could not import food': 'nutrition.errorImportFailed',
  'Failed to load details': 'nutrition.errorDetailsFailed',
  'Internal server error': 'nutrition.errorGeneric',
  'Network error': 'nutrition.errorNetwork',
  aborted: 'nutrition.errorAborted',
};

export function mapNutritionApiError(
  message: string | undefined,
  t: (key: TranslationKey, params?: Record<string, string>) => string
): string {
  if (!message || message === 'aborted') return '';
  const key = API_ERROR_KEYS[message];
  if (key) return t(key);
  return message;
}
