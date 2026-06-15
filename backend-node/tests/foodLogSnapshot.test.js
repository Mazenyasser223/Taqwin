import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  scaledMacrosFromLog,
  per100FromFoodOrEntry,
  snapshotFieldsFromPer100,
  attachSnapshotDisplay,
} = requireFromHere('../src/lib/foodLogSnapshot');

describe('foodLogSnapshot', () => {
  it('uses snapshot macros when present instead of live food item', () => {
    const log = {
      grams: 200,
      snapshotCalories: 100,
      snapshotProtein: 10,
      snapshotCarbs: 5,
      snapshotFat: 2,
      snapshotName: 'Fried eggs',
      foodItem: {
        name: 'Dried eggs',
        calories: 580,
        protein: 48,
        carbs: 3,
        fat: 42,
      },
    };
    const scaled = scaledMacrosFromLog(log);
    expect(scaled.calories).toBe(200);
    expect(scaled.protein).toBe(20);
    expect(attachSnapshotDisplay(log.foodItem, log).name).toBe('Fried eggs');
    expect(attachSnapshotDisplay(log.foodItem, log).calories).toBe(100);
  });

  it('falls back to food item when snapshot is missing', () => {
    const log = {
      grams: 100,
      foodItem: { name: 'Chicken', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    };
    expect(scaledMacrosFromLog(log).calories).toBe(165);
  });

  it('derives per-100 macros from scaled entry totals', () => {
    const per100 = per100FromFoodOrEntry(null, {
      grams: 50,
      calories: 80,
      protein: 6,
      carbs: 4,
      fat: 2,
    });
    expect(per100.calories).toBe(160);
    expect(per100.protein).toBe(12);
  });

  it('snapshotFieldsFromPer100 maps to prisma column names', () => {
    expect(
      snapshotFieldsFromPer100('Eggs', { calories: 155, protein: 13, carbs: 1, fat: 11 })
    ).toEqual({
      snapshotName: 'Eggs',
      snapshotCalories: 155,
      snapshotProtein: 13,
      snapshotCarbs: 1,
      snapshotFat: 11,
    });
  });
});

describe('FOOD_LOG_SNAPSHOT_SELECT', () => {
  it('exports prisma select fields for explicit food log queries', () => {
    const { FOOD_LOG_SNAPSHOT_SELECT } = requireFromHere('../src/lib/foodLogSnapshot');
    expect(FOOD_LOG_SNAPSHOT_SELECT).toEqual({
      snapshotName: true,
      snapshotCalories: true,
      snapshotProtein: true,
      snapshotCarbs: true,
      snapshotFat: true,
    });
  });
});
