/** Live search runs on the first non-whitespace character. */
export function minNutritionSearchLength(query: string): number {
  return query.trim().length > 0 ? 1 : 0;
}

export function shouldRunNutritionSearch(query: string): boolean {
  return query.trim().length >= 1;
}

export function buildNutritionSearchKey(q: string, categoryId: string | null): string {
  return `${categoryId ?? ''}\0${q.trim().toLowerCase()}`;
}

export const NUTRITION_SEARCH_DEBOUNCE_MS = 80;
