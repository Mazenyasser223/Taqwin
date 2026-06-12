/**
 * Block A5 — Context-Augmented Generation (CAG) bundle for FastAPI.
 * Built in Node, cached in Redis `cag:{userId}`.
 */
const { prisma } = require('../db');
const { redisGetJson, redisSetJson, redisDel } = require('./redis');
const { getOrCreateUserSettings } = require('./userSettings');
const { estimateTargets, ageFromDateOfBirth } = require('./nutritionTargets');
const { extractOnboardingForCoach } = require('./onboardingForCoach');
const {
  fetchActivePlan,
  todayDietDay,
  todayWorkoutDay,
} = require('../services/activePlanService');
const {
  dateKeyInTimezone,
  loggedAtRangeFromDateKeys,
  buildReadinessToday,
  buildDataProvenance,
  summarizeFoodLogs,
} = require('./athleteMetrics');
const { calendarDateOnly } = require('./plans/planCalendar');
const { buildBehavioralSignals } = require('./cag/behavioralSignals');
const { buildGymTrainerOrdersSummary } = require('./cag/gymCommerceSummary');
const { truncateContextBundle } = require('./cag/truncateBundle');
const { sanitizeCagBundle, sanitizeCagString, sanitizeStringList } = require('./cag/sanitizeCag');
const { prioritizeAiMemories, SEMANTIC_MEMORY_KEY_LIST } = require('./ai/aiMemoryKeys');

const DEFAULT_CAG_TTL_MS = 10 * 60 * 1000;

function cagCacheKey(userId) {
  return `cag:${userId}`;
}

function getCagCacheTtlMs() {
  const n = Number(process.env.CAG_CACHE_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAG_TTL_MS;
}

function asRow(row) {
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null;
}

function summarizeFoodLog(log) {
  const fi = log.foodItem;
  const factor = (log.grams ?? 0) / 100;
  return {
    name: fi?.name ?? 'Unknown',
    grams: log.grams,
    calories: Math.round((fi?.calories ?? 0) * factor),
    protein: Math.round((fi?.protein ?? 0) * factor * 10) / 10,
    carbs: Math.round((fi?.carbs ?? 0) * factor * 10) / 10,
    fat: Math.round((fi?.fat ?? 0) * factor * 10) / 10,
    fdcId: fi?.fdcId ?? null,
    loggedAt: log.loggedAt,
  };
}

function buildNutritionTodayPayload(today, todayLogs, targets) {
  const totals = summarizeFoodLogs(todayLogs);

  const waterLoggedMl = todayLogs
    .filter((l) => /water|ماء|hydrat/i.test(l.foodItem?.name ?? ''))
    .reduce((s, l) => s + Math.max(l.grams ?? 0, 200), 0);

  return {
    date: today,
    targets: {
      calories: targets.calorieTarget,
      protein: targets.proteinTarget,
      carbs: targets.carbTarget,
      fat: targets.fatTarget,
      waterMl: targets.waterMl ?? 2500,
    },
    logged: {
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      waterMl: Math.round(waterLoggedMl),
      mealCount: todayLogs.length,
    },
    source: todayLogs.length > 0 ? 'logged' : 'derived',
    foods: todayLogs.slice(0, 12).map(summarizeFoodLog),
  };
}

function buildNutritionWeek(weekLogs) {
  const recentNames = [...new Set(weekLogs.map((l) => l.foodItem?.name).filter(Boolean))].slice(
    0,
    8
  );
  return {
    recentFoodNames: recentNames,
    logCount: weekLogs.length,
  };
}

function summarizeWorkoutDay(day) {
  if (!day) return null;
  if (day.isRest) {
    return { dayIndex: day.dayIndex, isRest: true, type: day.type ?? 'rest' };
  }
  return {
    dayIndex: day.dayIndex,
    isRest: false,
    type: day.type ?? null,
    exercises: (day.exercises || []).slice(0, 12).map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      restSec: e.restSec ?? null,
    })),
  };
}

