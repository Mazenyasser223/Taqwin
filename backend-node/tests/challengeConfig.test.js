/**
 * Challenge config + progress helpers unit tests.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  CHALLENGE_TEMPLATES,
  CHALLENGE_TEMPLATES_BY_SLUG,
  enumerateDateKeys,
  maxConsecutiveTrue,
} = requireFromHere('../src/lib/gamification/challengeConfig');

describe('challenge catalog', () => {
  it('seeds six MVP challenges', () => {
    expect(CHALLENGE_TEMPLATES).toHaveLength(6);
    expect(CHALLENGE_TEMPLATES_BY_SLUG['workout-7']?.metric).toBe('workout_days');
    expect(CHALLENGE_TEMPLATES_BY_SLUG['streak-7']?.metric).toBe('workout_streak');
  });
});

describe('enumerateDateKeys', () => {
  it('returns inclusive range', () => {
    const keys = enumerateDateKeys('2026-06-10', '2026-06-16');
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-06-10');
    expect(keys[6]).toBe('2026-06-16');
  });
});

describe('maxConsecutiveTrue', () => {
  it('finds longest workout streak window', () => {
    const keys = ['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13'];
    const workoutDays = new Set(['2026-06-10', '2026-06-11', '2026-06-13']);
    const streak = maxConsecutiveTrue(keys, (k) => workoutDays.has(k));
    expect(streak).toBe(2);
  });
});
