/* eslint-disable no-console */
/**
 * Smoke test for the plan validator + fallback builder.
 *
 *   node scripts/test-plan-validator.js
 *
 * Runs against the dev Postgres for the ID whitelist check, so DATABASE_URL
 * must be set. MONGO_URI is not required (this script doesn't write).
 */
require('dotenv').config();

const { buildFallbackPlan } = require('../src/lib/plans/fallback');
const { validatePlanForPersist } = require('../src/lib/plans/planValidation');
const { estimateDailyTargets } = require('../src/lib/plans/targets');

function header(t) {
  console.log(`\n=== ${t} ===`);
}

async function main() {
  const profile = {
    gender: 'male',
    weight: 80,
    height: 180,
    fitnessGoal: 'lose weight',
    onboardingData: {
      trainingDaysPerWeek: '4',
      preferredSplit: 'ppl',
      mealsPerDay: '3',
      snacksPerDay: '1',
      foodAllergies: ['nuts'],
      foodsExcluded: [],
      injuries: ['knees'],
      dietType: 'high_protein',
      calorieTarget: 'deficit_mild',
      water: '2-6',
      religiousDiet: 'halal',
      foodBudget: 'medium',
    },
  };

  header('Targets');
  const targets = estimateDailyTargets(profile, profile.onboardingData);
  console.log(targets);

  header('Fallback plan');
  const plan = buildFallbackPlan({ profile, onboardingData: profile.onboardingData, targets });
  console.log(`dietDays=${plan.dietDays.length}, weeks=${plan.workoutWeeks.length}`);
  console.log('Day1 meals:', plan.dietDays[0].meals.map((m) => `${m.slot}:${m.name}`).join(' | '));
  console.log(
    'Week1 day1 exercises:',
    plan.workoutWeeks[0].days[0].exercises.map((e) => e.name).join(', ') || '(rest)'
  );

  header('Validate fallback plan');
  const result = await validatePlanForPersist(plan, {
    profile,
    onboardingData: profile.onboardingData,
    maintenanceCalories: Math.round(profile.weight * 24),
  });
  console.log('ok:', result.ok);
  if (!result.ok) {
    console.log('errors:');
    for (const e of result.errors) console.log('  -', e);
  }

  header('Bad plan: too low calories + nuts in meal + squat with knee injury');
  const badPlan = {
    ...plan,
    dailyTargets: { ...plan.dailyTargets, calories: 900 },
    dietDays: [
      {
        dayIndex: 1,
        label: '',
        meals: [
          {
            slot: 'breakfast',
            name: 'Almond butter toast',
            grams: 200,
            calories: 500,
            protein: 150,
            carbs: 30,
            fat: 20,
          },
        ],
      },
    ],
    workoutWeeks: [
      {
        weekIndex: 1,
        days: [
          {
            dayIndex: 1,
            type: 'legs',
            label: '',
            isRest: false,
            exercises: [
              { name: 'Deep Squat', sets: 4, reps: 10, restSec: 90 },
              { name: 'Box Jump', sets: 4, reps: 10, restSec: 90 },
            ],
          },
        ],
      },
    ],
  };
  const bad = await validatePlanForPersist(badPlan, {
    profile,
    onboardingData: profile.onboardingData,
    maintenanceCalories: Math.round(profile.weight * 24),
  });
  console.log('ok:', bad.ok);
  console.log('error count:', bad.errors.length);
  for (const e of bad.errors) console.log('  -', e);

  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
