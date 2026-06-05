/**
 * Build the strict JSON system + user prompt for the AI plan generator.
 *
 * The LLM MUST return a JSON object that matches `lib/plans/schema.js`. We
 * give it a closed list of foods (by `foodItemId` / `webtebId`) and a closed
 * list of exercises (by `exerciseId`). Any reference to an unknown id is
 * rejected by the validator, so the model is forced into the whitelist.
 */
const { formatFoodLineForPrompt } = require('../rag/retrieveFoods');
const { formatExerciseLineForPrompt } = require('../rag/retrieveExercises');

const HARD_RULES = [
  'Output a SINGLE JSON object with no markdown fences, no commentary, no leading text.',
  'Use ONLY the foods listed under FOODS — set `foodItemId` for items tagged `foodItemId:` and `webtebId` (integer) for items tagged `webtebId:`.',
  'Use ONLY the exercises listed under EXERCISES — set `exerciseId` to the UUID after `exerciseId:`.',
  'Do NOT invent foodItemId, webtebId, or exerciseId values — copy them character-for-character from the lists.',
  'NEVER recommend foods that match the EXCLUDED list (allergies, religious diet, user blocks).',
  'NEVER recommend exercises that match BLOCKED EXERCISES (injuries).',
  'Each diet day must hit ≥85% of dailyTargets.protein across its meals.',
  'Calories per day should be within ±10% of dailyTargets.calories.',
  'Plan exactly 7 diet days (dayIndex 1..7) and 4 workout weeks (weekIndex 1..4) with 7 days each (rest days allowed, set `isRest: true` and `exercises: []`).',
];

const SCHEMA_HINT = `{
  "dailyTargets": { "calories": int, "protein": int, "carbs": int, "fat": int, "waterMl": int },
  "dietDays": [
    {
      "dayIndex": 1..7,
      "label": "Day 1" | "اليوم 1",
      "meals": [
        {
          "slot": "breakfast"|"lunch"|"dinner"|"snack",
          "foodItemId": "uuid" | null,
          "webtebId": int | null,
          "name": "string",
          "grams": int > 0,
          "calories": int,
          "protein": int,
          "carbs": int,
          "fat": int,
          "notes": "string"
        }
      ]
    }
  ],
  "workoutWeeks": [
    {
      "weekIndex": 1..4,
      "days": [
        {
          "dayIndex": 1..7,
          "type": "push|pull|legs|upper|lower|full|cardio|rest",
          "label": "string",
          "isRest": bool,
          "exercises": [
            { "exerciseId": "uuid", "name": "string", "sets": int, "reps": int, "restSec": int, "notes": "string" }
          ]
        }
      ]
    }
  ],
  "coachNotes": "string (≤300 chars, the why behind the plan)",
  "regenerationReason": "string (≤120 chars)"
}`;

function formatProfileBlock(profile, onboardingData, targets) {
  const od = onboardingData || {};
  const lines = [
    `goal: ${profile?.fitnessGoal || od.primaryGoal || 'general fitness'}`,
    `fitnessLevel: ${od.fitnessLevel || profile?.fitnessLevel || 'beginner'}`,
    profile?.weight ? `weight: ${profile.weight} kg` : null,
    profile?.height ? `height: ${profile.height} cm` : null,
    profile?.gender ? `gender: ${profile.gender}` : null,
    od.trainingDaysPerWeek ? `trainingDaysPerWeek: ${od.trainingDaysPerWeek}` : null,
    od.preferredSplit ? `preferredSplit: ${od.preferredSplit}` : null,
    od.workoutLocation ? `workoutLocation: ${od.workoutLocation}` : null,
    od.workoutDuration ? `workoutDuration: ${od.workoutDuration}` : null,
    od.mealsPerDay ? `mealsPerDay: ${od.mealsPerDay}` : null,
    od.snacksPerDay ? `snacksPerDay: ${od.snacksPerDay}` : null,
    od.dietType ? `dietType: ${od.dietType}` : null,
    od.calorieTarget ? `calorieTarget choice: ${od.calorieTarget}` : null,
    od.religiousDiet && od.religiousDiet !== 'none' ? `religiousDiet: ${od.religiousDiet}` : null,
    od.foodBudget ? `foodBudget: ${od.foodBudget}` : null,
    od.water ? `waterPreference: ${od.water}` : null,
    profile?.medicalNotes ? `medicalNotes: ${profile.medicalNotes}` : null,
    '',
    `DAILY TARGETS (must match exactly): calories=${targets.calorieTarget} protein=${targets.proteinTarget}g carbs=${targets.carbTarget}g fat=${targets.fatTarget}g water=${targets.waterMl}ml`,
  ].filter(Boolean);
  return lines.join('\n');
}

