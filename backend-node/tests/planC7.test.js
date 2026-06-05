import { describe, it, expect } from 'vitest';
import { buildProgressSummary, buildNextAction } from '../src/lib/plans/dashboardTodayPlan.js';

describe('Block C7 dashboardTodayPlan', () => {
  it('buildProgressSummary maps adherence fields', () => {
    const s = buildProgressSummary({
      calorieAdherenceToday: 80,
      proteinAdherenceToday: 90,
      workoutCompletionToday: 50,
      workoutCompletionWeek: 60,
      weightDeltaWeek: -0.5,
      bodyScore: 75,
    });
    expect(s.calorieAdherenceToday).toBe(80);
    expect(s.workoutCompletionWeek).toBe(60);
    expect(s.bodyScore).toBe(75);
  });

  it('buildNextAction prefers explainability text', () => {
    expect(
      buildNextAction({
        isRest: false,
        hasLoggedWorkout: false,
        workoutCompletionToday: 0,
        mealsMet: false,
        explainabilityText: 'Focus on protein today.',
        locale: 'en',
      })
    ).toBe('Focus on protein today.');
  });

  it('buildNextAction suggests workout when not rest and low completion', () => {
    const ar = buildNextAction({
      isRest: false,
      hasLoggedWorkout: false,
      workoutCompletionToday: 10,
      mealsMet: true,
      locale: 'ar',
    });
    expect(ar).toContain('تمرين');
  });

  it('buildNextAction rest day message', () => {
    const en = buildNextAction({
      isRest: true,
      hasLoggedWorkout: false,
      workoutCompletionToday: 0,
      mealsMet: false,
      locale: 'en',
    });
    expect(en.toLowerCase()).toContain('rest');
  });
});
