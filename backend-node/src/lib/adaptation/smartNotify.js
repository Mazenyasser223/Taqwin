/**
 * Block D10 — Smart notifications (meal + workout reminders).
 *
 * Deterministic, timezone-aware reminders derived from the athlete's
 * DailyAthletePlan and today's logs. No LLM calls — cheap DB reads + writes.
 *
 * Reminders:
 *  - workout.reminder    → training day not yet logged, evening window reached.
 *  - plan.meal_reminder  → a planned meal slot is due and not yet covered by logs.
 *
 * Respects UserSettings via emitNotification (notifyWorkoutReminders /
 * notifyAiSuggestions) and dedupes per slot per local day by notification link.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getOrCreateUserSettings } = require('../userSettings');
const { emitNotification } = require('../notifications');
const { resolveTodayPlan } = require('../plans/dailyAthletePlanService');
const { dateKeyInTimezone, loggedAtRangeFromDateKeys } = require('../athleteMetrics');

const DEFAULT_WORKOUT_HOUR = 17;
const MEAL_GRACE_MINUTES = 30;

const MEAL_DEFAULT_START_MIN = {
  breakfast: 8 * 60,
  lunch: 13 * 60,
  dinner: 19 * 60,
  snack: 16 * 60,
};

const MEAL_LABELS = {
  ar: { breakfast: 'الفطور', lunch: 'الغداء', dinner: 'العشاء', snack: 'وجبة خفيفة' },
  en: { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack' },
};

const TITLES = {
  ar: { workout: 'تذكير التمرين', meal: 'تذكير الوجبة' },
  en: { workout: 'Workout reminder', meal: 'Meal reminder' },
};

function workoutReminderHour() {
  const n = Number(process.env.SMART_NOTIFY_WORKOUT_HOUR);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : DEFAULT_WORKOUT_HOUR;
}

/** Local hour/minute/weekday for a timezone. */
function localNowParts(timezone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0; // Intl can emit 24 at midnight
    return {
      weekday: get('weekday'),
      hour: Number.isFinite(hour) ? hour : now.getUTCHours(),
      minute: Number(get('minute')) || 0,
    };
  } catch {
    return { weekday: null, hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

/** "07:00-09:00" | "7:00" | "07:00" → minutes since midnight, or null. */
function parseWindowStartMinutes(timeWindow) {
  if (!timeWindow || typeof timeWindow !== 'string') return null;
  const m = timeWindow.trim().match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  return h * 60 + (Number.isFinite(min) ? min : 0);
}

function mealStartMinutes(meal) {
  const parsed = parseWindowStartMinutes(meal?.timeWindow);
  if (parsed != null) return parsed;
  const key = String(meal?.mealType || '').toLowerCase();
  return MEAL_DEFAULT_START_MIN[key] ?? 12 * 60;
}

function mealLabel(mealType, locale) {
  const key = String(mealType || '').toLowerCase();
  const table = MEAL_LABELS[locale] || MEAL_LABELS.en;
  return table[key] || mealType || (locale === 'ar' ? 'وجبة' : 'meal');
}

/**
 * Build reminder candidates for a single athlete (no side effects).
 * @returns {Promise<{ ok: boolean, reason?: string, timezone: string, candidates: object[] }>}
 */
async function buildSmartNotificationCandidates(userId, opts = {}) {
  const now = opts.now || new Date();
  const settings = opts.settings || (await getOrCreateUserSettings(userId));
  const timezone = opts.timezone || settings?.timezone || 'UTC';
  const locale = opts.locale === 'en' ? 'en' : settings?.language === 'en' ? 'en' : 'ar';

  const today = await resolveTodayPlan(userId, now).catch(() => null);
  if (!today || !today.ok || !today.dailyPlan) {
    return { ok: false, reason: 'no_plan', timezone, locale, candidates: [] };
  }

  const { hour, minute } = localNowParts(timezone, now);
  const nowMinutes = hour * 60 + minute;
  const dateKey = dateKeyInTimezone(now, timezone);
  const { start, end } = loggedAtRangeFromDateKeys(dateKey, dateKey);

  const candidates = [];
  const dailyPlan = today.dailyPlan;

  // --- Workout reminder ---
  const workoutDay = dailyPlan.workoutPlanDay;
  const isTrainingDay =
    workoutDay && !workoutDay.isRestDay && (workoutDay.exercises?.length || 0) > 0;

  if (isTrainingDay && hour >= workoutReminderHour()) {
    const [workoutLogged, exerciseLogged] = await Promise.all([
      prisma.workoutLog.count({ where: { userId, loggedAt: { gte: start, lt: end } } }),
      prisma.exerciseLog.count({ where: { userId, loggedAt: { gte: start, lt: end } } }),
    ]);
    if (workoutLogged === 0 && exerciseLogged === 0) {
      const focus = workoutDay.focus ? ` (${workoutDay.focus})` : '';
      candidates.push({
        kind: 'workout',
        type: 'workout.reminder',
        title: TITLES[locale].workout,
        message:
          locale === 'ar'
            ? `لم تسجّل تمرين اليوم${focus} بعد. ابدأ الآن للحفاظ على التزامك.`
            : `You haven't logged today's workout${focus} yet. Start now to keep your streak.`,
        link: '/dashboard?reminder=workout',
      });
    }
  }

  // --- Meal reminder (first due, uncovered slot) ---
  const meals = (dailyPlan.dietPlanDay?.meals || [])
    .map((meal) => ({ ...meal, startMin: mealStartMinutes(meal) }))
    .sort((a, b) => a.startMin - b.startMin);

  const dueMeals = meals.filter((meal) => nowMinutes >= meal.startMin + MEAL_GRACE_MINUTES);
  if (dueMeals.length > 0) {
    const foodLogged = await prisma.foodLog.count({
      where: { userId, loggedAt: { gte: start, lt: end } },
    });
    if (dueMeals.length > foodLogged) {
      const targetMeal = dueMeals[Math.min(foodLogged, dueMeals.length - 1)];
      const label = mealLabel(targetMeal.mealType, locale);
      candidates.push({
        kind: 'meal',
        type: 'plan.meal_reminder',
        title: TITLES[locale].meal,
        message:
          locale === 'ar'
            ? `حان وقت ${label}. سجّل وجبتك للبقاء على هدفك الغذائي.`
            : `Time for ${label}. Log your meal to stay on your nutrition target.`,
        link: `/nutrition?reminder=meal&slot=${encodeURIComponent(
          String(targetMeal.mealType || 'meal')
        )}`,
      });
    }
  }

  return { ok: true, timezone, locale, dateKey, candidates };
}

/**
 * Build + emit reminders for one athlete, deduped by link within the local day.
 * @returns {Promise<{ ok: boolean, reason?: string, candidates: object[], emitted: number, skipped: number }>}
 */
async function runSmartNotificationsForUser(userId, opts = {}) {
  const built = await buildSmartNotificationCandidates(userId, opts);
  if (!built.ok) {
    return { ok: false, reason: built.reason, candidates: [], emitted: 0, skipped: 0 };
  }

  const { candidates, timezone, dateKey, locale } = built;
  if (opts.dryRun) {
    return { ok: true, candidates, emitted: 0, skipped: 0, dryRun: true, timezone };
  }
  if (candidates.length === 0) {
    return { ok: true, candidates, emitted: 0, skipped: 0, timezone };
  }

  const settings = opts.settings || (await getOrCreateUserSettings(userId));
  let emitted = 0;
  let skipped = 0;

  if (settings.digestNotifications && candidates.length > 1) {
    const summary = candidates.map((c) => `• ${c.message}`).join('\n');
    const { emitDailyDigest } = require('../notifications/fitnessNotify');
    const row = await emitDailyDigest(userId, summary, dateKey);
    if (row) emitted = 1;
    else skipped = 1;
    return { ok: true, candidates, emitted, skipped, timezone, digest: true };
  }

  for (const c of candidates) {
    const slotId = c.link || c.kind || c.type;
    const row = await emitNotification({
      userId,
      type: c.type,
      title: c.title,
      message: c.message,
      link: c.link,
      payload: {
        dateKey,
        userId,
        slotId,
        mealLabel: c.kind === 'meal' ? c.message : undefined,
        locale,
      },
      dedupeKey: `${userId}:${c.type}:${slotId}:${dateKey}`,
    });
    if (row) emitted += 1;
    else skipped += 1;
  }

  if (emitted > 0) {
    logger.info({ userId, emitted, skipped }, 'smart notifications emitted');
  }
  return { ok: true, candidates, emitted, skipped, timezone };
}

module.exports = {
  buildSmartNotificationCandidates,
  runSmartNotificationsForUser,
  localNowParts,
  parseWindowStartMinutes,
  mealStartMinutes,
  workoutReminderHour,
};
