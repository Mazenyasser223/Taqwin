import { describe, it, expect } from 'vitest';
import { repairPlanProteinCoverage } from '../src/lib/plans/planMacroRepair.js';

describe('repairPlanProteinCoverage', () => {
  it('scales protein-bearing items to meet 85% daily target', () => {
    const plan = {
      dailyTargets: { protein: 181, calories: 2800, carbs: 300, fat: 80, waterMl: 3000 },
      dietDays: [
        {
          dayIndex: 1,
          meals: [
            {
              slot: 'breakfast',
              items: [
                { name: 'Chicken', grams: 150, protein: 30, calories: 200, carbs: 0, fat: 5 },
              ],
            },
            {
              slot: 'lunch',
              items: [
                { name: 'Rice', grams: 200, protein: 30, calories: 250, carbs: 50, fat: 2 },
              ],
            },
          ],
        },
      ],
    };
    repairPlanProteinCoverage(plan);
    const sum = plan.dietDays[0].meals.reduce(
      (daySum, meal) => daySum + meal.items.reduce((s, item) => s + item.protein, 0),
      0
    );
    expect(Math.round(sum)).toBeGreaterThanOrEqual(Math.round(181 * 0.85));
    expect(plan.dietDays[0].meals[0].items[0].grams).toBeGreaterThan(150);
  });
});
