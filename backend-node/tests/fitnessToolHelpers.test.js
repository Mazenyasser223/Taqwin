import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { normalizeStringArray } = requireFromHere('../src/lib/fitnessToolHelpers');

describe('fitnessToolHelpers', () => {
  it('normalizeStringArray splits comma strings and filters empty', () => {
    expect(normalizeStringArray('knees, back,  ')).toEqual(['knees', 'back']);
    expect(normalizeStringArray(['Shoulder', 'NONE'])).toEqual(['shoulder', 'none']);
    expect(normalizeStringArray(null)).toEqual([]);
  });
});
