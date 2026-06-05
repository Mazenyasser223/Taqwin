/**
 * Block C9 — adaptation engine unit tests.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAdaptation } = require('../src/lib/adaptation/adaptationEngine');

describe('evaluateAdaptation', () => {
  it('keeps when adherence is strong and no triggers', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 88, missedWorkoutDays: 0, painReports: 0, plateauWeeks: 0 },
      { locale: 'en' }
    );
    assert.equal(r.decision, 'keep');
    assert.equal(r.requiresConfirmation, false);
  });

  it('micro on pain report', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 75, missedWorkoutDays: 0, painReports: 1, plateauWeeks: 0 },
      { locale: 'ar' }
    );
    assert.equal(r.decision, 'micro');
  });

  it('meso on 3 missed workout days', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 60, missedWorkoutDays: 3, painReports: 0, plateauWeeks: 0 },
      { locale: 'en' }
    );
    assert.equal(r.decision, 'meso');
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
    assert.equal(r.decision, 'macro');
    assert.equal(r.requiresConfirmation, true);
  });

  it('meso on low adherence under 50%', () => {
    const r = evaluateAdaptation(
      { overallAdherence: 42, missedWorkoutDays: 1, painReports: 0, plateauWeeks: 0 },
      { locale: 'en' }
    );
    assert.equal(r.decision, 'meso');
  });
});
