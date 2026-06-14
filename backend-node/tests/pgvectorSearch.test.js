import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  normalizeLevels,
  clampLimit,
  padVector,
  toVectorLiteral,
  EMBED_DIMS,
} = requireFromHere('../src/lib/rag/pgvectorSearch');

describe('pgvectorSearch helpers', () => {
  it('normalizeLevels accepts valid enum values', () => {
    expect(normalizeLevels(['L2_EXERCISE', 'L3_NUTRITION'])).toEqual([
      'L2_EXERCISE',
      'L3_NUTRITION',
    ]);
  });

  it('normalizeLevels dedupes and rejects invalid', () => {
    expect(normalizeLevels(['L1_INTERNAL', 'L1_INTERNAL'])).toEqual(['L1_INTERNAL']);
    expect(() => normalizeLevels(['L9_FAKE'])).toThrow(/Invalid knowledge level/);
  });

  it('clampLimit respects bounds', () => {
    expect(clampLimit(3)).toBe(3);
    expect(clampLimit(999)).toBe(50);
    expect(clampLimit('bad')).toBe(8);
  });

  it('padVector zero-pads to EMBED_DIMS', () => {
    const padded = padVector([0.1, 0.2], EMBED_DIMS);
    expect(padded.length).toBe(EMBED_DIMS);
    expect(padded[0]).toBeCloseTo(0.1);
    expect(padded[2]).toBe(0);
  });

  it('toVectorLiteral formats pgvector literal', () => {
    expect(toVectorLiteral([1, 2])).toBe('[1.00000000,2.00000000]');
  });
});
