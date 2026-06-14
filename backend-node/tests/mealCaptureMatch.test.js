import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  shouldUseCatalogMatch,
  markKitchenFoodItem,
} = requireFromHere('../src/lib/mealCaptureMatch');

describe('mealCaptureMatch', () => {
  it('shouldUseCatalogMatch requires strong score and confidence', () => {
    const item = {
      confidence_score: 0.85,
      confidence: { identification: 'high', portion_estimation: 'medium', nutrition_estimation: 'high' },
    };
    expect(shouldUseCatalogMatch(item, 0.9)).toBe(true);
    expect(shouldUseCatalogMatch(item, 0.7)).toBe(false);
  });

  it('markKitchenFoodItem clears catalog fields', () => {
    const marked = markKitchenFoodItem({ name: 'Snack', webtebId: 1, dbMatched: true });
    expect(marked.kitchenFood).toBe(true);
    expect(marked.webtebId).toBeNull();
    expect(marked.dbMatched).toBe(false);
  });
});
