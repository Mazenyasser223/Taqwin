import nutritionService, { type BarcodeLookupResult, type PlanMealLogItem } from '../../services/nutritionService';
import {
  appendDraftItemToMealSlot,
  appendLogToMealSlot,
  emitMealPlanChanged,
  writeMealLogItemCache,
} from './mealAddContext';
import type { MealCaptureApplyResult } from './mealCaptureApply';

export function barcodeProductToPlanItem(
  product: BarcodeLookupResult,
  grams: number
): PlanMealLogItem {
  const per100 = product.macrosPer100;
  const factor = grams / 100;
  return {
    name: product.name,
    grams,
    role: 'mixed',
    webtebId: product.kitchenFood ? undefined : product.webtebId,
    kitchenFood: product.kitchenFood,
    calories: Math.round(per100.calories * factor),
    protein: Math.round(per100.protein * factor * 10) / 10,
    carbs: Math.round(per100.carbs * factor * 10) / 10,
    fat: Math.round(per100.fat * factor * 10) / 10,
    macrosPer100: { ...per100 },
  };
}

export async function applyBarcodeProductToSlot(opts: {
  userId: string;
  date: string;
  slotId: string;
  isLogged: boolean;
  product: BarcodeLookupResult;
  grams: number;
  existingDraftItems?: PlanMealLogItem[];
}): Promise<MealCaptureApplyResult & { error?: string }> {
  const planItem = barcodeProductToPlanItem(opts.product, opts.grams);
  if (!planItem.name.trim()) return { error: 'No product to add', planItems: [] };

  if (opts.isLogged) {
    const res = await nutritionService.logPlanMeal({
      date: opts.date,
      slotId: opts.slotId,
      items: [planItem],
    });
    if (res.error || !res.data?.logIds?.length) {
      return { error: res.error || 'Failed to log scanned product', planItems: [planItem] };
    }
    appendLogToMealSlot(opts.userId, opts.date, opts.slotId, res.data.logIds, [planItem]);
    return { logIds: res.data.logIds, planItems: [planItem] };
  }

  let draft = opts.existingDraftItems;
  appendDraftItemToMealSlot(opts.userId, opts.date, opts.slotId, planItem, draft);
  draft = [...(draft ?? []), planItem];
  writeMealLogItemCache(opts.userId, opts.date, opts.slotId, draft);
  emitMealPlanChanged();
  return { planItems: [planItem] };
}
