import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { buildBehavioralSignals } = requireFromHere('../src/lib/cag/behavioralSignals');

describe('behavioralSignals (Block D7)', () => {
  const TEST_USER = '11111111-1111-4111-8111-111111111111';

  it('returns stable CAG signal shape with empty DB', async () => {
    const signals = await buildBehavioralSignals(TEST_USER);
    expect(signals).toMatchObject({
      skippedMuscleGroups: expect.any(Array),
      preferredExercises: expect.any(Array),
      mealSkipPatterns: expect.any(Array),
      recentChangeTypes: expect.any(Array),
      chatAdaptCount: expect.any(Number),
    });
  });
});
