import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  buildContextBundle,
  buildContextBundleFresh,
  cagCacheKey,
  getCagCacheTtlMs,
  invalidateContextBundle,
} = requireFromHere('../src/lib/contextBundle');

describe('contextBundle (Block A5)', () => {
  const TEST_USER = '11111111-1111-4111-8111-111111111111';

  it('buildContextBundleFresh returns the CAG shape', async () => {
    const bundle = await buildContextBundleFresh(TEST_USER);

    expect(bundle.locale).toBe('ar');
    expect(bundle.timezone).toBeDefined();
    expect(bundle.generatedAt).toBeDefined();
    expect(bundle.nutritionToday).toMatchObject({
      logged: expect.objectContaining({ mealCount: expect.any(Number) }),
      targets: expect.objectContaining({ calories: expect.any(Number) }),
    });
    expect(bundle.behavioralSignals).toEqual({
      skippedMuscleGroups: [],
      preferredExercises: [],
      mealSkipPatterns: [],
    });
    expect(bundle.constraints).toMatchObject({
      injuries: expect.any(Array),
      lifeMode: 'normal',
    });
    expect(Array.isArray(bundle.aiMemories)).toBe(true);
    expect(bundle.progressSnapshot).toBeNull();
    expect(bundle.readinessLatest).toBeNull();
  });

  it('buildContextBundle returns a fresh bundle when Redis is not configured', async () => {
    const bundle = await buildContextBundle(TEST_USER);
    expect(bundle.locale).toBe('ar');
    expect(bundle.nutritionToday.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('cagCacheKey and TTL helpers are stable', () => {
    expect(cagCacheKey(TEST_USER)).toBe(`cag:${TEST_USER}`);
    expect(getCagCacheTtlMs()).toBeGreaterThan(0);
  });

  it('invalidateContextBundle is safe without Redis', async () => {
    await expect(invalidateContextBundle(TEST_USER)).resolves.toBe(false);
  });
});
