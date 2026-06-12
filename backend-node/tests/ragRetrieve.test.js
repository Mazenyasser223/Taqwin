import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { synthesizePlanQuery, buildContextTags } = requireFromHere('../src/lib/rag/ragQuery');
const { LEVEL_BY_KIND, ragRetrieve, buildTrace } = requireFromHere('../src/lib/rag/ragRetrieve');
const {
  filterFoodCandidates,
  applyFoodRanking,
  normaliseFoodRow,
} = requireFromHere('../src/lib/rag/catalogFood');
const { filterExerciseCandidates, scoreExerciseRow } = requireFromHere(
  '../src/lib/rag/catalogExercise'
);

describe('ragQuery', () => {
  it('buildContextTags includes goal and diet signals', () => {
    const tags = buildContextTags({
      onboardingData: { dietType: 'high_protein', religiousDiet: 'halal' },
      profile: { fitnessGoal: 'lose fat', fitnessLevel: 'intermediate' },
    });
    expect(tags).toContain('high_protein');
    expect(tags).toContain('halal');
    expect(tags).toContain('fat-loss');
  });

  it('synthesizePlanQuery prefers explicit message', () => {
    expect(
      synthesizePlanQuery({
        kind: 'food',
        message: 'chicken breast lunch',
        onboardingData: { dietType: 'keto' },
      })
    ).toBe('chicken breast lunch');
  });

  it('synthesizePlanQuery builds food query from onboarding', () => {
    const q = synthesizePlanQuery({
      kind: 'food',
      onboardingData: { dietType: 'high_protein', primaryGoal: 'build muscle' },
    });
    expect(q).toMatch(/high_protein/i);
    expect(q).toMatch(/meal plan/i);
  });

  it('synthesizePlanQuery builds book query from profile goal', () => {
    const q = synthesizePlanQuery({
      kind: 'book',
      profile: { fitnessGoal: 'hypertrophy' },
      onboardingData: { dietType: 'balanced' },
    });
    expect(q).toMatch(/hypertrophy|coaching philosophy/i);
  });
});

describe('ragRetrieve constants', () => {
  it('maps catalog kinds to knowledge levels', () => {
    expect(LEVEL_BY_KIND.food).toEqual(['L3_NUTRITION']);
    expect(LEVEL_BY_KIND.exercise).toEqual(['L2_EXERCISE']);
    expect(LEVEL_BY_KIND.book).toEqual(['L5_BOOKS']);
  });
});

describe('ragRetrieve API', () => {
  it('buildTrace normalizes purpose and mode', () => {
    const trace = buildTrace({
      purpose: 'plan_catalog',
      kind: 'food',
      path: 'sql',
      hitCount: 12,
      fallback: 'sql_only',
    });
    expect(trace.purpose).toBe('plan_catalog');
    expect(trace.mode).toBe('catalog');
    expect(trace.fallback).toBe('sql_only');
    expect(trace.hitCount).toBe(12);
  });

  it('ragRetrieve chat requires levels', async () => {
    await expect(ragRetrieve({ purpose: 'chat', query: 'protein' })).rejects.toThrow(/levels/);
  });

  it('ragRetrieve plan_catalog requires kind', async () => {
    await expect(
      ragRetrieve({ purpose: 'plan_catalog', onboardingData: {}, limit: 5 })
    ).rejects.toThrow(/kind/);
  });
});

describe('catalogFood filters', () => {
  it('excludes explicit food exclusions', () => {
    const rows = [
      normaliseFoodRow(
        { id: '1', name: 'Peanut butter', protein: 25, calories: 600, carbs: 20, fat: 50 },
        'foodItem'
      ),
      normaliseFoodRow(
        { id: '2', name: 'Chicken breast', protein: 31, calories: 165, carbs: 0, fat: 4 },
        'foodItem'
      ),
    ];
    const filtered = filterFoodCandidates(rows, { foodsExcluded: ['peanut'] });
    expect(filtered.map((f) => f.name)).toEqual(['Chicken breast']);
  });

  it('applyFoodRanking boosts breakfast slot matches', () => {
    const ranked = applyFoodRanking(
      [
        normaliseFoodRow(
          { id: '1', name: 'Beef steak', protein: 26, calories: 250, carbs: 0, fat: 15 },
          'foodItem'
        ),
        normaliseFoodRow(
          { id: '2', name: 'Greek yogurt', protein: 10, calories: 100, carbs: 4, fat: 0 },
          'foodItem'
        ),
      ],
      { mealSlot: 'breakfast', limit: 2 }
    );
    expect(ranked[0].name).toBe('Greek yogurt');
  });
});

describe('catalogExercise filters', () => {
  it('blocks injury-conflicting exercises', () => {
    const rows = [
      {
        id: 'a',
        name: 'Barbell Back Squat',
        category: 'legs',
        difficulty: 'intermediate',
        primaryMuscles: ['quads'],
      },
      {
        id: 'b',
        name: 'Leg Press',
        category: 'machine',
        difficulty: 'beginner',
        primaryMuscles: ['quads'],
      },
    ];
    const filtered = filterExerciseCandidates(rows, {
      onboardingData: { injuries: ['legs'] },
    });
    expect(filtered.some((e) => /squat/i.test(e.name))).toBe(false);
  });

  it('scoreExerciseRow boosts loved exercises', () => {
    const scored = scoreExerciseRow(
      {
        id: 'x',
        name: 'Lat Pulldown',
        category: 'cable',
        difficulty: 'beginner',
        primaryMuscles: ['lats'],
      },
      { onboardingData: { exercisesLove: ['pulldown'] } }
    );
    expect(scored.score).toBeGreaterThan(0);
  });
});
