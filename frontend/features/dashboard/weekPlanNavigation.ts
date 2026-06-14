const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const TRAINING_DAY_PATTERNS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

export type WeekPlanDay = {
  day: string;
  date: string;
  status: 'done' | 'planned' | 'today' | 'rest';
  isTrainingDay?: boolean;
  splitLabel?: string | null;
};

/** Sun=1 .. Sat=7 — aligned with Postgres plan dayIndex. */
export function planDayIndexFromDateKey(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 1;
}

export function addCalendarDays(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Local calendar date (YYYY-MM-DD) for week strip / selection — advances at local midnight. */
export function getClientTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Sunday (UTC) of the calendar week that contains `dateKey`. */
export function calendarWeekStart(dateKey: string): string {
  const dow = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return addCalendarDays(dateKey, -dow);
}

/** Sun–Sat week containing today, shifted by `weekOffset` whole weeks. */
export function rollingWeekStart(todayKey: string, weekOffset: number): string {
  return addCalendarDays(calendarWeekStart(todayKey), weekOffset * 7);
}

/** Plan week anchored to Postgres `weekStart` (onboarding day), not calendar Sunday. */
export function planAlignedWeekStart(planWeekStart: string, weekOffset: number): string {
  return addCalendarDays(planWeekStart, weekOffset * 7);
}

export function planDayIndexForDateInPlan(dateKey: string, planWeekStart: string | null | undefined): number {
  if (!planWeekStart) return planDayIndexFromDateKey(dateKey);
  const diff = Math.round(
    (new Date(`${dateKey}T12:00:00Z`).getTime() - new Date(`${planWeekStart}T12:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  if (diff >= 0 && diff <= 6) return diff + 1;
  return planDayIndexFromDateKey(dateKey);
}

/** Seven days starting at official plan weekStart (+ offset weeks). */
export function buildPlanAlignedWeekDays(planWeekStart: string, weekOffset: number) {
  const start = planAlignedWeekStart(planWeekStart, weekOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addCalendarDays(start, i);
    const d = new Date(`${date}T12:00:00Z`);
    return { date, day: DOW_LABELS[d.getUTCDay()] };
  });
}

export function buildRollingWeekDays(todayKey: string, weekOffset: number) {
  const start = rollingWeekStart(todayKey, weekOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addCalendarDays(start, i);
    const d = new Date(`${date}T12:00:00Z`);
    return { date, day: DOW_LABELS[d.getUTCDay()] };
  });
}

/** Furthest future day the week strip may show (inclusive), measured from today. */
export const MAX_FUTURE_WEEK_PLAN_DAYS = 7;

export function rollingWeekEnd(todayKey: string, weekOffset: number): string {
  return addCalendarDays(rollingWeekStart(todayKey, weekOffset), 6);
}

export type CoachPlanNavigationMeta = {
  hasPlan?: boolean;
  source?: 'rules' | 'ai' | 'manual' | null;
  futureWeeksAhead?: number;
  planHorizonWeeks?: number;
  weeks?: Array<{
    weekIndex: number;
    weeklySchedule: Array<{
      dayOfWeek: number;
      isTrainingDay: boolean;
      splitLabel?: string | null;
    }>;
  }>;
};

const DEFAULT_FUTURE_WEEKS_AHEAD = Math.floor(MAX_FUTURE_WEEK_PLAN_DAYS / 7);

/** How many whole weeks forward the strip may go (0 = current week only). */
export function maxFutureWeekOffset(
  _todayKey: string,
  coachPlan?: CoachPlanNavigationMeta | null
): number {
  if (!coachPlan?.hasPlan) return DEFAULT_FUTURE_WEEKS_AHEAD;
  if (coachPlan.source === 'ai') {
    return Math.max(0, Math.min(7, coachPlan.futureWeeksAhead ?? DEFAULT_FUTURE_WEEKS_AHEAD));
  }
  return Math.max(0, Math.min(7, coachPlan.futureWeeksAhead ?? 1));
}

export function isoToDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function daysBetween(fromDateKey: string, toDateKey: string): number {
  const from = new Date(`${fromDateKey}T12:00:00Z`).getTime();
  const to = new Date(`${toDateKey}T12:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Earliest week offset (negative) that still includes the signup calendar week. */
export function minPastWeekOffset(todayKey: string, signupDateKey: string): number {
  const todayWeekStart = calendarWeekStart(todayKey);
  const signupWeekStart = calendarWeekStart(signupDateKey);
  return Math.floor(daysBetween(todayWeekStart, signupWeekStart) / 7);
}

export function isBeforeSignupDate(dateKey: string, signupDateKey?: string | null): boolean {
  return Boolean(signupDateKey && dateKey < signupDateKey);
}

/** Inclusive days before today that can still be checked or logged (0 = today only). */
export const MAX_LOGGABLE_DAYS_BACK = 2;

export function isFuturePlanDate(dateKey: string, todayKey: string): boolean {
  return dateKey > todayKey;
}

export function canLogPlanDate(dateKey: string, todayKey: string): boolean {
  if (dateKey > todayKey) return false;
  return daysBetween(dateKey, todayKey) <= MAX_LOGGABLE_DAYS_BACK;
}

/** Older past days — browse only, no edits or checks. */
export function isViewOnlyPlanDate(dateKey: string, todayKey: string): boolean {
  if (dateKey > todayKey) return false;
  return daysBetween(dateKey, todayKey) > MAX_LOGGABLE_DAYS_BACK;
}

/** Future days and recent past/today — prep edits allowed. */
export function canEditPlanDate(dateKey: string, todayKey: string): boolean {
  return !isViewOnlyPlanDate(dateKey, todayKey);
}

/** @deprecated Use canLogPlanDate */
export function isEditablePlanDate(dateKey: string, todayKey: string): boolean {
  return canLogPlanDate(dateKey, todayKey);
}

export function canShiftWeekOffset(
  weekOffset: number,
  delta: number,
  todayKey: string,
  signupDateKey?: string | null,
  coachPlan?: CoachPlanNavigationMeta | null
): boolean {
  const next = weekOffset + delta;
  if (delta > 0) return next <= maxFutureWeekOffset(todayKey, coachPlan);
  if (delta < 0 && signupDateKey) return next >= minPastWeekOffset(todayKey, signupDateKey);
  return true;
}

function trainingDayIndexes(daysPerWeek: number): number[] {
  return TRAINING_DAY_PATTERNS[daysPerWeek] ?? TRAINING_DAY_PATTERNS[4];
}

export function resolveTrainingDayForPlanDate(opts: {
  dateKey: string;
  trainingDaysPerWeek: number;
  splitLabel?: string | null;
  coachWeekSchedule?: Array<{
    dayOfWeek: number;
    isTrainingDay: boolean;
    splitLabel?: string | null;
  }> | null;
}): { isTrainingDay: boolean; splitLabel: string | null } {
  const daysPerWeek = Math.min(6, Math.max(2, Number(opts.trainingDaysPerWeek) || 4));
  const planDayIdx = planDayIndexFromDateKey(opts.dateKey);
  const dow = new Date(`${opts.dateKey}T12:00:00Z`).getUTCDay();
  const coachDay = opts.coachWeekSchedule?.find((d) => d.dayOfWeek === dow);
  const isTrainingDay = coachDay != null ? coachDay.isTrainingDay : trainingDayIndexes(daysPerWeek).includes(planDayIdx);
  const splitLabel = coachDay?.splitLabel ?? (isTrainingDay ? opts.splitLabel ?? null : null);
  return { isTrainingDay, splitLabel };
}

export function buildVisibleWeekPlan(opts: {
  todayKey: string;
  weekOffset: number;
  trainingDaysPerWeek: number;
  splitLabel?: string | null;
  workoutsByDate: Map<string, number>;
  /** When set (from AI coach plan), rest/training days follow the generated week template. */
  coachWeekSchedule?: Array<{
    dayOfWeek: number;
    isTrainingDay: boolean;
    splitLabel?: string | null;
  }> | null;
}): WeekPlanDay[] {
  return buildRollingWeekDays(opts.todayKey, opts.weekOffset).map(({ date, day }) => {
    const { isTrainingDay, splitLabel } = resolveTrainingDayForPlanDate({
      dateKey: date,
      trainingDaysPerWeek: opts.trainingDaysPerWeek,
      splitLabel: opts.splitLabel,
      coachWeekSchedule: opts.coachWeekSchedule,
    });
    const workouts = opts.workoutsByDate.get(date) ?? 0;
    let status: WeekPlanDay['status'] = 'planned';
    if (!isTrainingDay) status = 'rest';
    else if (workouts > 0) status = 'done';
    else if (date === opts.todayKey) status = 'today';
    return {
      day,
      date,
      status,
      isTrainingDay,
      splitLabel,
    };
  });
}

export function formatWeekRangeLabel(startDate: string, endDate: string, language: 'en' | 'ar'): string {
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const startFmt = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const endFmt = end.toLocaleDateString(
    locale,
    sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }
  );
  return `${startFmt} – ${endFmt}`;
}

export function sameWeekdayInWeek(selectedDate: string, weekDays: Array<{ date: string }>): string | undefined {
  const dow = new Date(`${selectedDate}T12:00:00Z`).getUTCDay();
  return weekDays.find((d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === dow)?.date;
}
