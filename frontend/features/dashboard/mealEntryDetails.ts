import type { NutritionFoodRow } from '../nutrition/NutritionFoodList';
import type { MealEditEntry } from './MealSlotInlineEditor';
import { planItemToPer100 } from './mealEntryMacros';

export function mealEntryHasDetails(entry: MealEditEntry): boolean {
  const webtebId = entry.webtebId ?? entry.planItem?.webtebId;
  return webtebId != null && Number(webtebId) > 0;
}

export function mealEntryToNutritionRow(entry: MealEditEntry): NutritionFoodRow | null {
  const webtebId = entry.webtebId ?? entry.planItem?.webtebId;
  if (webtebId == null || Number(webtebId) <= 0) return null;

  const per100 =
    entry.macrosPer100 ?? (entry.planItem ? planItemToPer100(entry.planItem) : undefined);
  if (!per100) return null;

  return {
    key: entry.key,
    name: entry.name,
    category: '',
    calories: per100.calories,
    protein: per100.protein,
    carbs: per100.carbs,
    fat: per100.fat,
    fdcPreview: {
      source: 'webteb',
      webtebId: Number(webtebId),
      name: entry.name,
      dataType: null,
      calories: per100.calories,
      protein: per100.protein,
      carbs: per100.carbs,
      fat: per100.fat,
    },
  };
}
