import type { FoodLog } from '../../types';
import {
  macrosFromFoodLog,
  type LiveDietTotals,
} from './liveDashboardTotals';

export type MealPlanSlotRef = {
  id: string;
  items: Array<{ name: string }>;
};

const MEAL_CHECK_PREFIX = 'taqwin-meal-checks';

export function readMealCheckStore(
  userId: string | undefined,
  date: string
): { logIdsBySlot: Record<string, string[]> } {
  if (!userId || typeof window === 'undefined') {
    return { logIdsBySlot: {} };
  }
  try {
    const raw = window.localStorage.getItem(`${MEAL_CHECK_PREFIX}:${userId}:${date}`);
    if (!raw) return { logIdsBySlot: {} };
    const parsed = JSON.parse(raw) as
      | string[]
      | { logIdsBySlot?: Record<string, string[]> };
    if (Array.isArray(parsed)) return { logIdsBySlot: {} };
    return { logIdsBySlot: parsed.logIdsBySlot ?? {} };
  } catch {
    return { logIdsBySlot: {} };
  }
}

function mealItemDisplayName(name: unknown, fallback = 'Food'): string {
  if (typeof name === 'string' && name.trim()) return name.trim();
  return fallback;
}

function uniqueLogIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dedupeSlotLogIds(logIds: string[], logsById: Map<string, FoodLog>): string[] {
  const seenKeys = new Set<string>();
  const result: string[] = [];
  for (const logId of uniqueLogIds(logIds)) {
    const log = logsById.get(logId);
    if (!log) {
      result.push(logId);
      continue;
    }
    const foodKey =
      log.foodItem?.id ??
      (log.foodItem?.displayName ?? log.foodItem?.name ?? logId);
    const dedupeKey = `${foodKey}:${log.grams}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    result.push(logId);
  }
  return result;
}

function inferLogIdsBySlotFromLogs(
  logs: FoodLog[],
  slots: MealPlanSlotRef[]
): Record<string, string[]> {
  if (!logs.length || !slots.length) return {};

  const remaining = [...logs];
  const result: Record<string, string[]> = {};

  for (const slot of slots) {
    const matched: string[] = [];
    const nextRemaining: FoodLog[] = [];
    for (const log of remaining) {
      const logName = (log.foodItem?.displayName ?? log.foodItem?.name ?? '').trim().toLowerCase();
      const matchesSlot = slot.items.some((item) => {
        const itemName = mealItemDisplayName(item.name).trim().toLowerCase();
        return logName === itemName || logName.includes(itemName) || itemName.includes(logName);
      });
      if (matchesSlot) matched.push(log.id);
      else nextRemaining.push(log);
    }
    if (matched.length) result[slot.id] = matched;
    remaining.splice(0, remaining.length, ...nextRemaining);
  }

  if (remaining.length) {
    let slotIndex = 0;
    for (const log of remaining) {
      const slot = slots[slotIndex % slots.length];
      result[slot.id] = [...(result[slot.id] ?? []), log.id];
      slotIndex += 1;
    }
  }

  return result;
}

function buildLogIdsBySlotFromApi(
  logs: FoodLog[],
  slots: MealPlanSlotRef[],
  local: Record<string, string[]>,
  apiOk: boolean
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  const slotIds = new Set(slots.map((s) => s.id));

  for (const log of logs) {
    const slotId = log.mealSlotId;
    if (!slotId || !slotIds.has(slotId)) continue;
    const ids = merged[slotId] ?? [];
    if (!ids.includes(log.id)) merged[slotId] = [...ids, log.id];
  }

  if (apiOk) {
    const apiIds = new Set(logs.map((l) => l.id));
    for (const [slotId, ids] of Object.entries(local)) {
      if (!slotIds.has(slotId)) continue;
      for (const id of ids) {
        if (!apiIds.has(id)) continue;
        const current = merged[slotId] ?? [];
        if (!current.includes(id)) merged[slotId] = [...current, id];
      }
    }
  } else {
    for (const [slotId, ids] of Object.entries(local)) {
      if (slotIds.has(slotId) && ids.length) merged[slotId] = uniqueLogIds(ids);
    }
  }

  const assigned = new Set(Object.values(merged).flat());
  const orphans = logs.filter((l) => !assigned.has(l.id));
  if (orphans.length) {
    const inferred = inferLogIdsBySlotFromLogs(orphans, slots);
    for (const [slotId, ids] of Object.entries(inferred)) {
      const current = merged[slotId] ?? [];
      merged[slotId] = uniqueLogIds([...current, ...ids]);
    }
  }

  for (const slotId of Object.keys(merged)) {
    merged[slotId] = uniqueLogIds(merged[slotId]);
  }

  return merged;
}

/** Same totals math as My Plans → My logs (logged slots only, deduped). */
export function computeMyLogsDietTotals(
  logs: FoodLog[],
  slots: MealPlanSlotRef[],
  userId?: string,
  date?: string
): LiveDietTotals {
  if (!slots.length) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, logCount: 0 };
  }

  const store = readMealCheckStore(userId, date);
  const logIdsBySlot = buildLogIdsBySlotFromApi(logs, slots, store.logIdsBySlot, true);
  const logsById = new Map(logs.map((log) => [log.id, log]));

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let logCount = 0;

  for (const slot of slots) {
    const ids = logIdsBySlot[slot.id];
    if (!ids?.length) continue;
    const deduped = dedupeSlotLogIds(ids, logsById);
    logCount += deduped.length;
    for (const logId of deduped) {
      const log = logsById.get(logId);
      if (!log) continue;
      const macros = macrosFromFoodLog(log);
      calories += macros.calories;
      protein += macros.protein;
      carbs += macros.carbs;
      fat += macros.fat;
    }
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    logCount,
  };
}
