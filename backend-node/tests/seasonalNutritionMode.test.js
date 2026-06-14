import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  RAMADAN_MODE,
  hasRamadanReligiousDiet,
  applySeasonalNutritionMode,
} = requireFromHere('../src/lib/plans/seasonalNutritionMode.js');

describe('seasonalNutritionMode', () => {
  it('sets ramadan mode when religiousDiet includes ramadan', () => {
    expect(hasRamadanReligiousDiet(['halal', 'ramadan'])).toBe(true);
    const out = applySeasonalNutritionMode({
      religiousDiet: ['halal', 'ramadan'],
      dietType: 'balanced',
    });
    expect(out.seasonalNutritionMode).toBe(RAMADAN_MODE);
    expect(out.religiousDiet).toEqual(['halal', 'ramadan']);
  });

  it('clears seasonalNutritionMode when ramadan is not selected', () => {
    const out = applySeasonalNutritionMode({
      religiousDiet: ['halal'],
      seasonalNutritionMode: RAMADAN_MODE,
    });
    expect(out.seasonalNutritionMode).toBeUndefined();
  });

  it('handles string religiousDiet', () => {
    expect(hasRamadanReligiousDiet('ramadan')).toBe(true);
    expect(applySeasonalNutritionMode({ religiousDiet: 'ramadan' }).seasonalNutritionMode).toBe(
      RAMADAN_MODE,
    );
  });
});
