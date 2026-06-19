/**
 * Plan validator — runs after the LLM returns JSON.
 *
 * Pipeline:
 *   1. Zod shape check (`schema.js`)
 *   2. Safety floors: gender-aware min calories unless `medicalNotes` set,
 *      ≥85% daily protein target met across each day's meals.
 *   3. ID whitelist: every foodItemId/webtebId/exerciseId exists in Postgres.
 *   4. Allergy + exclusion filter on every meal name.
 *   5. Injury filter on every exercise name.
 *
 * Returns `{ ok, errors, plan? }`. Caller (Phase 5) retries the LLM with the
 * errors as feedback; on second failure, the fallback plan is saved instead.
 */
const { PlanSchema } = require('./schema');
const { buildExclusionMatchers, isExerciseBlocked } = require('./constraints');
const { dayProteinSum, iterDietDayItems } = require('./planMealShape');
const { prisma } = require('../../db');

const MIN_CAL_MEN = 1700;
const MIN_CAL_WOMEN = 1500;
const PROTEIN_COVERAGE_MIN = 0.85;
const MAX_DEFICIT_FRACTION = 0.25;

function pushErr(errors, msg) {
  errors.push(msg);
}

async function validatePlan(rawPlan, { profile, onboardingData, maintenanceCalories } = {}) {
  const errors = [];

  const parsed = PlanSchema.safeParse(rawPlan);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `shape ${i.path.join('.') || '<root>'}: ${i.message}`),
    };
  }
  const plan = parsed.data;
  const od = onboardingData || profile?.onboardingData || {};

  // Safety: min calories (skip when user has medical notes — coach trumps formula)
  const hasMedical = Boolean(String(profile?.medicalNotes || '').trim());
  if (!hasMedical) {
    const gender = String(profile?.gender || '').toLowerCase();
    const minCal = gender.includes('female') || gender.includes('woman') ? MIN_CAL_WOMEN : MIN_CAL_MEN;
    if (plan.dailyTargets.calories < minCal) {
      pushErr(
        errors,
        `safety.calories: dailyTargets.calories=${plan.dailyTargets.calories} is below safe floor ${minCal} for ${gender || 'male'}.`
      );
    }
  }

  // Max deficit vs maintenance (when we know maintenance)
  if (maintenanceCalories && Number.isFinite(maintenanceCalories)) {
    const minAllowed = Math.round(maintenanceCalories * (1 - MAX_DEFICIT_FRACTION));
    if (plan.dailyTargets.calories < minAllowed) {
      pushErr(
        errors,
        `safety.deficit: calories=${plan.dailyTargets.calories} is more than ${MAX_DEFICIT_FRACTION * 100}% below maintenance (${maintenanceCalories}).`
      );
    }
  }

  // Per-day protein coverage from all meal items
  for (const day of plan.dietDays) {
    const proteinSum = dayProteinSum(day);
    const required = plan.dailyTargets.protein * PROTEIN_COVERAGE_MIN;
    if (Math.round(proteinSum) < Math.round(required)) {
      pushErr(
        errors,
        `protein.day${day.dayIndex}: meal protein sum ${Math.round(proteinSum)}g < ${Math.round(required)}g (85% of daily ${plan.dailyTargets.protein}g).`
      );
    }
  }

  // ID whitelist — collect, then one batched query per table
  const foodIds = new Set();
  const webtebIds = new Set();
  for (const day of plan.dietDays) {
    for (const item of iterDietDayItems(day)) {
      if (item.foodItemId) foodIds.add(item.foodItemId);
      if (item.webtebId != null) webtebIds.add(item.webtebId);
    }
  }
  const exerciseIds = new Set();
  for (const week of plan.workoutWeeks) {
    for (const d of week.days) {
      for (const e of d.exercises || []) {
        if (e.exerciseId) exerciseIds.add(e.exerciseId);
      }
    }
  }

  if (foodIds.size) {
    const found = await prisma.foodItem.findMany({
      where: { id: { in: [...foodIds] } },
      select: { id: true },
    });
    const ok = new Set(found.map((r) => r.id));
    for (const id of foodIds) if (!ok.has(id)) pushErr(errors, `whitelist.foodItemId: unknown id ${id}`);
  }
  if (webtebIds.size) {
    const found = await prisma.webtebFood.findMany({
      where: { webtebId: { in: [...webtebIds] } },
      select: { webtebId: true },
    });
    const ok = new Set(found.map((r) => r.webtebId));
    for (const id of webtebIds) if (!ok.has(id)) pushErr(errors, `whitelist.webtebId: unknown id ${id}`);
  }
  if (exerciseIds.size) {
    const found = await prisma.exercise.findMany({
      where: { id: { in: [...exerciseIds] } },
      select: { id: true },
    });
    const ok = new Set(found.map((r) => r.id));
    for (const id of exerciseIds) if (!ok.has(id)) pushErr(errors, `whitelist.exerciseId: unknown id ${id}`);
  }

  // Allergy / exclusion / budget filter
  const { foodMatcher, budgetMatcher } = buildExclusionMatchers(od);
  for (const day of plan.dietDays) {
    for (const meal of day.meals) {
      for (const item of meal.items || []) {
        const hit = foodMatcher(item.name);
        if (hit) {
          pushErr(
            errors,
            `exclude.day${day.dayIndex}.${meal.slot}: item "${item.name}" matches excluded keyword "${hit}".`
          );
        }
        if (budgetMatcher) {
          const bhit = budgetMatcher(item.name);
          if (bhit) {
            pushErr(
              errors,
              `budget.day${day.dayIndex}.${meal.slot}: item "${item.name}" not budget-friendly ("${bhit}").`
            );
          }
        }
      }
    }
  }

  // Injury filter on exercises
  for (const week of plan.workoutWeeks) {
    for (const d of week.days) {
      for (const e of d.exercises || []) {
        const blockedBy = isExerciseBlocked(e.name, od.injuries, od);
        if (blockedBy) {
          pushErr(
            errors,
            `injury.week${week.weekIndex}.day${d.dayIndex}: "${e.name}" conflicts with injury "${blockedBy}".`
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, plan };
}

module.exports = {
  validatePlan,
  MIN_CAL_MEN,
  MIN_CAL_WOMEN,
  PROTEIN_COVERAGE_MIN,
  MAX_DEFICIT_FRACTION,
};
