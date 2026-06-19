import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  loadManifest,
  getDietPdfFoodNameList,
  normalizeForMatch,
  scoreNameMatch,
} = requireFromHere('../src/lib/rag/planDietPdfCatalog');

describe('planDietPdfCatalog', () => {
  it('loads manifest with foods from Diet 2–8', () => {
    const manifest = loadManifest();
    expect(manifest.version).toBeGreaterThanOrEqual(1);
    expect(manifest.foods.length).toBeGreaterThan(50);
    expect(manifest.diets['1']).toEqual([]);
    expect(manifest.diets['2']?.length).toBeGreaterThan(0);
  });

  it('manifest foods are bound to webtebId after catalog match', () => {
    const manifest = loadManifest();
    const bound = (manifest.foods || []).filter((f) => f.webtebId != null);
    expect(bound.length).toBe(manifest.foods.length);
  });

  it('getDietPdfFoodNameList returns Arabic names', () => {
    const names = getDietPdfFoodNameList();
    expect(names.length).toBeGreaterThan(50);
    expect(names.some((n) => /[\u0600-\u06FF]/.test(n))).toBe(true);
  });

  it('scoreNameMatch prefers exact Arabic hits', () => {
    const score = scoreNameMatch('موز', {
      nameAr: 'موز',
      nameEn: 'Banana',
    });
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('normalizeForMatch strips punctuation', () => {
    expect(normalizeForMatch('  موز،  ')).toBe('موز');
  });
});
