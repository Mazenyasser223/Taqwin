/**
 * Block C9 — adaptation engine unit tests.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { evaluateAdaptation } = requireFromHere('../src/lib/adaptation/adaptationEngine');

describe('evaluateAdaptation', () => {
  it('keeps when adherence is strong and no triggers', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 88, missedWorkoutDays: 0, painReports: 0, plateauWeeks: 0 },
      { locale: 'en' }
    );
    expect(r.decision).toBe('keep');
    expect(r.requiresConfirmation).toBe(false);
  });

  it('micro on pain report', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 75, missedWorkoutDays: 0, painReports: 1, plateauWeeks: 0 },
      { locale: 'ar' }
    );
    expect(r.decision).toBe('micro');
  });

  it('meso on 3 missed workout days', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 60, missedWorkoutDays: 3, painReports: 0, plateauWeeks: 0 },
      { locale: 'en' }
    );
    expect(r.decision).toBe('meso');
  });

  it('macro on weight spike with confirmation', () => {
    const r = evaluateAdaptation(
      {
        overallAdherence: 70,
        missedWorkoutDays: 0,
        weightSpike: true,
        weightDeltaKg: 2.1,
        painReports: 0,
        plateauWeeks: 0,
      },
      { locale: 'en' }
    );
    expect(r.decision).toBe('macro');
    expect(r.requiresConfirmation).toBe(true);
  });

  it('meso on low adherence under 50%', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 42, missedWorkoutDays: 1, painReports: 0, plateauWeeks: 0 },
      { locale: 'en' }
    );
    expect(r.decision).toBe('meso');
  });
});