function formatExcludedList(onboardingData) {
  const od = onboardingData || {};
  const parts = [];
  if (Array.isArray(od.foodAllergies) && od.foodAllergies.length) {
    parts.push(`allergies: ${od.foodAllergies.join(', ')}`);
  }
  if (Array.isArray(od.foodsExcluded) && od.foodsExcluded.length) {
    const items = od.foodsExcluded.map((e) => (typeof e === 'string' ? e : e?.name)).filter(Boolean);
    if (items.length) parts.push(`excluded foods: ${items.join(', ')}`);
  }
  if (od.foodsExcludedCustom) parts.push(`also avoid: ${od.foodsExcludedCustom}`);
  if (od.religiousDiet && od.religiousDiet !== 'none') {
    parts.push(`religious diet: ${od.religiousDiet}`);
  }
  if (Array.isArray(od.injuries)) {
    const inj = od.injuries.filter((i) => i && i !== 'none');
    if (inj.length) parts.push(`injuries: ${inj.join(', ')}`);
  }
  return parts.length ? parts.join('\n') : '(none reported)';
}

function buildPlanSystemPrompt({ locale = 'ar' } = {}) {
  const langDirective =
    locale === 'ar'
      ? 'Use Arabic for the meal `name`, `label`, and `coachNotes` (Modern Standard or Egyptian Arabic). Keep `slot`, `type`, and numeric fields in English/numeric.'
      : 'Use English for the meal `name`, `label`, and `coachNotes`.';

  return [
    'You are Taqwin Coach, a certified fitness + nutrition coach generating a personalized 7-day diet plan and 4-week workout plan as machine-readable JSON.',
    '',
    'HARD RULES:',
    ...HARD_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    langDirective,
    '',
    'EXPECTED SCHEMA:',
    SCHEMA_HINT,
  ].join('\n');
}

function buildPlanUserPrompt({
  profile,
  onboardingData,
  targets,
  foods,
  exercises,
  bookChunks = [],
  regenerationReason = '',
  validationFeedback = '',
} = {}) {
  const sections = [];

  sections.push('--- USER PROFILE ---');
  sections.push(formatProfileBlock(profile, onboardingData, targets));
  sections.push('');

  sections.push('--- EXCLUDED / SAFETY ---');
  sections.push(formatExcludedList(onboardingData));
  sections.push('');

  sections.push(`--- FOODS (use ONLY these, ${foods.length} options) ---`);
  if (foods.length) {
    sections.push(foods.map(formatFoodLineForPrompt).join('\n'));
  } else {
    sections.push('(none — keep meals generic and set foodItemId/webtebId to null)');
  }
  sections.push('');

  sections.push(`--- EXERCISES (use ONLY these, ${exercises.length} options) ---`);
  if (exercises.length) {
    sections.push(exercises.map(formatExerciseLineForPrompt).join('\n'));
  } else {
    sections.push('(none — set exerciseId to null and keep names generic)');
  }
  sections.push('');

  if (bookChunks.length) {
    sections.push('--- COACHING PRINCIPLES (book excerpts) ---');
    sections.push(
      bookChunks
        .map((c, i) => `[${i + 1}] ${c.topic ? `${c.topic}: ` : ''}${c.text}`)
        .join('\n\n')
    );
    sections.push('');
  }

  if (validationFeedback) {
    sections.push('--- PREVIOUS ATTEMPT FAILED VALIDATION — FIX THESE ---');
    sections.push(validationFeedback);
    sections.push('');
  }

  if (regenerationReason) {
    sections.push(`Regeneration reason: ${regenerationReason}`);
    sections.push('');
  }

  sections.push(
    'Return ONLY the JSON object — no markdown, no preface, no trailing text.'
  );

  return sections.join('\n');
}

module.exports = {
  buildPlanSystemPrompt,
  buildPlanUserPrompt,
  HARD_RULES,
};