function summarizeDietDay(day) {
  if (!day) return null;
  return {
    dayIndex: day.dayIndex,
    meals: (day.meals || []).slice(0, 8).map((m) => ({
      slot: m.slot,
      name: m.name,
      grams: m.grams,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
    })),
  };
}

function summarizeWeekPlan(plan) {
  if (!plan) return null;
  const week = plan.workoutWeeks?.[0];
  return {
    version: plan.version,
    source: plan.source,
    dailyTargets: plan.dailyTargets ?? null,
    coachNotes: plan.coachNotes ?? null,
    workoutDays: (week?.days || []).slice(0, 7).map((d) => ({
      dayIndex: d.dayIndex,
      isRest: Boolean(d.isRest),
      type: d.type ?? null,
      exerciseCount: (d.exercises || []).length,
    })),
    dietDayCount: (plan.dietDays || []).length,
  };
}

async function buildContextBundleFresh(userId) {
  const settings = await getOrCreateUserSettings(userId);
  const settingsRow = asRow(settings) || {};
  const locale = settingsRow.language === 'en' ? 'en' : 'ar';
  const timezone = settingsRow.timezone || 'UTC';
  const todayKey = dateKeyInTimezone(new Date(), timezone);
  const { start, end } = loggedAtRangeFromDateKeys(todayKey, todayKey);
  const weekStartDate = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);

  const signalSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    user,
    profile,
    todayLogs,
    weekLogs,
    bodyMetric,
    progressSnapshot,
    aiMemories,
    dailyPlan,
    readinessToday,
    behavioralSignals,
    gymTrainerOrdersSummary,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.athleteProfile.findUnique({ where: { userId } }),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      include: {
        foodItem: {
          select: {
            name: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            fdcId: true,
          },
        },
      },
      orderBy: { loggedAt: 'desc' },
      take: 30,
    }),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: weekStartDate, lt: end } },
      include: { foodItem: { select: { name: true, fdcId: true } } },
      orderBy: { loggedAt: 'desc' },
      take: 50,
    }),
    prisma.bodyMetric.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    }),
    prisma.progressSnapshot.findFirst({
      where: { userId },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.aiMemory.findMany({
      where: { userId, key: { in: SEMANTIC_MEMORY_KEY_LIST } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { key: true, summary: true, confidence: true, source: true },
    }),
    prisma.dailyAthletePlan.findFirst({
      where: { userId, date: calendarDateOnly(new Date(), timezone) },
    }),
    buildReadinessToday(userId, todayKey),
    buildBehavioralSignals(userId, { since: signalSince }),
    buildGymTrainerOrdersSummary(userId),
  ]);

  const profileRow = asRow(profile);
  const onboardingExtracted = extractOnboardingForCoach(profileRow?.onboardingData);
  const onboarding = onboardingExtracted.flat;
  const targets = estimateTargets(profileRow);
  const age = ageFromDateOfBirth(profileRow?.dateOfBirth);
  const bodyMetricRow = asRow(bodyMetric);
  const progressRow = asRow(progressSnapshot);
  const dailyPlanRow = asRow(dailyPlan);

  let plan = null;
  try {
    plan = await fetchActivePlan(userId);
  } catch {
    plan = null;
  }

  const dietDay = plan ? todayDietDay(plan) : null;
  const workoutDay = plan ? todayWorkoutDay(plan) : null;

  const nutritionToday = buildNutritionTodayPayload(todayKey, todayLogs, targets);
  const weightSource = bodyMetricRow?.weightKg != null ? 'logged' : 'derived';

  const dataProvenance = buildDataProvenance({
    weightTrendSource: weightSource,
    weightDeltaSource: weightSource,
    readinessSource: readinessToday?.source || 'derived',
    nutritionSource: nutritionToday.source,
    workoutSource: 'derived',
    consistencySource: progressRow?.adherencePct != null ? 'logged' : 'derived',
    timezone,
  });

  const raw = {
    profile: profileRow
      ? {
          displayName: profileRow.displayName ?? null,
          role: user?.role || 'athlete',
          gender: profileRow.gender ?? null,
          ageYears: age,
          heightCm: profileRow.height ?? null,
          weightKg: bodyMetricRow?.weightKg ?? profileRow.weight ?? null,
          fitnessGoal: profileRow.fitnessGoal ?? null,
          fitnessLevel: profileRow.fitnessLevel ?? null,
          medicalNotes: profileRow.medicalNotes ?? null,
        }
      : null,
    onboardingSummary: onboarding,
    onboardingByFlow: {
      core: onboardingExtracted.core,
      workout: onboardingExtracted.workout,
      nutrition: onboardingExtracted.nutrition,
      health: onboardingExtracted.health,
    },
    nutritionToday,
    nutritionWeek: buildNutritionWeek(weekLogs),
    workoutToday: summarizeWorkoutDay(workoutDay),
    workoutWeek: summarizeWeekPlan(plan),
    todayPlan: {
      diet: summarizeDietDay(dietDay),
      workout: summarizeWorkoutDay(workoutDay),
      dailyAthletePlan: dailyPlanRow
        ? {
            status: dailyPlanRow.status,
            lifeMode: dailyPlanRow.lifeMode,
            readinessScore: dailyPlanRow.readinessScore ?? readinessToday?.score ?? null,
            explainabilityText: dailyPlanRow.explainabilityText ?? null,
          }
        : null,
    },
    weekPlanSummary: summarizeWeekPlan(plan),
    bodyMetricsLatest: bodyMetricRow
      ? {
          weightKg: bodyMetricRow.weightKg ?? null,
          bodyFatPct: bodyMetricRow.bodyFatPct ?? null,
          measurements: bodyMetricRow.measurements ?? null,
          recordedAt: bodyMetricRow.recordedAt,
          source: 'logged',
        }
      : profileRow?.weight != null
        ? { weightKg: profileRow.weight, source: 'derived', recordedAt: null }
        : null,
    readinessLatest: readinessToday
      ? {
          date: todayKey,
          score: readinessToday.score,
          source: readinessToday.source,
          sleepQuality: readinessToday.readinessLog?.sleepQuality ?? null,
          soreness: readinessToday.readinessLog?.soreness ?? null,
          rpe: readinessToday.readinessLog?.rpe ?? null,
          notes: readinessToday.readinessLog?.notes ?? null,
        }
      : null,
    progressSnapshot: progressRow
      ? {
          weekStart: progressRow.weekStart,
          adherencePct: progressRow.adherencePct ?? null,
          workoutAdherence: progressRow.workoutAdherence ?? null,
          nutritionAdherence: progressRow.nutritionAdherence ?? null,
          weightDeltaKg: progressRow.weightDeltaKg ?? null,
          plateauFlag: progressRow.plateauFlag,
          decision: progressRow.decision,
          aiSummary: progressRow.aiSummary ?? null,
        }
      : null,
    aiMemories: prioritizeAiMemories(Array.isArray(aiMemories) ? aiMemories : [], 10).map((m) => ({
      key: m.key,
      summary: m.summary,
      confidence: m.confidence,
      source: m.source,
    })),
    behavioralSignals: behavioralSignals || {
      skippedMuscleGroups: [],
      preferredExercises: [],
      mealSkipPatterns: [],
    },
    dataProvenance,
    constraints: {
      injuries: onboarding.injuries || [],
      foodAllergies: onboarding.foodAllergies || [],
      excludedExercises: onboarding.exercisesAvoid || [],
      excludedFoods: [
        ...(onboarding.diet || []),
        ...(onboarding.foodsExcluded || []).map((e) =>
          typeof e === 'string' ? e : e?.name || String(e)
        ),
      ].filter(Boolean),
      religiousDiet:
        onboarding.religiousDiet && onboarding.religiousDiet !== 'none'
          ? onboarding.religiousDiet
          : '',
      lifeMode: dailyPlanRow?.lifeMode ? String(dailyPlanRow.lifeMode).toLowerCase() : 'normal',
    },
    gymTrainerOrdersSummary: gymTrainerOrdersSummary || {
      activeGymMemberships: [],
      recentOrders: [],
      upcomingTrainerBookings: [],
    },
    locale,
    timezone,
    generatedAt: new Date().toISOString(),
  };

  return sanitizeCagBundle(truncateContextBundle(raw));
}

