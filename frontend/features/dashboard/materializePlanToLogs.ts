import nutritionService, { type PlanMealLogItem } from '../../services/nutritionService';
import exerciseService from '../../services/exerciseService';
import { normalizeCatalogDisplayName } from '../onboarding/catalogLocale';
import { macrosFromPer100, planItemToPer100 } from './mealEntryMacros';
import {
  type WorkoutSession,
  sessionExerciseToPayload,
} from './workoutSessionStore';

export type PlanMealSlotItem = {
  name: unknown;
  grams: number;
  role?: string;
  webtebId?: number | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  macrosPer100?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

export type PlanMealSlot = {
  id: string;
  items: PlanMealSlotItem[];
};

function mealItemDisplayName(name: unknown, fallback = 'Food'): string {
  return normalizeCatalogDisplayName(name, fallback);
}

function scaleMealItemForLog(item: PlanMealSlotItem, grams: number): PlanMealLogItem {
  const per100 = item.macrosPer100 ?? planItemToPer100(item);
  if (per100) {
    const scaled = macrosFromPer100(per100, grams);
    return {
      name: mealItemDisplayName(item.name),
      grams,
      role: (item.role as PlanMealLogItem['role']) ?? 'mixed',
      webtebId: item.webtebId ?? undefined,
      macrosPer100: per100,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
    };
  }
  const factor = item.grams > 0 ? grams / item.grams : 1;
  return {
    name: mealItemDisplayName(item.name),
    grams,
    role: (item.role as PlanMealLogItem['role']) ?? 'mixed',
    webtebId: item.webtebId ?? undefined,
    calories: Math.round((item.calories ?? 0) * factor),
    protein: Math.round((item.protein ?? 0) * factor * 10) / 10,
    carbs: Math.round((item.carbs ?? 0) * factor * 10) / 10,
    fat: Math.round((item.fat ?? 0) * factor * 10) / 10,
  };
}

function slotItemsToLogItems(
  slot: PlanMealSlot,
  draftItems?: PlanMealLogItem[]
): PlanMealLogItem[] {
  if (draftItems?.length) return draftItems;
  if (!slot.items.length) return [];
  return slot.items.map((item) => scaleMealItemForLog(item, item.grams));
}

function mergeLogIdsByMealSlot(
  merged: Record<string, string[]>,
  logs: Array<{ id: string; mealSlotId?: string | null }>,
  slots: PlanMealSlot[]
): Record<string, string[]> {
  const slotIds = new Set(slots.map((slot) => slot.id));
  const next = { ...merged };
  for (const log of logs) {
    const slotId = log.mealSlotId;
    if (!slotId || !slotIds.has(slotId)) continue;
    const ids = next[slotId] ?? [];
    if (!ids.includes(log.id)) next[slotId] = [...ids, log.id];
  }
  return next;
}

const materializeMutex = new Map<string, Promise<Record<string, string[]>>>();

/**
 * Copy AI plan meals into food logs for slots that have no logs yet.
 * Slots are logged in parallel for faster first paint.
 */
export async function materializeMealPlanSlotsToLogs(opts: {
  date: string;
  slots: PlanMealSlot[];
  existingBySlot: Record<string, string[]>;
  slotDraftItems?: Record<string, PlanMealLogItem[]>;
}): Promise<Record<string, string[]>> {
  const mutexKey = opts.date;
  const inflight = materializeMutex.get(mutexKey);
  if (inflight) {
    await inflight;
    const fresh =
      nutritionService.peekMyLogs(opts.date) ??
      (await nutritionService.getMyLogs(opts.date)).data ??
      [];
    return mergeLogIdsByMealSlot({ ...opts.existingBySlot }, fresh, opts.slots);
  }

  const run = async (): Promise<Record<string, string[]>> => {
    const fresh = await nutritionService.getMyLogs(opts.date);
    let merged = mergeLogIdsByMealSlot({ ...opts.existingBySlot }, fresh.data ?? [], opts.slots);

    const pending = opts.slots.filter((slot) => {
      if ((merged[slot.id]?.length ?? 0) > 0) return false;
      return slotItemsToLogItems(slot, opts.slotDraftItems?.[slot.id]).length > 0;
    });

    if (!pending.length) return merged;

    const results = await Promise.all(
      pending.map(async (slot) => {
        const items = slotItemsToLogItems(slot, opts.slotDraftItems?.[slot.id]);
        const res = await nutritionService.logPlanMeal({
          date: opts.date,
          slotId: slot.id,
          items,
        });
        if (res.error || !res.data?.logIds?.length) return null;
        return { slotId: slot.id, logIds: res.data.logIds };
      })
    );

    for (const row of results) {
      if (!row) continue;
      const existing = merged[row.slotId] ?? [];
      const combined = [...existing];
      for (const id of row.logIds) {
        if (!combined.includes(id)) combined.push(id);
      }
      merged[row.slotId] = combined;
    }

    return merged;
  };

  const promise = run();
  materializeMutex.set(mutexKey, promise);
  try {
    return await promise;
  } finally {
    if (materializeMutex.get(mutexKey) === promise) {
      materializeMutex.delete(mutexKey);
    }
  }
}

/**
 * Copy AI plan exercises into exercise logs (single batched request).
 */
export async function materializeWorkoutSessionToLogs(
  date: string,
  session: WorkoutSession
): Promise<WorkoutSession> {
  const needsLog = session.exercises.filter((ex) => !ex.logId);
  if (!needsLog.length) return session;

  const items = needsLog.map((ex) => {
    const payload = sessionExerciseToPayload(ex);
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: payload.sets,
      reps: payload.reps,
      setDetails: payload.setDetails,
      userNotes: payload.userNotes,
      durationSec: session.durationSec,
    };
  });

  const res = await exerciseService.logPlanExercises({ date, items });
  if (res.error || !res.data?.logIds?.length) return session;

  const logIds = res.data.logIds;
  let logIndex = 0;
  const updatedExercises = session.exercises.map((ex) => {
    if (ex.logId) return ex;
    const logId = logIds[logIndex];
    logIndex += 1;
    if (!logId) return ex;
    return { ...ex, logId };
  });

  return { ...session, exercises: updatedExercises };
}
