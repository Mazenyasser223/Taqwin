/**
 * Unit tests for plan product recommendation slots.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildSlots } = require('../src/lib/commerce/planProductRecommendations');

describe('buildSlots', () => {
  it('recommends protein + creatine + shaker for muscle goal', () => {
    const slots = buildSlots({
      goal: 'muscle',
      fitnessLevel: 'intermediate',
      activityLevel: 'moderate',
      supplementsBudget: '',
      isVegan: false,
      weightKg: 80,
      proteinTargetG: 176,
    });
    const ids = slots.map((s) => s.slot);
    expect(ids).toContain('protein');
    expect(ids).toContain('creatine');
    expect(ids).toContain('shaker');
  });

  it('skips whey for vegan athletes', () => {
    const slots = buildSlots({
      goal: 'muscle',
      fitnessLevel: 'intermediate',
      activityLevel: 'moderate',
      supplementsBudget: '',
      isVegan: true,
      weightKg: 70,
      proteinTargetG: 154,
    });
    expect(slots.some((s) => s.slot === 'protein')).toBe(false);
  });

  it('variant A excludes shaker', () => {
    const slots = buildSlots(
      {
        goal: 'muscle',
        fitnessLevel: 'intermediate',
        activityLevel: 'moderate',
        supplementsBudget: '',
        isVegan: false,
        weightKg: 80,
        proteinTargetG: 176,
      },
      { includeShaker: false },
    );
    const ids = slots.map((s) => s.slot);
    expect(ids).toContain('protein');
    expect(ids).toContain('creatine');
    expect(ids).not.toContain('shaker');
  });

  it('skips creatine when already listed in supplementsBudget', () => {
    const slots = buildSlots({
      goal: 'muscle',
      fitnessLevel: 'advanced',
      activityLevel: 'high',
      supplementsBudget: 'whey + creatine daily',
      isVegan: false,
      weightKg: 75,
      proteinTargetG: 165,
    });
    expect(slots.some((s) => s.slot === 'creatine')).toBe(false);
    expect(slots.some((s) => s.slot === 'protein')).toBe(false);
  });
});