/**
 * @param {string} userId
 * @param {{ bypassCache?: boolean }} [opts]
 */
async function buildContextBundle(userId, { bypassCache = false } = {}) {
  if (!bypassCache) {
    const cached = await redisGetJson(cagCacheKey(userId));
    if (cached && typeof cached === 'object' && cached.locale) {
      return sanitizeCagBundle(cached);
    }
  }

  const bundle = await buildContextBundleFresh(userId);
  await redisSetJson(cagCacheKey(userId), bundle, getCagCacheTtlMs());
  return bundle;
}

async function invalidateContextBundle(userId) {
  return redisDel(cagCacheKey(userId));
}

/**
 * Compact CAG text for plan-generation prompts (Claude).
 * @param {Record<string, unknown>|null} bundle
 */
function formatContextBundleForPlan(bundle) {
  if (!bundle || typeof bundle !== 'object') return '';
  const safe = sanitizeCagBundle(bundle) || {};
  const lines = [];
  const profile = safe.profile || {};
  if (profile.displayName) {
    lines.push(`displayName: ${sanitizeCagString(String(profile.displayName), 'displayName')}`);
  }
  if (profile.fitnessGoal) lines.push(`fitnessGoal: ${profile.fitnessGoal}`);
  if (profile.weightKg) lines.push(`weightKg: ${profile.weightKg}`);
  if (profile.medicalNotes) {
    lines.push(`medicalNotes: ${sanitizeCagString(String(profile.medicalNotes), 'medicalNotes')}`);
  }

  const nt = safe.nutritionToday || {};
  if (nt.targets) {
    const t = nt.targets;
    lines.push(
      `loggedToday: ${nt.logged?.calories ?? 0}/${t.calories ?? '?'} kcal, P${nt.logged?.protein ?? 0}/${t.protein ?? '?'}g`
    );
  }

  const wt = safe.workoutToday || {};
  if (wt && !wt.isRest) {
    const type = wt.type || wt.focus || 'training';
    lines.push(`workoutToday: ${sanitizeCagString(String(type), 'exerciseName')}`);
  }

  const wp = safe.weekPlanSummary || {};
  if (wp.trainingDays) lines.push(`weekTrainingDays: ${wp.trainingDays}`);

  const progress = safe.progressSnapshot || {};
  if (progress.adherencePct != null) lines.push(`adherencePct: ${progress.adherencePct}`);
  if (progress.plateauFlag) lines.push('plateauFlag: true');

  const memories = safe.aiMemories || [];
  if (memories.length) {
    lines.push('aiMemories:');
    for (const m of memories.slice(0, 5)) {
      if (m?.summary) {
        lines.push(
          `  - ${m.key || 'note'}: ${sanitizeCagString(String(m.summary), 'memorySummary')}`
        );
      }
    }
  }

  const signals = safe.behavioralSignals || {};
  const skipped = sanitizeStringList(signals.skippedMuscleGroups, 'default');
  if (skipped.length) lines.push(`skippedMuscleGroups: ${skipped.join(', ')}`);

  return lines.length ? lines.join('\n') : '';
}

