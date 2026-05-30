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

/** Largest week offset whose window still ends within MAX_FUTURE_WEEK_PLAN_DAYS of today. */
export function maxFutureWeekOffset(_todayKey: string): number {
  return Math.floor(MAX_FUTURE_WEEK_PLAN_DAYS / 7);
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
  signupDateKey?: string | null
): boolean {
  const next = weekOffset + delta;
  if (delta > 0) return next <= maxFutureWeekOffset(todayKey);
  if (delta < 0 && signupDateKey) return next >= minPastWeekOffset(todayKey, signupDateKey);
  return true;
}

function trainingDayIndexes(daysPerWeek: number): number[] {
  return TRAINING_DAY_PATTERNS[daysPerWeek] ?? TRAINING_DAY_PATTERNS[4];
}

export function buildVisibleWeekPlan(opts: {
  todayKey: string;
  weekOffset: number;
  trainingDaysPerWeek: number;
  splitLabel?: string | null;
  workoutsByDate: Map<string, number>;
}): WeekPlanDay[] {
  const trainIdx = new Set(trainingDayIndexes(opts.trainingDaysPerWeek));
  return buildRollingWeekDays(opts.todayKey, opts.weekOffset).map(({ date, day }) => {
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const isTrainingDay = trainIdx.has(dow);
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
      splitLabel: isTrainingDay ? opts.splitLabel ?? null : null,
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
