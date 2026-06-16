/**
 * Achievement catalog unit tests.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { listAchievementCatalog, getAchievementMeta } = requireFromHere(
  '../src/lib/gamification/achievementCatalog.js'
);

describe('achievementCatalog', () => {
  it('includes league and challenge badges', () => {
    const catalog = listAchievementCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(9);
    expect(getAchievementMeta('league_promoted').category).toBe('league');
    expect(getAchievementMeta('challenge_workout_7').category).toBe('challenge');
  });
});
