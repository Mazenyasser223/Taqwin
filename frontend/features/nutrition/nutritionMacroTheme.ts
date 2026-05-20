/** Shared macro colors — donut chart, food cards, filter panel dots. */
export const NUTRITION_MACRO_COLORS = {
  protein: '#a88fbc',
  carbs: '#60a5fa',
  fat: '#fbbf24',
  calories: '#f37021',
} as const;

export type NutritionMacroKey = keyof typeof NUTRITION_MACRO_COLORS;

export const NUTRITION_MACRO_DOT_CLASS: Record<NutritionMacroKey, string> = {
  protein: 'bg-[#a88fbc]',
  carbs: 'bg-[#60a5fa]',
  fat: 'bg-[#fbbf24]',
  calories: 'bg-accent',
};
