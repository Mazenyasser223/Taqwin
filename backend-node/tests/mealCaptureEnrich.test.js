const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  enrichMealCaptureResult,
  sameMealGate,
  confToNumeric,
  itemConfNumeric,
  sumHiddenCalories,
} = require('../src/lib/mealCaptureEnrich');

describe('mealCaptureEnrich', () => {
  it('maps categorical confidence to numeric scores', () => {
    assert.equal(confToNumeric('high'), 0.9);
    assert.equal(confToNumeric('low'), 0.55);
    assert.equal(
      itemConfNumeric({
        identification: 'high',
        portion_estimation: 'medium',
        nutrition_estimation: 'low',
      }),
      0.73
    );
  });

  it('sums hidden calorie items', () => {
    const total = sumHiddenCalories([
      { name: 'rice', estimated_calories: 200, hidden_calorie_sources: [] },
      { name: 'oil', estimated_calories: 90, hidden_calorie_sources: ['cooking oil'] },
      { name: 'butter', estimated_calories: 30, hidden_calorie_sources: ['butter'] },
    ]);
    assert.equal(total, 120);
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
    assert.equal(enriched.meal_summary.overall_confidence, 0.9);
    assert.equal(enriched.meal_summary.possible_hidden_calories, 120);
    assert.equal(enriched.food_items[0].confidence_score, 0.85);
  });

  it('blocks mixed-meal uploads when confidence is low', () => {
    const gate = sameMealGate({
      same_meal_validation: { passed: false, confidence: 0.4, issues: ['Different plates'] },
    });
    assert.equal(gate.error, 'SAME_MEAL_MISMATCH');
    assert.match(gate.message, /Different plates/);
  });

  it('allows same-meal warning when model is uncertain but not blocking', () => {
    const gate = sameMealGate({
      same_meal_validation: { passed: false, confidence: 0.7, issues: ['Lighting differs'] },
    });
    assert.equal(gate, null);
  });
});