/**
 * Rich CAG text for tests and exports (mirrors FastAPI format_context_bundle).
 * @param {Record<string, unknown>|null} bundle
 */
function formatContextBundleForCoach(bundle) {
  if (!bundle || typeof bundle !== 'object') return '';
  const safe = sanitizeCagBundle(bundle) || {};

  const lines = [];
  const profile = safe.profile || {};
  if (profile && typeof profile === 'object') {
    lines.push('Profile:');
    for (const key of [
      'displayName',
      'role',
      'gender',
      'ageYears',
      'fitnessGoal',
      'fitnessLevel',
      'weightKg',
      'heightCm',
      'medicalNotes',
    ]) {
      if (profile[key] != null) {
        const field =
          key === 'displayName' ? 'displayName' : key === 'medicalNotes' ? 'medicalNotes' : 'default';
        lines.push(`  ${key}: ${sanitizeCagString(String(profile[key]), field)}`);
      }
    }
    lines.push('');
  }

  const onboardingByFlow = safe.onboardingByFlow;
  if (onboardingByFlow && typeof onboardingByFlow === 'object') {
    for (const [sectionKey, title] of [
      ['core', 'ONBOARDING — CORE'],
      ['workout', 'ONBOARDING — WORKOUT'],
      ['nutrition', 'ONBOARDING — NUTRITION'],
      ['health', 'ONBOARDING — HEALTH'],
    ]) {
      const section = onboardingByFlow[sectionKey];
      if (section && typeof section === 'object' && Object.keys(section).length) {
        lines.push(title);
        for (const [k, v] of Object.entries(section)) {
          if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
          const val = Array.isArray(v)
            ? sanitizeStringList(v, 'onboardingText').join(', ')
            : sanitizeCagString(String(v), 'onboardingText');
          lines.push(`  ${k}: ${val}`);
        }
        lines.push('');
      }
    }
  }

  const nutrition = safe.nutritionToday || {};
  if (nutrition.logged || nutrition.targets) {
    const logged = nutrition.logged || {};
    const targets = nutrition.targets || {};
    lines.push(
      `Nutrition today (${nutrition.date || 'today'}): ` +
        `meals=${logged.mealCount ?? 0}, calories=${logged.calories ?? 0}/${targets.calories ?? '?'}`
    );
    lines.push('');
  }

  const workout = safe.workoutToday || {};
  if (workout && !workout.isRest && workout.exercises?.length) {
    lines.push(
      `Workout today: ${sanitizeCagString(String(workout.type || 'training'), 'exerciseName')}`
    );
    for (const ex of workout.exercises.slice(0, 8)) {
      if (ex?.name) {
        lines.push(`  - ${sanitizeCagString(String(ex.name), 'exerciseName')}`);
      }
    }
    lines.push('');
  }

  const readiness = safe.readinessLatest;
  if (readiness?.date) {
    lines.push('Latest readiness:');
    for (const key of ['score', 'sleepQuality', 'soreness', 'rpe', 'notes']) {
      if (readiness[key] != null) {
        const field = key === 'notes' ? 'readinessNotes' : 'default';
        lines.push(`  ${key}: ${sanitizeCagString(String(readiness[key]), field)}`);
      }
    }
    lines.push('');
  }

  const signals = safe.behavioralSignals || {};
  if (signals.skippedMuscleGroups?.length) {
    lines.push(
      `Skipped muscle groups: ${sanitizeStringList(signals.skippedMuscleGroups, 'default').join(', ')}`
    );
  }
  if (signals.preferredExercises?.length) {
    lines.push(
      `Preferred exercises: ${sanitizeStringList(signals.preferredExercises, 'exerciseName').join(', ')}`
    );
  }
  if (signals.mealSkipPatterns?.length) {
    lines.push(
      `Meal patterns: ${sanitizeStringList(signals.mealSkipPatterns, 'default').join(', ')}`
    );
  }

  const constraints = safe.constraints || {};
  if (constraints.injuries?.length) {
    lines.push(
      `Active injury constraints: ${sanitizeStringList(constraints.injuries, 'injuryLabel').join(', ')}`
    );
  }

  const memories = safe.aiMemories || [];
  if (memories.length) {
    lines.push('AI memories (durable semantic facts):');
    for (const m of memories.slice(0, 5)) {
      if (m?.summary) {
        lines.push(
          `  - ${m.key || 'note'}: ${sanitizeCagString(String(m.summary), 'memorySummary')}`
        );
      }
    }
  }

  lines.push(
    'RULE: Use onboarding fields above as source of truth. Do not guess injuries/diet from height/weight alone.'
  );

  return lines.join('\n').trim();
}

module.exports = {
  buildContextBundle,
  buildContextBundleFresh,
  invalidateContextBundle,
  formatContextBundleForPlan,
  formatContextBundleForCoach,
  cagCacheKey,
  getCagCacheTtlMs,
};
