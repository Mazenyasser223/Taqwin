import nutritionService, { type PlanMealLogItem } from '../../services/nutritionService';
import {
  appendDraftItemToMealSlot,
  appendLogToMealSlot,
  emitMealPlanChanged,
  writeMealLogItemCache,
} from './mealAddContext';
import type { MealCaptureFoodItem } from './mealCaptureTypes';

export type MealCaptureApplyResult = {
  logIds?: string[];
  planItems: PlanMealLogItem[];
};

export function captureItemToPlanItem(item: MealCaptureFoodItem): PlanMealLogItem {
  const grams = item.estimated_weight_grams > 0 ? item.estimated_weight_grams : 100;
  const macros = item.macros || { protein: 0, carbs: 0, fat: 0 };
  const kcal = item.estimated_calories ?? 0;
  const factor = grams > 0 ? 100 / grams : 1;
  const useKitchen =
    item.kitchenFood === true || !item.dbMatched || item.webtebId == null || item.webtebId <= 0;

  return {
    name: item.name,
    grams,
    role: 'mixed',
    webtebId: useKitchen ? undefined : item.webtebId,
    kitchenFood: useKitchen,
    calories: kcal,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    macrosPer100: {
      calories: Math.round(kcal * factor),
      protein: Math.round(macros.protein * factor * 10) / 10,
      carbs: Math.round(macros.carbs * factor * 10) / 10,
      fat: Math.round(macros.fat * factor * 10) / 10,
    },
  };
}

export async function applyCapturedItemsToSlot(opts: {
  userId: string;
  date: string;
  slotId: string;
  isLogged: boolean;
  items: MealCaptureFoodItem[];
  existingDraftItems?: PlanMealLogItem[];
}): Promise<MealCaptureApplyResult & { error?: string }> {
  const planItems = opts.items.map(captureItemToPlanItem).filter((item) => item.name.trim());
  if (!planItems.length) return { error: 'No food items to add', planItems: [] };

  if (opts.isLogged) {
    const res = await nutritionService.logPlanMeal({
      date: opts.date,
      slotId: opts.slotId,
      items: planItems,
    });
    if (res.error || !res.data?.logIds?.length) {
      return { error: res.error || 'Failed to log captured meal', planItems };
    }
    appendLogToMealSlot(opts.userId, opts.date, opts.slotId, res.data.logIds, planItems);
    return { logIds: res.data.logIds, planItems };
  }

  let draft = opts.existingDraftItems;
  for (const item of planItems) {
    appendDraftItemToMealSlot(opts.userId, opts.date, opts.slotId, item, draft);
    draft = [...(draft ?? []), item];
  }
  writeMealLogItemCache(opts.userId, opts.date, opts.slotId, draft ?? planItems);
  emitMealPlanChanged();
  return { planItems };
}
