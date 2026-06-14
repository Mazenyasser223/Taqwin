import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { applyConflictPolicy } = requireFromHere('../src/services/aiMemoryService');

describe('aiMemoryService conflict policy', () => {
  it('keeps confidence when summary is unchanged', () => {
    const confidence = applyConflictPolicy({
      existing: { summary: 'Avoids dairy' },
      incomingSummary: 'Avoids dairy',
      incomingConfidence: 0.85,
    });
    expect(confidence).toBe(0.85);
  });

  it('keeps confidence when new summary refines existing', () => {
    const confidence = applyConflictPolicy({
      existing: { summary: 'Avoids dairy' },
      incomingSummary: 'Avoids all dairy products',
      incomingConfidence: 0.9,
    });
    expect(confidence).toBe(0.9);
  });

  it('lowers confidence when summary contradicts existing', () => {
    const confidence = applyConflictPolicy({
      existing: { summary: 'Vegetarian — no meat' },
      incomingSummary: 'Eats chicken daily',
      incomingConfidence: 0.9,
    });
    expect(confidence).toBeCloseTo(0.75, 2);
  });
});
