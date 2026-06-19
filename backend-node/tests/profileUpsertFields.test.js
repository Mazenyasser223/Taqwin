import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { ATHLETE_UPSERT_FIELDS, GYM_UPSERT_FIELDS } = requireFromHere('../src/lib/profile');

/** Must stay in sync with ATHLETE_PROFILE_FIELDS in src/routes/profile.js */
const ATHLETE_ROUTE_PATCH_FIELDS = [
  'displayName',
  'avatarUrl',
  'coverUrl',
  'dateOfBirth',
  'gender',
  'height',
  'weight',
  'fitnessGoal',
  'fitnessLevel',
  'medicalNotes',
  'onboardingData',
];

/** Must stay in sync with GYM_PROFILE_FIELDS in src/routes/profile.js */
const GYM_ROUTE_PATCH_FIELDS = [
  'displayName',
  'avatarUrl',
  'coverUrl',
  'bio',
  'businessName',
  'businessAddress',
  'businessPhone',
  'websiteUrl',
];

describe('profile upsert allowed fields', () => {
  it('persists every athlete PATCH /api/profile field (incl. onboardingData)', () => {
    for (const field of ATHLETE_ROUTE_PATCH_FIELDS) {
      expect(ATHLETE_UPSERT_FIELDS).toContain(field);
    }
  });

  it('persists every gym PATCH /api/profile field', () => {
    for (const field of GYM_ROUTE_PATCH_FIELDS) {
      expect(GYM_UPSERT_FIELDS).toContain(field);
    }
  });
});
