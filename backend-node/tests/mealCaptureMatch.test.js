const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldUseCatalogMatch,
  markKitchenFoodItem,
} = require('../src/lib/mealCaptureMatch');

describe('mealCaptureMatch', () => {
  it('shouldUseCatalogMatch requires strong score and confidence', () => {
    const item = {
      confidence_score: 0.85,
      confidence: { identification: 'high', portion_estimation: 'medium', nutrition_estimation: 'high' },
    };
    assert.equal(shouldUseCatalogMatch(item, 0.9), true);
    assert.equal(shouldUseCatalogMatch(item, 0.7), false);
  });

  it('markKitchenFoodItem clears catalog fields', () => {
    const marked = markKitchenFoodItem({ name: 'Snack', webtebId: 1, dbMatched: true });
    assert.equal(marked.kitchenFood, true);
    assert.equal(marked.webtebId, null);
    assert.equal(marked.dbMatched, false);
  });
});
