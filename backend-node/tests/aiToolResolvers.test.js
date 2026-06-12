import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  parseGramsFromText,
  foodQueryFromText,
  parseReplacePair,
  parseLifeModeFromText,
  matchExerciseInTodayList,
} = requireFromHere('../src/lib/aiToolResolvers');

describe('aiToolResolvers parsers', () => {
  it('parseGramsFromText extracts grams', () => {
    expect(parseGramsFromText('log 200g chicken')).toBe(200);
    expect(parseGramsFromText('150 grams rice')).toBe(150);
    expect(parseGramsFromText('سجل 250 جم دجاج')).toBe(250);
    expect(parseGramsFromText('log chicken lunch')).toBeNull();
  });

  it('foodQueryFromText strips verbs and quantities', () => {
    expect(foodQueryFromText('log 200g chicken breast for lunch')).toBe('chicken breast');
    expect(foodQueryFromText('سجل 150 جم صدر دجاج')).toContain('دجاج');
  });

  it('parseReplacePair extracts old and new exercise names', () => {
    expect(parseReplacePair('replace bench press with dumbbell press')).toEqual({
      oldName: 'bench press',
      newName: 'dumbbell press',
    });
    expect(parseReplacePair('swap squat for leg press today')).toEqual({
      oldName: 'squat',
      newName: 'leg press',
    });
    expect(parseReplacePair('بدّل بنش ب dumbbell press')).toMatchObject({
      oldName: expect.stringContaining('بنش'),
      newName: 'dumbbell press',
    });
  });

  it('parseLifeModeFromText detects modes', () => {
    expect(parseLifeModeFromText('activate travel mode this week')).toBe('travel');
    expect(parseLifeModeFromText('وضع رمضان')).toBe('fasting');
    expect(parseLifeModeFromText('I have knee pain')).toBe('injury_flare');
  });

  it('matchExerciseInTodayList finds exercise by name', () => {
    const exercises = [
      {
        exerciseId: 'a',
        exercise: { name: 'Barbell Bench Press', nameAr: 'بنش بار' },
      },
      {
        exerciseId: 'b',
        exercise: { name: 'Squat', nameAr: 'سكوات' },
      },
    ];
    const hit = matchExerciseInTodayList(exercises, 'bench');
    expect(hit?.exerciseId).toBe('a');
  });
});
