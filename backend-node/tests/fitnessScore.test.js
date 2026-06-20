/**
 * Fitness score unit tests — parity with frontend/features/dashboard/fitnessScore.ts
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  mealProgressFromCalories,
  sleepProgressFromHours,
  sleepHoursFromPreference,
  scoreFromPillarProgress,
  computeFitnessScoreFromInputs,
  CALORIE_TOLERANCE,
} = requireFromHere('../src/lib/fitnessScore');

describe('mealProgressFromCalories', () => {
  it('returns 1 within calorie tolerance', () => {
    expect(mealProgressFromCalories(2000, 2100)).toBe(1);
    expect(mealProgressFromCalories(2000, 2000 + CALORIE_TOLERANCE)).toBe(1);
  });

  it('decays beyond tolerance', () => {
    const over = mealProgressFromCalories(2000 + CALORIE_TOLERANCE + 300, 2000);
    expect(over).toBeGreaterThan(0);
    expect(over).toBeLessThan(1);
  });

  it('returns 0 when no food logged', () => {
    expect(mealProgressFromCalories(0, 2000)).toBe(0);
  });
});

describe('sleepProgressFromHours', () => {
  it('full credit between 6 and 11 hours', () => {
    expect(sleepProgressFromHours(7)).toBe(1);
    expect(sleepProgressFromHours(6)).toBe(1);
    expect(sleepProgressFromHours(11)).toBe(1);
  });

  it('penalizes short sleep', () => {
    expect(sleepProgressFromHours(4)).toBeLessThan(1);
    expect(sleepProgressFromHours(4)).toBeGreaterThan(0);
  });
});

describe('sleepHoursFromPreference', () => {
  it('maps onboarding bands', () => {
    expect(sleepHoursFromPreference('7-8')).toBe(7.5);
    expect(sleepHoursFromPreference('lt5')).toBe(4.5);
  });
});

describe('computeFitnessScoreFromInputs', () => {
  it('scores 100 when all pillars complete', () => {
    const r = computeFitnessScoreFromInputs({
      sleepPreference: '7-8',
      caloriesEaten: 2000,
      calorieTarget: 2000,
      waterCurrentMl: 2500,
      waterTargetMl: 2500,
      workoutProgress: 1,
    });
    expect(r.score).toBe(100);
    expect(r.sleepPts).toBe(20);
    expect(r.mealsPts).toBe(30);
    expect(r.waterPts).toBe(20);
    expect(r.workoutPts).toBe(30);
  });

  it('scores 0 with no activity', () => {
    const r = computeFitnessScoreFromInputs({
      sleepPreference: 'lt5',
      caloriesEaten: 0,
      calorieTarget: 2000,
      waterCurrentMl: 0,
      waterTargetMl: 2500,
      workoutProgress: 0,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThan(50);
    expect(r.mealsPts).toBe(0);
    expect(r.workoutPts).toBe(0);
  });

  it('matches scoreFromPillarProgress helper', () => {
    const pillars = { sleep: 1, meals: 0.5, water: 0.8, workout: 1 };
    expect(scoreFromPillarProgress(pillars)).toBe(
      Math.round(1 * 20 + 0.5 * 30 + 0.8 * 20 + 1 * 30)
    );
  });
});
