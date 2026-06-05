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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Horizontal fill for macro progress cards (logged vs target %). */
export function macroProgressFillBackground(color: string, percent: number, rtl = false): string {
  const [r, g, b] = hexToRgb(color);
  const base = `rgba(${r}, ${g}, ${b}, 0.08)`;
  const stop = percent <= 0 ? 0 : Math.max(8, Math.min(100, percent));
  if (stop <= 0) return base;
  const dir = rtl ? 'to left' : 'to right';
  return `linear-gradient(${dir}, rgba(${r}, ${g}, ${b}, 0.62) 0%, rgba(${r}, ${g}, ${b}, 0.42) ${stop}%, ${base} ${stop}%)`;
}
