import type { OnboardingStep } from '../types';
import { FEMALE_HEALTH_STEP_IDS } from './femaleHealthSteps';

/** Medical history values that require doctor clearance before exercise. */
export const DOCTOR_CLEARANCE_MEDICAL_TRIGGERS = new Set([
  'heart_condition',
  'hypertension',
  'diabetes',
  'surgery_recent',
  'eating_disorder',
  'asthma',
  'back_spine',
]);

/** Legacy medicalHistory value — migrated to female-health steps. */
export const PREGNANCY_POSTPARTUM_MEDICAL = 'pregnancy_postpartum';

export const MENOPAUSE_MIN_AGE = 40;

const FEMALE_ONLY_STEPS = new Set<string>(FEMALE_HEALTH_STEP_IDS);

const AGE_RANGE_MID: Record<string, number> = {
  '18-29': 24,
  '30-39': 35,
  '40-49': 45,
  '50+': 55,
};

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

export function isMaleGender(gender: unknown): boolean {
  const g = String(gender ?? '')
    .trim()
    .toLowerCase();
  return g === 'male' || g === 'm';
}

export function isFemaleGender(gender: unknown): boolean {
  const g = String(gender ?? '')
    .trim()
    .toLowerCase();
  return g === 'female' || g === 'f';
}

/** Gender from onboarding answers, with optional profile fallback. */
export function resolveAthleteGender(
  answers: Record<string, unknown>,
  profileGender?: string | null,
): string | null {
  const fromAnswers = answers.gender;
  if (fromAnswers !== undefined && fromAnswers !== null && String(fromAnswers).trim()) {
    return String(fromAnswers);
  }
  if (profileGender !== undefined && profileGender !== null && String(profileGender).trim()) {
    return String(profileGender);
  }
  return null;
}

/** True when core flagged female wellness or gender is female. */
export function isFemaleAthlete(
  answers: Record<string, unknown>,
  profileGender?: string | null,
): boolean {
  if (answers.needsFemaleWellness === true) return true;
  return isFemaleGender(resolveAthleteGender(answers, profileGender));
}

export function athleteAgeYears(answers: Record<string, unknown>): number | null {
  const ageNum = typeof answers.age === 'number' ? answers.age : Number(answers.age);
  if (Number.isFinite(ageNum) && ageNum > 0) return ageNum;
  const range = String(answers.ageRange ?? '').trim();
  if (range && AGE_RANGE_MID[range]) return AGE_RANGE_MID[range];
  return null;
}

export function shouldShowMenopauseStep(answers: Record<string, unknown>): boolean {
  const age = athleteAgeYears(answers);
  return age != null && age >= MENOPAUSE_MIN_AGE;
}

export function isPregnancyMedicalOptionBlocked(
  answers: Record<string, unknown>,
  profileGender?: string | null,
): boolean {
  return isMaleGender(resolveAthleteGender(answers, profileGender));
}

/** Strip pregnancy/postpartum from general medical history (now in female-health steps). */
export function sanitizeWellnessMedicalHistory<T extends Record<string, unknown>>(
  answers: T,
  profileGender?: string | null,
): T {
  const list = arr(answers.medicalHistory);
  if (!list.includes(PREGNANCY_POSTPARTUM_MEDICAL)) return answers;
  const filtered = list.filter((c) => c !== PREGNANCY_POSTPARTUM_MEDICAL);
  return {
    ...answers,
    medicalHistory: filtered.length ? filtered : undefined,
  };
}

export function isActivePostpartum(postpartumStatus: unknown): boolean {
  const v = String(postpartumStatus ?? '').trim();
  return v !== '' && v !== 'no' && v !== 'prefer_not_to_say';
}

export function requiresDoctorClearance(answers: Record<string, unknown>): boolean {
  const conditions = arr(answers.medicalHistory).filter((c) => c !== 'none');
  if (conditions.some((c) => DOCTOR_CLEARANCE_MEDICAL_TRIGGERS.has(c))) return true;
  if (String(answers.pregnancyStatus ?? '') === 'yes') return true;
  if (isActivePostpartum(answers.postpartumStatus)) return true;
  return false;
}

export function adaptWellnessStep(
  step: OnboardingStep,
  answers: Record<string, unknown>,
  profileGender?: string | null,
): OnboardingStep {
  if (step.id === 'medicalHistory' && step.type === 'multi') {
    return {
      ...step,
      options: step.options.filter((o) => o.value !== PREGNANCY_POSTPARTUM_MEDICAL),
    };
  }
  return step;
}

export function shouldSkipWellnessStep(
  stepId: string,
  answers: Record<string, unknown>,
  profileGender?: string | null,
): boolean {
  if (stepId === 'doctorClearance') {
    return !requiresDoctorClearance(answers);
  }
  if (FEMALE_ONLY_STEPS.has(stepId)) {
    if (!isFemaleAthlete(answers, profileGender)) return true;
    if (stepId === 'menopause' && !shouldShowMenopauseStep(answers)) return true;
  }
  return false;
}
