import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { mergePlanFoodCatalog } = requireFromHere('../src/lib/plans/planFoodCatalogMerge');
const { loadStaplesFromJson } = requireFromHere('../src/lib/plans/planStapleFoods');

describe('planFoodCatalogMerge', () => {
  it('merges prefs before staples and tags planGroup', () => {
    const merged = mergePlanFoodCatalog(
      [{ name: 'User Rice', webtebId: 99, planGroup: 'carbs' }],
      [{ name: 'Chicken', webtebId: 1, planGroup: 'protein', category: 'poultry' }],
      [{ name: 'Chicken', webtebId: 1, category: 'poultry' }],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].webtebId).toBe(99);
    expect(merged.find((f) => f.webtebId === 1)?.planGroup).toBe('protein');
  });
});

describe('planStapleFoods json fallback', () => {
  it('loads grouped staples when JSON exists', () => {
    const items = loadStaplesFromJson({ onboardingData: {}, locale: 'en' });
    if (items.length) {
      expect(items.some((f) => f.planGroup)).toBe(true);
    }
  });
});
