import type { FoodLog } from '../../types';

export type LiveDietTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logCount: number;
};

const LIVE_DIET_PREFIX = 'taqwin-live-diet-totals';

export function macrosFromFoodLog(log: FoodLog): LiveDietTotals {
  const food = log.foodItem;
  const grams = log.grams ?? 0;
  if (!food || grams <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0, logCount: 0 };
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
    logCount: 1,
  };
}

/** Sum food logs tied to meal-plan slots (deduped), matching My logs totals. */
export function sumMealSlotFoodLogs(logs: FoodLog[], mealSlotIds: string[]): LiveDietTotals {
  const slotSet = new Set(mealSlotIds);
  const seen = new Set<string>();
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  for (const log of logs) {
    const slotId = log.mealSlotId;
    if (!slotId || !slotSet.has(slotId)) continue;
    const foodKey =
      log.foodItem?.id ??
      log.foodItemId ??
      (log.foodItem?.displayName ?? log.foodItem?.name ?? log.id);
    const dedupeKey = `${slotId}:${foodKey}:${log.grams}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const macros = macrosFromFoodLog(log);
    totals.calories += macros.calories;
    totals.protein += macros.protein;
    totals.carbs += macros.carbs;
    totals.fat += macros.fat;
  }

  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    logCount: seen.size,
  };
}

export function writeLiveDietTotals(
  userId: string | undefined,
  date: string,
  totals: LiveDietTotals
) {
  if (!userId || typeof window === 'undefined') return;
  sessionStorage.setItem(`${LIVE_DIET_PREFIX}:${userId}:${date}`, JSON.stringify(totals));
}

export function readLiveDietTotals(
  userId: string | undefined,
  date: string
): LiveDietTotals | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${LIVE_DIET_PREFIX}:${userId}:${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveDietTotals;
    return { ...parsed, logCount: parsed.logCount ?? 0 };
  } catch {
    return null;
  }
}
