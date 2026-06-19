/**
 * Rule-based workout week structure from onboarding (split + training/rest days).
 */

const { resolveTrainingDayIndexes, clampTrainingDays } = require('./planTrainingSchedule');

const SPLIT_PATTERNS = {
  ppl: ['push', 'pull', 'legs'],
  push_pull_legs: ['push', 'pull', 'legs'],
  upper_lower: ['upper', 'lower'],
  full_body: ['full'],
  bro_split: ['push', 'pull', 'legs', 'upper', 'lower'],
  bro: ['push', 'pull', 'legs', 'upper', 'lower'],
};

const DAY_LABELS = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  full: 'Full Body',
  rest: 'Rest',
};

function resolveSplitPattern(onboardingData = {}) {
  const raw = String(onboardingData.preferredSplit || '').toLowerCase().replace(/\s+/g, '_');
  for (const key of Object.keys(SPLIT_PATTERNS)) {
    if (raw.includes(key.replace(/_/g, '')) || raw === key) return SPLIT_PATTERNS[key];
  }
  const days = clampTrainingDays(onboardingData.trainingDaysPerWeek);
  if (days <= 3) return SPLIT_PATTERNS.full_body;
  if (days === 4) return SPLIT_PATTERNS.upper_lower;
  return SPLIT_PATTERNS.ppl;
}

function buildWorkoutStructureBlueprint(onboardingData = {}) {
  const trainingDays = clampTrainingDays(onboardingData.trainingDaysPerWeek);
  const pattern = resolveSplitPattern(onboardingData);
  const trainingDayIndexes = resolveTrainingDayIndexes(onboardingData);
  const exercisesPerSession = String(onboardingData.fitnessLevel || '').toLowerCase().includes('begin')
    ? 5
    : 6;

  const days = [];
  let trainIdx = 0;
  for (let dayIndex = 1; dayIndex <= 7; dayIndex += 1) {
    const isTraining = trainingDayIndexes.includes(dayIndex);
    if (isTraining) {
      const type = pattern[trainIdx % pattern.length];
      trainIdx += 1;
      days.push({
        dayIndex,
        type,
        isRest: false,
        label: DAY_LABELS[type] || type,
        targetExerciseCount: exercisesPerSession,
        volumeHint: { sets: 3, reps: 10, restSec: 90 },
        muscleFocus: type,
      });
    } else {
      days.push({
        dayIndex,
        type: 'rest',
        isRest: true,
        label: DAY_LABELS.rest,
        targetExerciseCount: 0,
        volumeHint: null,
        muscleFocus: null,
      });
    }
  }

  const restSummary =
    onboardingData.restDaysPreference === 'fixed' && Array.isArray(onboardingData.fixedRestDays)
      ? `Fixed rest: ${onboardingData.fixedRestDays.join(', ')}`
      : onboardingData.restDaysPreference === 'minimal'
        ? 'Minimal rest days'
        : 'Coach schedule';

  return {
    trainingDaysPerWeek: trainingDays,
    preferredSplit: onboardingData.preferredSplit || pattern.join('/'),
    trainingDayIndexes,
    workoutSkeleton: days,
    coachFocus: [
      `${trainingDays} training days/week on dayIndex ${trainingDayIndexes.join(', ')} (${restSummary}).`,
      `Split pattern: ${pattern.join(' → ')} — repeat across training days in order.`,
      'Plan ONE workout week (weekIndex 1); server copies it to weeks 2–4 unchanged.',
      'Pick exercises from EXERCISE LIBRARY matching each session muscleFocus and athlete level.',
    ],
  };
}

module.exports = {
  buildWorkoutStructureBlueprint,
  resolveSplitPattern,
  DAY_LABELS,
};
