/**
 * Build USER CONTEXT block for AI coach from profile, settings, logs, onboarding.
 */
const { prisma } = require('../db');
const { getOrCreateUserSettings } = require('./userSettings');
const { estimateTargets, ageFromDateOfBirth } = require('./nutritionTargets');

function utcDayStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayBounds(dateStr) {
  const start = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : utcDayStart();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function extractOnboardingNutrition(onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object') return {};
  const o = onboardingData;
  return {
    primaryGoal: o.primaryGoal != null ? String(o.primaryGoal) : null,
    diet: arr(o.diet),
    eatingHabits: (() => {
      const habits = arr(o.eatingHabits);
      return habits.length ? habits.join(', ') : null;
    })(),
    injuries: arr(o.injuries).filter((i) => i !== 'none'),
    workoutLocation: o.workoutLocation != null ? String(o.workoutLocation) : null,
    activityLevel: o.activityLevel != null ? String(o.activityLevel) : null,
    targetPhysique: o.targetPhysique != null ? String(o.targetPhysique) : null,
  };
}

function formatLine(key, value) {
  if (value == null || value === '') return null;
  return `${key}: ${value}`;
}

/**
 * @param {string} userId
 * @returns {Promise<{ text: string, locale: 'en'|'ar', profile: object|null, onboarding: object }>}
 */
async function buildCoachUserContext(userId) {
  const today = utcDayStart().toISOString().slice(0, 10);
  const { start, end } = dayBounds(today);

  const [user, profile, settings, todayLogs, weekLogs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.profile.findUnique({ where: { userId } }),
    getOrCreateUserSettings(userId),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      include: { foodItem: { select: { name: true, calories: true, protein: true, carbs: true, fat: true, fdcId: true } } },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    }),
    prisma.foodLog.findMany({
      where: {
        userId,
        loggedAt: { gte: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000), lt: end },
      },
      include: { foodItem: { select: { name: true, fdcId: true } } },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    }),
  ]);

  const locale = settings?.language === 'en' ? 'en' : 'ar';
  const onboarding = extractOnboardingNutrition(profile?.onboardingData);
  const targets = estimateTargets(profile);
  const age = ageFromDateOfBirth(profile?.dateOfBirth);

  const todayTotals = todayLogs.reduce(
    (acc, l) => {
      const f = l.grams / 100;
      acc.calories += (l.foodItem?.calories ?? 0) * f;
      acc.protein += (l.foodItem?.protein ?? 0) * f;
      acc.carbs += (l.foodItem?.carbs ?? 0) * f;
      acc.fat += (l.foodItem?.fat ?? 0) * f;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const lines = [
    formatLine('displayName', profile?.displayName),
    formatLine('role', user?.role || 'athlete'),
    formatLine('gender', profile?.gender),
    formatLine('ageYears', age),
    formatLine('heightCm', profile?.height),
    formatLine('weightKg', profile?.weight),
    formatLine('fitnessGoal', profile?.fitnessGoal),
    formatLine('fitnessLevel', profile?.fitnessLevel),
    formatLine('medicalNotes', profile?.medicalNotes),
    formatLine('onboardingPrimaryGoal', onboarding.primaryGoal),
    formatLine('dietRestrictions', onboarding.diet.length ? onboarding.diet.join(', ') : null),
    formatLine('eatingHabits', onboarding.eatingHabits),
    formatLine('injuriesLimitations', onboarding.injuries.length ? onboarding.injuries.join(', ') : null),
    formatLine('workoutLocation', onboarding.workoutLocation),
    formatLine('activityLevel', onboarding.activityLevel),
    '',
    'Daily targets (estimated):',
    `calorieTarget: ${targets.calorieTarget} kcal`,
    `proteinTarget: ${targets.proteinTarget} g`,
    `carbTarget: ${targets.carbTarget} g`,
    `fatTarget: ${targets.fatTarget} g`,
    '',
    `Today (${today}) nutrition logged:`,
    `caloriesEaten: ${Math.round(todayTotals.calories)} kcal`,
    `proteinEaten: ${Math.round(todayTotals.protein * 10) / 10} g`,
    `carbsEaten: ${Math.round(todayTotals.carbs * 10) / 10} g`,
    `fatEaten: ${Math.round(todayTotals.fat * 10) / 10} g`,
    `mealsLogged: ${todayLogs.length}`,
  ].filter((l) => l !== null);

  if (todayLogs.length) {
    lines.push('', 'Foods logged today:');
    for (const l of todayLogs.slice(0, 12)) {
      const fi = l.foodItem;
      const factor = l.grams / 100;
      const cals = Math.round((fi?.calories ?? 0) * factor);
      lines.push(
        `- ${fi?.name ?? 'Unknown'} | ${l.grams}g | ~${cals} kcal` +
          (fi?.fdcId ? ` | fdcId:${fi.fdcId}` : '')
      );
    }
  }

  const recentNames = [...new Set(weekLogs.map((l) => l.foodItem?.name).filter(Boolean))].slice(0, 8);
  if (recentNames.length) {
    lines.push('', `Recent foods (7 days): ${recentNames.join(', ')}`);
  }

  if (!profile?.weight) {
    lines.push('', 'Note: weight not set — ask user for weight (kg) before a precise diet plan.');
  }

  return {
    text: lines.join('\n'),
    locale,
    profile,
    onboarding,
    targets,
  };
}

/** Diet / nutrition intent in last user message or history */
const FOOD_INTENT_RE =
  /\b(diet|meal\s*plan|nutrition|macro|calorie|food|eat|eating|breakfast|lunch|dinner|snack|protein|carb|خطة|دايت|أكل|اكل|وجبات|غذاء|سعرات|بروتين|فطار|غدا|عشا|تغذية)\b/i;

function needsFoodContext(messages) {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const last = users[users.length - 1] || '';
  if (FOOD_INTENT_RE.test(last)) return true;
  return users.slice(-3).some((t) => FOOD_INTENT_RE.test(t));
}

module.exports = {
  buildCoachUserContext,
  extractOnboardingNutrition,
  needsFoodContext,
};
