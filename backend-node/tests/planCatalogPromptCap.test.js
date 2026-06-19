import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { trimPlanCatalogForPrompt } = requireFromHere('../src/lib/plans/planCatalogPromptCap.js');

describe('planCatalogPromptCap', () => {
  it('caps foods per group and total', () => {
    const foods = [];
    for (let g = 0; g < 8; g += 1) {
      for (let i = 0; i < 20; i += 1) {
        foods.push({ id: `f-${g}-${i}`, planGroup: `group-${g}`, name: `Food ${g}-${i}` });
      }
    }
    const { foods: trimmed } = trimPlanCatalogForPrompt({ foods, exercises: [] });
    expect(trimmed.length).toBeLessThanOrEqual(80);
    const perGroup = {};
    for (const f of trimmed) {
      perGroup[f.planGroup] = (perGroup[f.planGroup] || 0) + 1;
    }
    for (const count of Object.values(perGroup)) {
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it('caps exercises per muscle×difficulty cell', () => {
    const exercises = [];
    for (let m = 0; m < 10; m += 1) {
      for (const d of ['beginner', 'intermediate', 'advanced']) {
        for (let i = 0; i < 15; i += 1) {
          exercises.push({
            id: `e-${m}-${d}-${i}`,
            muscleGroup: `muscle-${m}`,
            planDifficulty: d,
            name: `Ex ${m}-${d}-${i}`,
          });
        }
      }
    }
    const { exercises: trimmed } = trimPlanCatalogForPrompt({ foods: [], exercises });
    expect(trimmed.length).toBeLessThanOrEqual(120);
    const perCell = {};
    for (const ex of trimmed) {
      const key = `${ex.muscleGroup}:${ex.planDifficulty}`;
      perCell[key] = (perCell[key] || 0) + 1;
    }
    for (const count of Object.values(perCell)) {
      expect(count).toBeLessThanOrEqual(6);
    }
  });
});
