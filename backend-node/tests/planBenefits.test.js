import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizePlanBenefits,
  parsePlanBenefitsInput,
} = require('../src/lib/planBenefits');

describe('planBenefits', () => {
  it('normalizePlanBenefits strips zero and empty values', () => {
    expect(normalizePlanBenefits(null)).toBeNull();
    expect(normalizePlanBenefits({ freezeWeeks: 0, invitations: 0 })).toBeNull();
    expect(normalizePlanBenefits({ freezeWeeks: 2, invitations: 3 })).toEqual({
      freezeWeeks: 2,
      invitations: 3,
    });
  });

  it('parsePlanBenefitsInput validates and normalizes', () => {
    expect(parsePlanBenefitsInput(undefined)).toBeUndefined();
    expect(parsePlanBenefitsInput(null)).toBeNull();
    expect(
      parsePlanBenefitsInput({
        freezeWeeks: 4,
        privateCoachSessions: 2,
      }),
    ).toEqual({
      freezeWeeks: 4,
      privateCoachSessions: 2,
    });
  });

  it('parsePlanBenefitsInput accepts unlimited (-1)', () => {
    expect(
      parsePlanBenefitsInput({
        spa: -1,
        jacuzzi: 2,
      }),
    ).toEqual({
      spa: -1,
      jacuzzi: 2,
    });
  });

  it('parsePlanBenefitsInput rejects invalid values', () => {
    expect(() => parsePlanBenefitsInput({ freezeWeeks: 100 })).toThrow();
  });
});
