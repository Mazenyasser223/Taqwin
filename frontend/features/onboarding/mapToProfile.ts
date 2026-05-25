import type { OnboardingAnswers } from './types';
import type { UpdateProfileData } from '../../services/profileService';

function str(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return String(v);
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v) return [v];
  return [];
}

const AGE_RANGE_MID: Record<string, number> = {
  '18-29': 24,
  '30-39': 35,
  '40-49': 45,
  '50+': 55,
};

function dateOfBirthFromAnswers(answers: OnboardingAnswers): string | undefined {
  const ageNum = typeof answers.age === 'number' ? answers.age : Number(answers.age);
  if (Number.isFinite(ageNum) && ageNum > 0) {
    return `${new Date().getFullYear() - ageNum}-01-01`;
  }
  const range = str(answers.ageRange);
  if (range && AGE_RANGE_MID[range]) {
    return `${new Date().getFullYear() - AGE_RANGE_MID[range]}-01-01`;
  }
  return undefined;
}

/** Map onboarding answers → API profile payload */
export function mapAnswersToProfile(answers: OnboardingAnswers): UpdateProfileData & {
  onboardingData: Record<string, unknown>;
} {
  const injuries = arr(answers.injuries).filter((i) => i !== 'none');
  const pastInjuries = arr(answers.pastInjuriesHistory).filter((i) => i !== 'none');
  const medicalParts: string[] = [];
  if (injuries.length) medicalParts.push(`Injuries/limitations: ${injuries.join(', ')}`);
  if (pastInjuries.length) medicalParts.push(`Past injuries: ${pastInjuries.join(', ')}`);
  const medHistory = str(answers.medicalHistory);
  const meds = str(answers.medications);
  if (medHistory) medicalParts.push(`Medical history: ${medHistory}`);
  if (meds) medicalParts.push(`Medications: ${meds}`);

  const goal = str(answers.primaryGoal) ?? str(answers.goal12Week) ?? 'Build Muscle';

  const address = str(answers.address);
  const city = str(answers.city);
  const addressLine = [address, city].filter(Boolean).join(', ');

  return {
    displayName: str(answers.displayName),
    businessAddress: addressLine || undefined,
    businessPhone: str(answers.phone),
    gender: str(answers.gender),
    dateOfBirth: dateOfBirthFromAnswers(answers),
    height: typeof answers.height === 'number' ? answers.height : Number(answers.height) || undefined,
    weight: typeof answers.weight === 'number' ? answers.weight : Number(answers.weight) || undefined,
    fitnessGoal: goal,
    fitnessLevel: str(answers.fitnessLevel) ?? 'Intermediate',
    medicalNotes: medicalParts.length ? medicalParts.join('\n') : undefined,
    onboardingData: buildOnboardingPayload(answers, { completed: true }),
  };
}

/** Partial save while user progresses through wizard */
export function mapAnswersToProgress(
  answers: OnboardingAnswers,
  stepIndex: number,
  lastStepId?: string,
) {
  const partial = mapAnswersToProfile(answers);
  return {
    ...partial,
    onboardingData: buildOnboardingPayload(answers, {
      stepIndex,
      inProgress: true,
      lastStepId,
    }),
  };
}

const META_KEYS = [
  'progressStepIndex',
  'inProgress',
  'completedAt',
  'version',
  'lastStepId',
  'savedAt',
  'roleWizard',
];

function buildOnboardingPayload(
  answers: OnboardingAnswers,
  meta: {
    stepIndex?: number;
    inProgress?: boolean;
    completed?: boolean;
    lastStepId?: string;
  },
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...answers };
  for (const k of META_KEYS) delete clean[k];

  return {
    ...clean,
    version: 2,
    questionnaireVersion: 2,
    ...(meta.stepIndex !== undefined ? { progressStepIndex: meta.stepIndex } : {}),
    ...(meta.inProgress ? { inProgress: true } : {}),
    ...(meta.completed ? { completedAt: new Date().toISOString(), inProgress: false } : {}),
    ...(meta.lastStepId ? { lastStepId: meta.lastStepId } : {}),
    savedAt: new Date().toISOString(),
  };
}
