import type { PlanMealLogItem } from '../../services/nutritionService';
import type { NutritionFoodRow } from '../nutrition/NutritionFoodList';

export type MealAddContext = {
  slotId: string;
  slotLabel: string;
  date: string;
  isLogged: boolean;
  userId: string;
  existingDraftItems?: PlanMealLogItem[];
};

export type MealPlanSlotRef = {
  id: string;
  label: string;
  kind: 'meal' | 'snack';
};

export type MealPlanSlotsContext = {
  date: string;
  userId: string;
  slots: MealPlanSlotRef[];
};

const CONTEXT_KEY = 'taqwin-meal-add-context';
const SLOTS_CTX_KEY = 'taqwin-meal-plan-slots';
const REOPEN_EDIT_KEY = 'taqwin-meal-reopen-edit';

export function setMealAddContext(context: MealAddContext) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
}

export function getMealAddContext(): MealAddContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MealAddContext;
  } catch {
    return null;
  }
}

export function clearMealAddContext() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CONTEXT_KEY);
}

export function setMealPlanSlotsContext(context: MealPlanSlotsContext) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SLOTS_CTX_KEY, JSON.stringify(context));
}

export function getMealPlanSlotsContext(): MealPlanSlotsContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SLOTS_CTX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MealPlanSlotsContext;
  } catch {
    return null;
  }
}

export function markMealEditReopen(slotId: string, date: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(REOPEN_EDIT_KEY, JSON.stringify({ slotId, date }));
}

export function consumeMealEditReopen(): { slotId: string; date: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(REOPEN_EDIT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(REOPEN_EDIT_KEY);
    return JSON.parse(raw) as { slotId: string; date: string };
  } catch {
    return null;
  }
}

export function rowToPlanItem(row: NutritionFoodRow, grams: number): PlanMealLogItem {
  const factor = grams / 100;
  const macrosPer100 = {
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
  return {
    name: row.name,
    grams,
    webtebId: row.fdcPreview?.webtebId ?? undefined,
    role: 'mixed',
    macrosPer100,
    calories: Math.round(row.calories * factor),
    protein: Math.round(row.protein * factor * 10) / 10,
    carbs: Math.round(row.carbs * factor * 10) / 10,
    fat: Math.round(row.fat * factor * 10) / 10,
  };
}

function readMealChecks(userId: string, date: string) {
  try {
    const raw = localStorage.getItem(`taqwin-meal-checks:${userId}:${date}`);
    if (!raw) return { checked: [] as string[], logIdsBySlot: {} as Record<string, string[]>, prepChecked: [] as string[] };
    const parsed = JSON.parse(raw) as {
      checked?: string[];
      logIdsBySlot?: Record<string, string[]>;
      prepChecked?: string[];
    };
    return {
      checked: parsed.checked ?? [],
      logIdsBySlot: parsed.logIdsBySlot ?? {},
      prepChecked: parsed.prepChecked ?? [],
    };
  } catch {
    return { checked: [] as string[], logIdsBySlot: {} as Record<string, string[]>, prepChecked: [] as string[] };
  }
}

export function appendLogToMealSlot(userId: string, date: string, slotId: string, logIds: string[]) {
  const store = readMealChecks(userId, date);
  const logIdsBySlot = { ...store.logIdsBySlot };
  logIdsBySlot[slotId] = [...(logIdsBySlot[slotId] ?? []), ...logIds];
  const checked = new Set(store.checked);
  checked.add(slotId);
  const prepChecked = (store.prepChecked ?? []).filter((id) => id !== slotId);
  localStorage.setItem(
    `taqwin-meal-checks:${userId}:${date}`,
    JSON.stringify({ checked: [...checked], logIdsBySlot, prepChecked })
  );
}

export function appendDraftItemToMealSlot(
  userId: string,
  date: string,
  slotId: string,
  item: PlanMealLogItem,
  existingDraftItems?: PlanMealLogItem[]
) {
  let current = existingDraftItems;
  if (!current) {
    try {
      const raw = localStorage.getItem(`taqwin-meal-slot-items:${userId}:${date}`);
      const parsed = raw ? (JSON.parse(raw) as Record<string, PlanMealLogItem[]>) : {};
      current = parsed[slotId] ?? [];
    } catch {
      current = [];
    }
  }
  try {
    const raw = localStorage.getItem(`taqwin-meal-slot-items:${userId}:${date}`);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PlanMealLogItem[]>) : {};
    parsed[slotId] = [...current, item];
    localStorage.setItem(`taqwin-meal-slot-items:${userId}:${date}`, JSON.stringify(parsed));
  } catch {
    localStorage.setItem(
      `taqwin-meal-slot-items:${userId}:${date}`,
      JSON.stringify({ [slotId]: [...current, item] })
    );
  }
}
