import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  DIET_FOOD_PREF_FIELDS,
  WORKOUT_EXERCISE_PREF_FIELDS,
  extractOnboardingFoodPicks,
  extractOnboardingExercisePicks,
} = requireFromHere('../src/lib/rag/planOnboardingCatalog');
const { dedupeFoods, dedupeExercises } = requireFromHere('../src/lib/rag/ragRetrieve');

describe('planOnboardingCatalog', () => {
  it('lists diet and workout questionnaire catalog fields', () => {
    expect(DIET_FOOD_PREF_FIELDS).toContain('proteinPrefs');
    expect(DIET_FOOD_PREF_FIELDS).toContain('carbPrefs');
    expect(WORKOUT_EXERCISE_PREF_FIELDS).toEqual(['exercisesLove']);
  });

  it('extracts unique food picks across diet steps', () => {
    const picks = extractOnboardingFoodPicks({
      proteinPrefs: [
        { id: '101', name: 'Chicken breast', catalog: 'food' },
        { id: '102', name: 'Egg whites', catalog: 'food' },
      ],
      carbPrefs: [{ id: '101', name: 'Chicken breast', catalog: 'food' }],
      fatPrefs: [{ id: '55', name: 'Olive oil', catalog: 'food' }],
    });
    expect(picks).toHaveLength(3);
    expect(picks.map((p) => p.webtebId)).toEqual(expect.arrayContaining([101, 102, 55]));
  });

  it('extracts exercise picks by id and legacy string name', () => {
    const picks = extractOnboardingExercisePicks({
      exercisesLove: [
        { id: 'ex-uuid-12345678', name: 'Barbell squat', catalog: 'exercise' },
        'Romanian deadlift',
      ],
    });
    expect(picks).toHaveLength(2);
    expect(picks[0].id).toBe('ex-uuid-12345678');
    expect(picks[1].name).toBe('Romanian deadlift');
  });
});

describe('ragRetrieve dedupe with onboarding priority', () => {
  it('keeps onboarding foods first when deduping', () => {
    const onboarding = [{ id: 'a', webtebId: 1, name: 'Chicken', score: 100 }];
    const rag = [{ id: 'b', webtebId: 1, name: 'Chicken duplicate', score: 1 }];
    const merged = dedupeFoods(onboarding, rag);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Chicken');
  });

  it('keeps onboarding exercises first when deduping', () => {
    const onboarding = [{ id: 'ex1', name: 'Squat', score: 100 }];
    const rag = [{ id: 'ex1', name: 'Squat', score: 2 }];
    const merged = dedupeExercises(onboarding, rag);
    expect(merged).toHaveLength(1);
    expect(merged[0].score).toBe(100);
  });
});
