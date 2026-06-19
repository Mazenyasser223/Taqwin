import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { planStructureEditBlockedMessage } = requireFromHere('../src/lib/plans/planEditPolicy');

describe('planEditPolicy messages', () => {
  it('returns localized blocked messages', () => {
    expect(planStructureEditBlockedMessage('en')).toMatch(/AI Coach/i);
    expect(planStructureEditBlockedMessage('ar')).toMatch(/المدرب/);
  });
});
