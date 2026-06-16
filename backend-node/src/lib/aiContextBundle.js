/**
 * Structured context for FastAPI (CAG). Built in Node from Prisma — FastAPI never opens Postgres.
 */
const { buildCoachUserContext, extractOnboardingNutrition } = require('./coachContext');

/**
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function buildAiContextBundle(userId) {
  const ctx = await buildCoachUserContext(userId);
  const p = ctx.profile;
  const onboarding = extractOnboardingNutrition(p?.onboardingData);

  const todayMatch = ctx.text.match(/caloriesEaten:\s*(\d+)/);
  const proteinMatch = ctx.text.match(/proteinEaten:\s*([\d.]+)/);

  return {
    locale: ctx.locale,
    profile: p
      ? {
          displayName: p.displayName ?? null,
          gender: p.gender ?? null,
          heightCm: p.height ?? null,
          weightKg: p.weight ?? null,
          fitnessGoal: p.fitnessGoal ?? null,
          fitnessLevel: p.fitnessLevel ?? null,
          medicalNotes: p.medicalNotes ? String(p.medicalNotes).slice(0, 500) : null,
        }
      : null,
    onboarding: {
      primaryGoal: onboarding.primaryGoal,
      diet: onboarding.diet,
      injuries: onboarding.injuries,
      workoutLocation: onboarding.workoutLocation,
      activityLevel: onboarding.activityLevel,
    },
    targets: ctx.targets
      ? {
          calorieTarget: ctx.targets.calorieTarget,
          proteinTarget: ctx.targets.proteinTarget,
          carbTarget: ctx.targets.carbTarget,
          fatTarget: ctx.targets.fatTarget,
          waterMl: ctx.targets.waterMl,
        }
      : null,
    nutritionToday: {
      caloriesEaten: todayMatch ? Number(todayMatch[1]) : 0,
      proteinEaten: proteinMatch ? Number(proteinMatch[1]) : 0,
    },
    /** Full coach context text for Phase 2 system prompt until FastAPI parses JSON only */
    coachContextText: ctx.text,
  };
}

module.exports = { buildAiContextBundle };
