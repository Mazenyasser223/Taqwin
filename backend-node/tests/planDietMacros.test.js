import { describe, it, expect } from 'vitest';
import { mealItemMacrosFromFoodRow } from '../src/lib/plans/planDietMacros.js';

describe('planDietMacros', () => {
  it('scales FoodItem macros by grams', () => {
    const macros = mealItemMacrosFromFoodRow({
      quantity: 200,
      foodItem: { calories: 100, protein: 20, carbs: 10, fat: 5 },
    });
    expect(macros.calories).toBe(200);
    expect(macros.protein).toBe(40);
  });
});
