import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAthleteOnboardingFullyComplete,
  didAthleteOnboardingBecomeComplete,
} from '../src/lib/plans/onboardingComplete.js';

describe('Block C4 onboarding complete detection', () => {
  const full = {
    coreCompletedAt: '2026-01-01',
    workoutPlanCompletedAt: '2026-01-02',
    dietPlanCompletedAt: '2026-01-03',
    wellnessCompletedAt: '2026-01-04',
  };

  it('isAthleteOnboardingFullyComplete requires all four flow timestamps', () => {
    expect(isAthleteOnboardingFullyComplete(null)).toBe(false);
    expect(isAthleteOnboardingFullyComplete({ ...full, wellnessCompletedAt: undefined })).toBe(false);
    expect(isAthleteOnboardingFullyComplete(full)).toBe(true);
  });

  it('didAthleteOnboardingBecomeComplete only on transition', () => {
    const partial = { coreCompletedAt: 'x', workoutPlanCompletedAt: 'y' };
    expect(didAthleteOnboardingBecomeComplete(partial, full)).toBe(true);
    expect(didAthleteOnboardingBecomeComplete(full, full)).toBe(false);
    expect(didAthleteOnboardingBecomeComplete(null, full)).toBe(true);
  });
});

describe('Block C4 maybeTriggerPlanOnOnboardingComplete', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('skips non-athlete roles', async () => {
    const { maybeTriggerPlanOnOnboardingComplete } = await import(
      '../src/lib/plans/triggerPlanOnOnboarding.js'
    );
    const result = await maybeTriggerPlanOnOnboardingComplete({
      userId: 'u1',
      role: 'trainer',
      previousOnboarding: {},
      nextOnboarding: {
        coreCompletedAt: 'a',
        workoutPlanCompletedAt: 'b',
        dietPlanCompletedAt: 'c',
        wellnessCompletedAt: 'd',
      },
    });
    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('not_athlete');
  });
});
