/**
 * Social challenge config unit tests.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  progressPct,
  XP_DUEL_WIN,
  SQUAD_MIN_MEMBERS,
  SQUAD_MAX_MEMBERS,
} = requireFromHere('../src/lib/gamification/challengeConfig');

describe('progressPct', () => {
  it('caps at 100%', () => {
    expect(progressPct(10, 5)).toBe(100);
    expect(progressPct(2, 5)).toBe(40);
    expect(progressPct(0, 5)).toBe(0);
  });

  it('handles invalid target', () => {
    expect(progressPct(5, 0)).toBe(0);
  });
});

describe('social constants', () => {
  it('defines duel and squad rewards', () => {
    expect(XP_DUEL_WIN).toBeGreaterThan(0);
    expect(SQUAD_MIN_MEMBERS).toBeGreaterThanOrEqual(2);
    expect(SQUAD_MAX_MEMBERS).toBeLessThanOrEqual(5);
  });
});
