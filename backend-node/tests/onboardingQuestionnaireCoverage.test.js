import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const requireFromHere = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  CORE_FIELDS,
  WORKOUT_FIELDS,
  NUTRITION_FIELDS,
  HEALTH_FIELDS,
  FEMALE_HEALTH_FIELDS,
  extractOnboardingForCoach,
  formatOnboardingForPrompt,
} = requireFromHere('../src/lib/onboardingForCoach');

const { formatContextBundleForCoach } = requireFromHere('../src/lib/contextBundle');

const {
  FLOW_STEP_ORDERS,
  INFO_ONLY_STEP_IDS,
  answerKeysForStep,
  allCatalogStepIds,
} = requireFromHere('../src/lib/onboardingQuestionnaireManifest');

const { ONBOARDING_QUESTION_CATALOG } = requireFromHere('../prisma/onboardingCatalogSeed');

const AI_FIELDS_BY_FLOW = {
  core: new Set(CORE_FIELDS),
  workout: new Set(WORKOUT_FIELDS),
  nutrition: new Set(NUTRITION_FIELDS),
  wellness: new Set([...HEALTH_FIELDS, ...FEMALE_HEALTH_FIELDS]),
};

function buildFullOnboardingPayload() {
  return {
    displayName: 'Sara Test',
    gender: 'Female',
    needsFemaleWellness: true,
    age: 32,
    phone: '+201234567890',
    height: 165,
    weight: 68,
    weightHistory: 70,
    bodyType: 'mesomorph',
    bodyMeasurements: { chest: 90, waist: 72, hips: 98, arm: 28 },
    primaryGoal: 'Lose Weight',
    targetWeight: 62,
    goalDeadline: '6_months',
    activityLevel: 'moderate',
    fitnessLevel: 'Intermediate',
    lastTraining: 'current',
    otherSports: ['yoga'],
    upcomingEvent: 'wedding',
    planFailed: 'no',
    inbodyAcknowledged: true,
    inbodyBodyFat: 24,
    injuries: ['knees'],
    bodyFocus: ['glutes', 'core'],
    trainingDaysPerWeek: '4',
    workoutLocation: 'Gym',
    workoutTime: 'evening',
    workoutDuration: '60',
    trainingObstacle: ['work_schedule'],
    preferredSplit: 'upper_lower',
    exercisesAvoid: ['box jump'],
    exercisesLove: ['squat'],
    pushups: '13-20',
    squats: 'gt20',
    pullups: '6_12',
    addCardio: 'yes',
    equipment: ['treadmill'],
    liftExperience: ['squat', 'deadlift'],
    goal12WeekPace: 'steady',
    restDaysPreference: 'auto',
    foodAllergies: ['nuts'],
    foodsExcluded: ['shellfish'],
    dietType: 'high_protein',
    mealPlanStyle: 'balanced',
    mealsPerDay: '3',
    proteinPrefs: ['chicken'],
    carbPrefs: ['rice'],
    fatPrefs: ['avocado'],
    fruitPrefs: ['berries'],
    dairyPrefs: ['yogurt'],
    water: '2_3_liters',
    eatingHabits: ['habitual'],
    weekendEating: 'same',
    supplementsBudget: 'moderate',
    foodBudget: 'medium',
    eatingOutFrequency: '1_2_week',
    preferSimpleMeals: 'yes',
    mealPrepTime: '30_45',
    cookOrReady: 'both',
    religiousDiet: ['halal'],
    medicalHistory: ['thyroid'],
    medications: 'levothyroxine',
    pastInjuriesHistory: ['knees'],
    doctorClearance: 'yes',
    sleep: '7-8',
    recoveryFeel: 'normal',
    stressLevel: '6',
    energyLevel: '7',
    dailyRoutine: 'desk_job',
    progressTracking: ['scale', 'mirror'],
    hungerScale: '5',
    motivationStart: ['health', 'confidence'],
    cycleRegularity: 'irregular',
    cycleSymptoms: ['bloating', 'fatigue'],
    pregnancyStatus: 'no',
    postpartumStatus: 'no',
    breastfeeding: 'no',
    femaleHealthConditions: ['pcos'],
    birthControl: 'no',
    menopause: 'no',
    cycleLength: '31_35',
    coreCompletedAt: '2026-06-01T00:00:00.000Z',
    workoutPlanCompletedAt: '2026-06-02T00:00:00.000Z',
    dietPlanCompletedAt: '2026-06-03T00:00:00.000Z',
    wellnessCompletedAt: '2026-06-04T00:00:00.000Z',
    questionnaireVersion: 2,
  };
}

