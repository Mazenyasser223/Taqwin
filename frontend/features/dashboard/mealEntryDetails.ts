import type { FoodItem } from '../../types';
import type { NutritionFoodRow } from '../nutrition/NutritionFoodList';
import type { MealEditEntry } from './MealSlotInlineEditor';
import { planItemToPer100 } from './mealEntryMacros';

function resolveWebtebId(entry: MealEditEntry): number | undefined {
  const raw = entry.webtebId ?? entry.planItem?.webtebId ?? entry.foodItem?.webtebId;
  if (raw == null || Number(raw) <= 0) return undefined;
  return Number(raw);
}

export function foodItemToMacrosPer100(food?: Pick<FoodItem, 'calories' | 'protein' | 'carbs' | 'fat'>) {
  if (!food) return undefined;
  return {
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  };
}

export function mealEntryFromFoodLog(
  log: { id: string; grams: number; foodItem?: FoodItem | null },
  fallbackName = 'Food'
): MealEditEntry {
  const food = log.foodItem;
  return {
    key: log.id,
    name: food?.displayName?.trim() || food?.name?.trim() || fallbackName,
    grams: log.grams,
    logId: log.id,
    foodItemId: food?.id,
    foodItem: food ?? undefined,
    webtebId: food?.webtebId != null && Number(food.webtebId) > 0 ? Number(food.webtebId) : undefined,
    macrosPer100: foodItemToMacrosPer100(food ?? undefined),
  };
}

export function mealEntryHasDetails(entry: MealEditEntry): boolean {
  if (resolveWebtebId(entry) != null) return true;
  if (entry.macrosPer100) return true;
  return Boolean(entry.logId || entry.foodItemId);
}

export function mealEntryToNutritionRow(entry: MealEditEntry): NutritionFoodRow | null {
  const webtebId = resolveWebtebId(entry);
  const per100 =
    entry.macrosPer100 ??
    (entry.planItem ? planItemToPer100(entry.planItem) : undefined) ??
    foodItemToMacrosPer100(entry.foodItem) ?? {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

  if (webtebId != null) {
    return {
      key: entry.key,
      name: entry.name,
      category: entry.foodItem?.category || '',
      calories: per100.calories,
      protein: per100.protein,
      carbs: per100.carbs,
      fat: per100.fat,
      foodItem: entry.foodItem,
      fdcPreview: {
        source: 'webteb',
        webtebId,
        name: entry.name,
        dataType: null,
        calories: per100.calories,
        protein: per100.protein,
        carbs: per100.carbs,
        fat: per100.fat,
      },
    };
  }

  if (entry.foodItemId || entry.macrosPer100 || entry.foodItem) {
    return {
      key: entry.key,
      name: entry.name,
      category: entry.foodItem?.category || 'Personal food',
      calories: per100.calories,
      protein: per100.protein,
      carbs: per100.carbs,
      fat: per100.fat,
      foodItem: entry.foodItem,
      subtitle: entry.foodItem?.isPublic === false ? 'Personal food' : undefined,
    };
  }

  return null;
}
