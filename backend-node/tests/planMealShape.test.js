import { describe, it, expect } from 'vitest';
import {
  normalizeDietMealsToSlotShape,
  normalizeDietDayMeals,
  dayProteinSum,
} from '../src/lib/plans/planMealShape.js';
import { PlanSchema } from '../src/lib/plans/schema.js';
import { normalizeClaudePlanShape } from '../src/lib/plans/planNormalize.js';

describe('planMealShape', () => {
  it('keeps slot+items meals as canonical shape', () => {
    const day = normalizeDietDayMeals([
      {
        slot: 'breakfast',
        items: [
          { name: 'Oats', grams: 80 },
          { name: 'Eggs', grams: 120 },
        ],
      },
    ]);
    expect(day).toHaveLength(1);
    expect(day[0].items).toHaveLength(2);
  });

  it('groups legacy flat rows by slot', () => {
    const day = normalizeDietDayMeals([
      { slot: 'breakfast', name: 'Oats', grams: 80 },
      { slot: 'breakfast', name: 'Eggs', grams: 120 },
      { slot: 'lunch', name: 'Chicken', grams: 200 },
    ]);
    expect(day).toHaveLength(2);
    expect(day[0].items).toHaveLength(2);
    expect(day[1].items).toHaveLength(1);
  });

  it('passes Zod after normalizeClaudePlanShape', () => {
    const plan = normalizeClaudePlanShape({
      dailyTargets: { calories: 2500, protein: 150, carbs: 250, fat: 70, waterMl: 3000 },
      dietDays: [
        {
          dayIndex: 1,
          meals: [
            {
              slot: 'breakfast',
              items: [
                { name: 'Oats', grams: 80, protein: 10 },
                { name: 'Eggs', grams: 120, protein: 20 },
              ],
            },
          ],
        },
      ],
      workoutWeeks: [{ weekIndex: 1, days: [{ dayIndex: 1, isRest: true, exercises: [] }] }],
    });
    expect(PlanSchema.safeParse(plan).success).toBe(true);
    expect(dayProteinSum(plan.dietDays[0])).toBe(30);
  });

  it('normalizes legacy flat plan on ingest', () => {
    const plan = { dietDays: [{ dayIndex: 1, meals: [{ slot: 'lunch', name: 'Rice', grams: 150 }] }] };
    normalizeDietMealsToSlotShape(plan);
    expect(plan.dietDays[0].meals[0].items[0].name).toBe('Rice');
  });
});
