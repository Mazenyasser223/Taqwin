import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { foodQueryVariants, scoreWebtebRow, scoreFoodRow } = requireFromHere('../src/lib/aiToolResolvers');

describe('mealCaptureFoodResolve', () => {
  it('foodQueryVariants strips cooking words and keeps meaningful terms', () => {
    const variants = foodQueryVariants('Grilled chicken breast with olive oil');
    expect(variants).toContain('Grilled chicken breast with olive oil');
    expect(variants).toContain('chicken breast olive');
    expect(variants).toContain('chicken');
    expect(variants).toContain('breast');
  });

  it('scoreWebtebRow prefers substring matches', () => {
    const score = scoreWebtebRow(
      { nameEn: 'Chicken breast', nameAr: 'صدر دجاج' },
      'grilled chicken breast'
    );
    expect(score).toBeGreaterThanOrEqual(0.88);
  });

  it('foodQueryVariants splits slash alternatives', () => {
    const variants = foodQueryVariants('Pita/Flatbread');
    expect(variants).toContain('Pita Flatbread');
    expect(variants).toContain('Pita');
    expect(variants).toContain('Flatbread');
  });

  it('scoreFoodRow ranks exact matches highest', () => {
    const exact = scoreFoodRow({ name: 'Rice', nameAr: 'أرز' }, 'rice');
    const partial = scoreFoodRow({ name: 'Brown rice cooked', nameAr: 'أرز بني' }, 'rice bowl');
    expect(exact).toBeGreaterThan(partial);
  });
});
