import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  extractOnboardingForCoach,
  formatOnboardingForPrompt,
  bodyTypeLabel,
} = requireFromHere('../src/lib/onboardingForCoach');

describe('onboardingForCoach', () => {
  it('extracts core, workout, nutrition, and health sections', () => {
    const extracted = extractOnboardingForCoach({
      bodyType: 'mesomorph',
      height: 184,
      weight: 82,
      primaryGoal: 'muscle',
      injuries: ['shoulder', 'none'],
      trainingDaysPerWeek: '4',
      preferredSplit: 'push_pull_legs',
      foodAllergies: ['nuts'],
      dietType: 'high_protein',
      religiousDiet: 'halal',
      sleep: '7_8h',
      medicalHistory: 'none',
    });

    expect(extracted.core.bodyType).toContain('mesomorph');
    expect(extracted.workout.trainingDaysPerWeek).toBe('4');
    expect(extracted.nutrition.dietType).toBe('high_protein');
    expect(extracted.health.sleep).toBe('7_8h');
    expect(extracted.flat.injuries).toEqual(['shoulder']);
    expect(extracted.flat.foodAllergies).toEqual(['nuts']);
  });

  it('formatOnboardingForPrompt includes all non-empty sections', () => {
    const extracted = extractOnboardingForCoach({
      bodyType: 'ectomorph',
      workoutLocation: 'gym',
      foodBudget: 'medium',
      sleep: '6h',
    });
    const text = formatOnboardingForPrompt(extracted);
    expect(text).toContain('ONBOARDING — CORE');
    expect(text).toContain('bodyType:');
    expect(text).toContain('ONBOARDING — WORKOUT');
    expect(text).toContain('ONBOARDING — NUTRITION');
    expect(text).toContain('ONBOARDING — HEALTH');
  });

  it('bodyTypeLabel returns Arabic label', () => {
    expect(bodyTypeLabel('mesomorph', 'ar')).toContain('ميزومورف');
  });

  it('includes seasonalNutritionMode when religiousDiet has ramadan', () => {
    const extracted = extractOnboardingForCoach({
      religiousDiet: ['halal', 'ramadan'],
      seasonalNutritionMode: 'ramadan',
    });
    expect(extracted.nutrition.seasonalNutritionMode).toBe('ramadan');
    const text = formatOnboardingForPrompt(extracted);
    expect(text).toContain('seasonalNutritionMode: ramadan');
  });
});
