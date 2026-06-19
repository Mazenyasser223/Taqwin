import { describe, it, expect } from 'vitest';
import { applyCatalogMacrosToPlan } from '../src/lib/plans/planCatalogEnrichment.js';

describe('applyCatalogMacrosToPlan', () => {
  it('fills item macros from RAG food catalog by name match', () => {
    const plan = {
      dietDays: [
        {
          dayIndex: 1,
          meals: [
            {
              slot: 'breakfast',
              items: [{ name: 'Chicken breast', grams: 200 }],
            },
            {
              slot: 'lunch',
              items: [{ name: 'Unknown dish', grams: 300, protein: 25 }],
            },
          ],
        },
      ],
    };
    const foods = [
      {
        id: 'food-1',
        name: 'Chicken breast',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
      },
    ];
    applyCatalogMacrosToPlan(plan, foods);
    expect(plan.dietDays[0].meals[0].items[0].foodItemId).toBe('food-1');
    expect(plan.dietDays[0].meals[0].items[0].protein).toBe(62);
    expect(plan.dietDays[0].meals[0].items[0].calories).toBeGreaterThan(0);
    expect(plan.dietDays[0].meals[1].items[0].protein).toBe(25);
  });

  it('binds Arabic dish names via token overlap on items', () => {
    const plan = {
      dietDays: [
        {
          dayIndex: 1,
          meals: [
            {
              slot: 'lunch',
              items: [{ name: 'صدر دجاج مشوي مع أرز', grams: 250 }],
            },
          ],
        },
      ],
    };
    const foods = [
      {
        id: 'food-2',
        name: 'Chicken breast',
        nameAr: 'صدر دجاج',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
      },
    ];
    applyCatalogMacrosToPlan(plan, foods);
    expect(plan.dietDays[0].meals[0].items[0].protein).toBeGreaterThan(0);
  });
});
