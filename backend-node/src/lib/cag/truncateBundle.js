/**
 * CAG token budget — keep bundle under ~2k–4k tokens (char estimate).
 */
const DEFAULT_MAX_CHARS = 14_000;

function getCagMaxChars() {
  const n = Number(process.env.CAG_MAX_CHARS);
  return Number.isFinite(n) && n > 2000 ? n : DEFAULT_MAX_CHARS;
}

function estimateBundleChars(bundle) {
  try {
    return JSON.stringify(bundle).length;
  } catch {
    return 0;
  }
}

function shrinkArrays(bundle) {
  const b = { ...bundle };
  if (b.nutritionToday?.foods?.length > 8) {
    b.nutritionToday = {
      ...b.nutritionToday,
      foods: b.nutritionToday.foods.slice(0, 8),
    };
  }
  if (b.nutritionWeek?.recentFoodNames?.length > 6) {
    b.nutritionWeek = {
      ...b.nutritionWeek,
      recentFoodNames: b.nutritionWeek.recentFoodNames.slice(0, 6),
    };
  }
  if (b.workoutToday?.exercises?.length > 6) {
    b.workoutToday = {
      ...b.workoutToday,
      exercises: b.workoutToday.exercises.slice(0, 6),
    };
  }
  if (b.aiMemories?.length > 5) {
    b.aiMemories = b.aiMemories.slice(0, 5);
  }
  if (b.weekPlanSummary?.workoutDays?.length > 7) {
    b.weekPlanSummary = {
      ...b.weekPlanSummary,
      workoutDays: b.weekPlanSummary.workoutDays.slice(0, 7),
    };
  }
  if (b.gymTrainerOrdersSummary?.recentOrders?.length > 3) {
    b.gymTrainerOrdersSummary = {
      ...b.gymTrainerOrdersSummary,
      recentOrders: b.gymTrainerOrdersSummary.recentOrders.slice(0, 3),
    };
  }
  return b;
}

/**
 * @param {Record<string, unknown>} bundle
 * @returns {Record<string, unknown>}
 */
function truncateContextBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return bundle;

  const maxChars = getCagMaxChars();
  let current = shrinkArrays({ ...bundle });
  if (estimateBundleChars(current) <= maxChars) return current;
  if (estimateBundleChars(current) <= maxChars) return current;

  current = shrinkArrays({
    ...current,
    nutritionToday: current.nutritionToday
      ? { ...current.nutritionToday, foods: (current.nutritionToday.foods || []).slice(0, 4) }
      : current.nutritionToday,
    workoutToday: current.workoutToday
      ? { ...current.workoutToday, exercises: (current.workoutToday.exercises || []).slice(0, 4) }
      : current.workoutToday,
    aiMemories: (current.aiMemories || []).slice(0, 3),
    onboardingByFlow: undefined,
    weekPlanSummary: current.weekPlanSummary
      ? {
          version: current.weekPlanSummary.version,
          source: current.weekPlanSummary.source,
          dailyTargets: current.weekPlanSummary.dailyTargets,
          coachNotes: current.weekPlanSummary.coachNotes
            ? String(current.weekPlanSummary.coachNotes).slice(0, 400)
            : null,
        }
      : null,
  });

  if (estimateBundleChars(current) <= maxChars) return current;

  if (current.progressSnapshot?.aiSummary) {
    current.progressSnapshot = {
      ...current.progressSnapshot,
      aiSummary: String(current.progressSnapshot.aiSummary).slice(0, 300),
    };
  }

  return current;
}

module.exports = { truncateContextBundle, getCagMaxChars, estimateBundleChars };
