import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  enrichMealCaptureResult,
  sameMealGate,
  confToNumeric,
  itemConfNumeric,
  sumHiddenCalories,
} = requireFromHere('../src/lib/mealCaptureEnrich');

describe('mealCaptureEnrich', () => {
  it('maps categorical confidence to numeric scores', () => {
    expect(confToNumeric('high')).toBe(0.9);
    expect(confToNumeric('low')).toBe(0.55);
    expect(
      itemConfNumeric({
        identification: 'high',
        portion_estimation: 'medium',
        nutrition_estimation: 'low',
      })
    ).toBe(0.73);
  });

  it('sums hidden calorie items', () => {
    const total = sumHiddenCalories([
      { name: 'rice', estimated_calories: 200, hidden_calorie_sources: [] },
      { name: 'oil', estimated_calories: 90, hidden_calorie_sources: ['cooking oil'] },
      { name: 'butter', estimated_calories: 30, hidden_calorie_sources: ['butter'] },
    ]);
    expect(total).toBe(120);
  });

  it('enriches meal result with numeric confidence and hidden total', () => {
    const enriched = enrichMealCaptureResult({
      meal_summary: { estimated_calories: 500, macros: { protein: 40, carbs: 50, fat: 12 }, confidence: 'high' },
      food_items: [
        {
          name: 'chicken',
          estimated_calories: 280,
          confidence: { identification: 'high', portion_estimation: 'high', nutrition_estimation: 'medium' },
        },
        {
          name: 'cooking oil',
          estimated_calories: 120,
          hidden_calorie_sources: ['oil'],
          confidence: 'medium',
        },
      ],
      same_meal_validation: { passed: true, confidence: 0.92, issues: [] },
    });
    expect(enriched.meal_summary.overall_confidence).toBe(0.9);
    expect(enriched.meal_summary.possible_hidden_calories).toBe(120);
    expect(enriched.food_items[0].confidence_score).toBe(0.85);
  });

  it('blocks mixed-meal uploads when confidence is low', () => {
    const gate = sameMealGate({
      same_meal_validation: { passed: false, confidence: 0.4, issues: ['Different plates'] },
    });
    expect(gate.error).toBe('SAME_MEAL_MISMATCH');
    expect(gate.message).toMatch(/Different plates/);
  });

  it('allows same-meal warning when model is uncertain but not blocking', () => {
    const gate = sameMealGate({
      same_meal_validation: { passed: false, confidence: 0.7, issues: ['Lighting differs'] },
    });
    expect(gate).toBeNull();
  });
});