describe('onboarding questionnaire coverage', () => {
  it('every wizard step has answer keys covered by AI field lists (or is info-only)', () => {
    const gaps = [];

    for (const [flow, steps] of Object.entries(FLOW_STEP_ORDERS)) {
      for (const stepId of steps) {
        if (INFO_ONLY_STEP_IDS.has(stepId)) continue;

        const keys = answerKeysForStep(stepId);
        const aiFields =
          flow === 'wellness'
            ? AI_FIELDS_BY_FLOW.wellness
            : flow === 'diet'
              ? AI_FIELDS_BY_FLOW.nutrition
              : AI_FIELDS_BY_FLOW[flow];
        if (!aiFields) {
          gaps.push({ flow, stepId, keys: keys.join(', '), error: 'unknown flow' });
          continue;
        }
        const covered = keys.some((k) => aiFields.has(k));
        if (!covered) {
          gaps.push({ flow, stepId, keys: keys.join(', ') });
        }
      }
    }

    expect(gaps, `Uncovered steps: ${JSON.stringify(gaps, null, 2)}`).toEqual([]);
  });

  it('catalog seed includes every questionnaire step id', () => {
    const seeded = new Set(ONBOARDING_QUESTION_CATALOG.map((r) => r.stepId));
    const missing = allCatalogStepIds().filter((id) => !seeded.has(id));
    expect(missing, `Missing from catalog seed: ${missing.join(', ')}`).toEqual([]);
  });

  it('onboardingData JSON column exists on AthleteProfile in Prisma schema', () => {
    const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
    expect(schema).toMatch(/onboardingData\s+Json\?/);
  });

  it('full payload: extractOnboardingForCoach reads all sections including female health', () => {
    const extracted = extractOnboardingForCoach(buildFullOnboardingPayload());

    expect(extracted.core.gender).toBe('Female');
    expect(extracted.core.needsFemaleWellness).toBe('yes');
    expect(extracted.workout.trainingDaysPerWeek).toBe('4');
    expect(extracted.nutrition.dietType).toBe('high_protein');
    expect(extracted.health.sleep).toBeTruthy();
    expect(extracted.femaleHealth.cycleRegularity).toBe('irregular');
    expect(extracted.femaleHealth.femaleHealthConditions).toContain('pcos');
    expect(extracted.flat.needsFemaleWellness).toBe(true);
    expect(extracted.flat.cycleSymptoms).toEqual(['bloating', 'fatigue']);
  });

  it('formatOnboardingForPrompt surfaces female health + adaptation for AI', () => {
    const payload = buildFullOnboardingPayload();
    payload.pregnancyStatus = 'yes';
    payload.cycleSymptoms = ['cramps', 'bloating'];

    const text = formatOnboardingForPrompt(extractOnboardingForCoach(payload));
    expect(text).toContain('ONBOARDING — FEMALE HEALTH');
    expect(text).toContain('FEMALE HEALTH ADAPTATION');
    expect(text).toContain('SAFETY — pregnant');
    expect(text).toContain('water retention');
  });

  it('formatContextBundleForCoach includes female health in CAG chat context', () => {
    const extracted = extractOnboardingForCoach(buildFullOnboardingPayload());
    const text = formatContextBundleForCoach({
      profile: { displayName: 'Sara', gender: 'Female', fitnessGoal: 'Lose Weight' },
      onboardingSummary: extracted.flat,
      onboardingByFlow: {
        core: extracted.core,
        workout: extracted.workout,
        nutrition: extracted.nutrition,
        health: extracted.health,
        femaleHealth: extracted.femaleHealth,
      },
      constraints: {
        femaleHealthAdaptNotes: ['Female health context (pcos): not diagnosis'],
      },
    });

    expect(text).toContain('ONBOARDING — FEMALE HEALTH');
    expect(text).toContain('cycleRegularity');
    expect(text).toContain('Female health adaptation');
  });
});
