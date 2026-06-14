import { describe, it, expect } from 'vitest';
import {
  buildFemaleHealthAdaptationNotes,
  isFemaleAthlete,
} from '../src/lib/plans/femaleHealthAdaptationContext.js';
import { formatOnboardingForPrompt, extractOnboardingForCoach } from '../src/lib/onboardingForCoach.js';

describe('femaleHealthAdaptationContext', () => {
  it('isFemaleAthlete respects needsFemaleWellness flag', () => {
    expect(isFemaleAthlete({ gender: 'Male', needsFemaleWellness: true })).toBe(true);
    expect(isFemaleAthlete({ gender: 'Male' })).toBe(false);
    expect(isFemaleAthlete({ gender: 'Female' })).toBe(true);
  });

  it('buildFemaleHealthAdaptationNotes covers pregnancy and cycle symptoms', () => {
    const notes = buildFemaleHealthAdaptationNotes({
      gender: 'Female',
      needsFemaleWellness: true,
      pregnancyStatus: 'yes',
      cycleSymptoms: ['bloating', 'fatigue'],
      breastfeeding: 'yes',
      femaleHealthConditions: ['pcos'],
    });
    expect(notes.some((n) => n.includes('SAFETY — pregnant'))).toBe(true);
    expect(notes.some((n) => n.includes('water retention'))).toBe(true);
    expect(notes.some((n) => n.includes('Breastfeeding'))).toBe(true);
    expect(notes.some((n) => n.includes('pcos'))).toBe(true);
  });

  it('formatOnboardingForPrompt includes female health adaptation', () => {
    const extracted = extractOnboardingForCoach({
      gender: 'Female',
      needsFemaleWellness: true,
      cycleRegularity: 'irregular',
      pregnancyStatus: 'yes',
    });
    const prompt = formatOnboardingForPrompt(extracted);
    expect(prompt).toContain('FEMALE HEALTH ADAPTATION');
    expect(prompt).toContain('SAFETY — pregnant');
  });
});
