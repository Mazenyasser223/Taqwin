export type MacrosPer100 = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function macrosFromPer100(per100: MacrosPer100, grams: number) {
  const factor = grams / 100;
  return {
    calories: Math.round(per100.calories * factor),
    protein: Math.round(per100.protein * factor * 10) / 10,
    carbs: Math.round(per100.carbs * factor * 10) / 10,
    fat: Math.round(per100.fat * factor * 10) / 10,
  };
}

export function planItemToPer100(item: {
  grams: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  macrosPer100?: MacrosPer100;
}): MacrosPer100 | undefined {
  if (item.macrosPer100) return item.macrosPer100;
  if (!item.grams || item.grams <= 0) return undefined;
  const factor = 100 / item.grams;
  return {
    calories: Math.round((item.calories ?? 0) * factor),
    protein: Math.round((item.protein ?? 0) * factor * 10) / 10,
    carbs: Math.round((item.carbs ?? 0) * factor * 10) / 10,
    fat: Math.round((item.fat ?? 0) * factor * 10) / 10,
  };
}

export function entryKcal(entry: {
  grams: number;
  macrosPer100?: MacrosPer100;
  planItem?: {
    grams: number;
    calories?: number;
    protein?: number;
    macrosPer100?: MacrosPer100;
  };
}) {
  return entryMacros(entry).calories;
}

export function entryMacros(entry: {
  grams: number;
  macrosPer100?: MacrosPer100;
  planItem?: {
    grams: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    macrosPer100?: MacrosPer100;
  };
}) {
  if (entry.macrosPer100) return macrosFromPer100(entry.macrosPer100, entry.grams);
  const planPer100 = entry.planItem ? planItemToPer100(entry.planItem) : undefined;
  if (planPer100) return macrosFromPer100(planPer100, entry.grams);
  if (entry.planItem?.grams && entry.planItem.grams > 0) {
    const factor = entry.grams / entry.planItem.grams;
    return {
      calories: Math.round((entry.planItem.calories ?? 0) * factor),
      protein: Math.round((entry.planItem.protein ?? 0) * factor * 10) / 10,
      carbs: Math.round((entry.planItem.carbs ?? 0) * factor * 10) / 10,
      fat: Math.round((entry.planItem.fat ?? 0) * factor * 10) / 10,
    };
  }
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export function sumEntryMacros(
  entries: Array<{
    grams: number;
    macrosPer100?: MacrosPer100;
    planItem?: {
      grams: number;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      macrosPer100?: MacrosPer100;
    };
  }>
) {
  return entries.reduce(
    (acc, entry) => {
      const macros = entryMacros(entry);
      acc.calories += macros.calories;
      acc.protein += macros.protein;
      acc.carbs += macros.carbs;
      acc.fat += macros.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
