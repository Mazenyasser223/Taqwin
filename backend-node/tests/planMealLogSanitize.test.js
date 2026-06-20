import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  sanitizePlanMealLogBody,
  sanitizePlanMealLogItem,
} = requireFromHere('../src/lib/planMealLogSanitize');

describe('planMealLogSanitize', () => {
  it('drops null webtebId instead of coercing to 0', () => {
    const item = sanitizePlanMealLogItem({
      name: 'Dried egg whites',
      grams: 135,
      webtebId: null,
      role: 'protein',
      macrosPer100: { calories: 356, protein: 81.1, carbs: 7.8, fat: 0 },
    });
    expect(item.webtebId).toBeUndefined();
    expect(item.grams).toBe(135);
  });

  it('coerces string grams and strips invalid role', () => {
    const item = sanitizePlanMealLogItem({
      name: 'Dried egg whites',
      grams: '120',
      role: 'dairy-and-egg',
    });
    expect(item.grams).toBe(120);
    expect(item.role).toBeUndefined();
  });

  it('fills null macro fields with zero', () => {
    const item = sanitizePlanMealLogItem({
      name: 'Dried egg whites',
      grams: 100,
      macrosPer100: { calories: 356, protein: null, carbs: 7.8, fat: 0 },
    });
    expect(item.macrosPer100).toEqual({ calories: 356, protein: 0, carbs: 7.8, fat: 0 });
  });

  it('sanitizes full body and caps item count', () => {
    const body = sanitizePlanMealLogBody({
      slotId: 'meal-0',
      date: '2026-06-19',
      items: [
        { name: 'Eggs', grams: '100', webtebId: null, role: 'protein' },
        { name: '', grams: 50 },
      ],
    });
    expect(body.slotId).toBe('meal-0');
    expect(body.date).toBe('2026-06-19');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe('Eggs');
  });
});
