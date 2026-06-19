import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { weekStartIso, weekStartSundayUtc } = requireFromHere('../src/lib/plans/planWeek');
const {
  toLegacyPlanDocument,
  mapLegacySourceToPrisma,
} = requireFromHere('../src/lib/plans/persistPostgres');
const { validatePlanForPersist, validatePlan } = requireFromHere('../src/lib/plans/planValidation');

describe('Block C2 planWeek', () => {
  it('weekStartIso returns YYYY-MM-DD Sunday', () => {
    const iso = weekStartIso(new Date('2026-06-03T12:00:00Z')); // Wed
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = weekStartSundayUtc(new Date('2026-06-03T12:00:00Z'));
    expect(d.getUTCDay()).toBe(0);
  });
});

describe('Block C2 persistPostgres helpers', () => {
  it('mapLegacySourceToPrisma maps fallback and regen', () => {
    expect(mapLegacySourceToPrisma('fallback')).toBe('manual');
    expect(mapLegacySourceToPrisma('ai', 'user requested')).toBe('manual');
    expect(mapLegacySourceToPrisma('ai', '')).toBe('onboarding');
  });

  it('toLegacyPlanDocument preserves diet and workout shape', () => {
    const planData = {
      dailyTargets: { calories: 2000, protein: 140, carbs: 200, fat: 60, waterMl: 2500 },
      dietDays: [
        {
          dayIndex: 1,
          meals: [
            {
              slot: 'breakfast',
              items: [{ name: 'Oats', grams: 100, protein: 12, calories: 100, carbs: 10, fat: 2 }],
            },
          ],
        },
      ],
      workoutWeeks: [
        {
          weekIndex: 1,
          days: [{ dayIndex: 1, isRest: true, exercises: [] }],
        },
      ],
      coachNotes: 'test',
    };
    const doc = toLegacyPlanDocument({
      userId: 'u1',
      workoutPlan: { id: 'wp1', createdAt: new Date(), updatedAt: new Date() },
      dietPlan: { id: 'dp1', createdAt: new Date(), updatedAt: new Date() },
      planData,
      legacySource: 'ai',
      locale: 'en',
      version: 2,
    });
    expect(doc.version).toBe(2);
    expect(doc.dietDays).toHaveLength(1);
    expect(doc.workoutWeeks[0].days[0].isRest).toBe(true);
    expect(doc.postgres.workoutPlanId).toBe('wp1');
  });
});

describe('Block C2 planValidation', () => {
  it('re-exports validatePlan', async () => {
    const bad = await validatePlan({ dietDays: [] });
    expect(bad.ok).toBe(false);
    const same = await validatePlanForPersist({ dietDays: [] });
    expect(same.ok).toBe(false);
  });
});
