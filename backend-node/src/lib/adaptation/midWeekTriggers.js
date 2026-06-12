/**
 * Block D1 — Mid-week check (Mon–Wed missed workouts → meso simplify).
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getOrCreateUserSettings } = require('../userSettings');
const { calendarDateOnly, addCalendarDays, planDayIndex } = require('../plans/planCalendar');
const { loadActivePlanDays } = require('../plans/dailyAthletePlanService');
const { applyMesoReschedule } = require('./applyAdaptation');
const { recordPlanChange } = require('./planChangeLog');

const MON_WED_OFFSETS = [1, 2, 3];

function dateKeyFromDateOnly(dateOnly) {
  return dateOnly.toISOString().slice(0, 10);
}

function weekStartSundayInTimezone(date, timezone) {
  const today = calendarDateOnly(date, timezone);
  const dow = planDayIndex(date, timezone);
  return addCalendarDays(today, -(dow - 1));
}

/**
 * Count planned-but-missed training days Mon–Wed of the current calendar week (user TZ).
 * @param {string} userId
 * @param {{ timezone?: string, now?: Date }} [opts]
 */
async function countMissedMonWedWorkoutDays(userId, opts = {}) {
  const settings = await getOrCreateUserSettings(userId);
  const timezone = opts.timezone || settings?.timezone || 'UTC';
  const now = opts.now || new Date();
  const today = calendarDateOnly(now, timezone);
  const weekStart = weekStartSundayInTimezone(now, timezone);
  const monWedDates = MON_WED_OFFSETS.map((offset) => addCalendarDays(weekStart, offset));

  const eligibleDates = monWedDates.filter((d) => d.getTime() <= today.getTime());
  if (!eligibleDates.length) {
    return { missed: 0, timezone, dates: [], details: [] };
  }

  const rangeStart = eligibleDates[0];
  const rangeEnd = addCalendarDays(eligibleDates[eligibleDates.length - 1], 1);
  const loggedStart = new Date(`${dateKeyFromDateOnly(rangeStart)}T00:00:00.000Z`);
  const loggedEnd = new Date(`${dateKeyFromDateOnly(rangeEnd)}T00:00:00.000Z`);

  const [dailyPlans, workoutLogs, exerciseLogs, planCtx] = await Promise.all([
    prisma.dailyAthletePlan.findMany({
      where: {
        userId,
        date: { in: eligibleDates },
      },
      include: {
        workoutPlanDay: { select: { id: true, isRestDay: true, dayIndex: true } },
      },
    }),
    prisma.workoutLog.findMany({
      where: { userId, loggedAt: { gte: loggedStart, lt: loggedEnd } },
      select: { loggedAt: true },
    }),
    prisma.exerciseLog.findMany({
      where: { userId, loggedAt: { gte: loggedStart, lt: loggedEnd } },
      select: { loggedAt: true },
    }),
    loadActivePlanDays(userId),
  ]);

  const dailyByDate = new Map(dailyPlans.map((row) => [dateKeyFromDateOnly(row.date), row]));
  const daysWithWorkout = new Set();
  for (const w of workoutLogs) {
    daysWithWorkout.add(dateKeyFromDateOnly(calendarDateOnly(w.loggedAt, timezone)));
  }
  for (const e of exerciseLogs) {
    daysWithWorkout.add(dateKeyFromDateOnly(calendarDateOnly(e.loggedAt, timezone)));
  }

  const details = [];
  let missed = 0;

  for (const dateOnly of eligibleDates) {
    const dateKey = dateKeyFromDateOnly(dateOnly);
    const daily = dailyByDate.get(dateKey);

    if (daily?.status === 'skipped' || daily?.status === 'completed') {
      details.push({ date: dateKey, missed: false, reason: daily.status });
      continue;
    }

    let isTrainingDay = false;
    if (daily?.workoutPlanDay) {
      isTrainingDay = !daily.workoutPlanDay.isRestDay;
    } else if (planCtx.workoutPlan?.days?.length) {
      const planWeekStart = planCtx.workoutPlan.weekStart;
      const weekStartOnly = calendarDateOnly(
        new Date(planWeekStart.getTime() + 12 * 60 * 60 * 1000),
        timezone
      );
      const dayIndex = Math.floor((dateOnly.getTime() - weekStartOnly.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const planDay = planCtx.workoutPlan.days.find((d) => d.dayIndex === dayIndex);
      isTrainingDay = Boolean(planDay && !planDay.isRestDay);
    }

    if (!isTrainingDay) {
      details.push({ date: dateKey, missed: false, reason: 'rest_or_unplanned' });
      continue;
    }

    if (daysWithWorkout.has(dateKey)) {
      details.push({ date: dateKey, missed: false, reason: 'logged' });
      continue;
    }

    missed += 1;
    details.push({ date: dateKey, missed: true, reason: 'no_log' });
  }

  return { missed, timezone, dates: eligibleDates.map(dateKeyFromDateOnly), details };
}

/**
 * Wed mid-week trigger — if Mon–Wed missed workouts >= 3, apply meso reschedule.
 * @param {string} userId
 * @param {{ locale?: 'ar'|'en', timezone?: string, now?: Date, dryRun?: boolean }} [opts]
 */
async function runMidWeekCheck(userId, opts = {}) {
  const settings = await getOrCreateUserSettings(userId);
  const locale = opts.locale === 'en' || opts.locale === 'ar' ? opts.locale : settings?.language === 'en' ? 'en' : 'ar';
  const timezone = opts.timezone || settings?.timezone || 'UTC';
  const now = opts.now || new Date();

  const { missed, details, dates } = await countMissedMonWedWorkoutDays(userId, { timezone, now });

  if (missed < 3) {
    return {
      ok: true,
      applied: false,
      missedWorkoutDays: missed,
      dates,
      details,
    };
  }

  const weekStart = weekStartSundayInTimezone(now, timezone);
  const alreadyApplied = await prisma.planChangeLog.findFirst({
    where: {
      userId,
      changeType: 'meso_reschedule',
      triggeredBy: 'mid_week',
      createdAt: { gte: weekStart },
    },
    select: { id: true },
  });

  if (alreadyApplied) {
    return {
      ok: true,
      applied: false,
      skipped: true,
      reason: 'already_applied_this_week',
      missedWorkoutDays: missed,
      details,
    };
  }

  const explain =
    locale === 'ar'
      ? `تعديل منتصف الأسبوع — ${missed} أيام تمرين فائتة (الإثنين–الأربعاء).`
      : `Mid-week adjustment — ${missed} missed workout days (Mon–Wed).`;

  if (opts.dryRun) {
    return {
      ok: true,
      applied: false,
      dryRun: true,
      wouldApply: 'meso',
      missedWorkoutDays: missed,
      explain,
      details,
    };
  }

  const meso = await applyMesoReschedule(userId, {
    locale,
    timezone,
    signals: { missedWorkoutDays: missed },
    explain,
  });

  await recordPlanChange({
    userId,
    changeType: 'meso_reschedule',
    reason: explain,
    triggeredBy: 'mid_week',
    afterSummary: { missedWorkoutDays: missed, patchedDates: meso.patchedDates, lifeMode: meso.lifeMode },
    locale,
    notify: true,
  });

  logger.info({ userId, missed, patchedDates: meso.patchedDates }, 'mid-week meso adaptation applied');

  return {
    ok: true,
    applied: true,
    decision: 'meso',
    missedWorkoutDays: missed,
    explain,
    details,
    ...meso,
  };
}

module.exports = { runMidWeekCheck, countMissedMonWedWorkoutDays };
