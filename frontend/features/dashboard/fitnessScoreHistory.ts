import type { AthleteHomeDashboard } from '../../services/dashboardService';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { AppLanguage } from '../../services/settingsService';
import { localeTag } from './dashboardLocale';
import {
  computeFitnessScore,
  computeFitnessScoreBreakdownForDate,
  type FitnessPillar,
} from './fitnessScore';

export type FitnessScoreHistoryPoint = {
  date: string;
  label: string;
  score: number;
  pillars: FitnessPillar[];
};

export const HISTORY_DAYS = 7;
export const AVG_28_DAYS = 28;

const LOCAL_DATE_PREFIXES = [
  'taqwin-fitness-score-snap',
  'taqwin-meal-checks',
  'taqwin-workout-session',
  'taqwin-water-boost',
  'taqwin-sleep-window',
  'taqwin-meal-slot-items',
  'taqwin-workout-plan-items',
] as const;

function addDays(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function lastCalendarDates(endDate: string, count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    dates.push(addDays(endDate, -i));
  }
  return dates;
}

function calendarDatesBetween(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return [];
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function formatChartDateLabel(date: string, language: AppLanguage): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(localeTag(language), {
    month: 'short',
    day: 'numeric',
  });
}

const CHART_WEEKDAY_KEYS: TranslationKey[] = [
  'dashboard.chartWeekSun',
  'dashboard.chartWeekMon',
  'dashboard.chartWeekTue',
  'dashboard.chartWeekWed',
  'dashboard.chartWeekThu',
  'dashboard.chartWeekFri',
  'dashboard.chartWeekSat',
];

/** Compact weekday labels for the 7-day fitness chart (e.g. sun, mon, tues). */
export function formatFitnessChartWeekdayLabel(
  date: string,
  t: (key: TranslationKey, params?: Record<string, string>) => string
): string {
  const dayIndex = new Date(`${date}T12:00:00`).getDay();
  return t(CHART_WEEKDAY_KEYS[dayIndex] ?? 'dashboard.chartWeekSun');
}

function formatWeekdayChartLabel(
  date: string,
  _language: AppLanguage,
  t: (key: TranslationKey, params?: Record<string, string>) => string
): string {
  return formatFitnessChartWeekdayLabel(date, t);
}

function collectDatesFromLocalStorage(userId: string): string[] {
  if (typeof window === 'undefined') return [];
  const dates: string[] = [];
  const suffix = `:${userId}:`;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    const prefix = LOCAL_DATE_PREFIXES.find((p) => key.startsWith(`${p}${suffix}`));
    if (!prefix) continue;
    const date = key.slice(`${prefix}${suffix}`.length);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.push(date);
  }
  return dates;
}

export function discoverFitnessHistoryStartDate(
  data: AthleteHomeDashboard,
  userId?: string
): string {
  const today = data.today.date;
  const candidates: string[] = [today];

  for (const bucket of data.weekly) candidates.push(bucket.date);
  for (const cell of data.heatmap ?? []) candidates.push(cell.date);
  for (const item of data.timeline ?? []) {
    const day = item.at?.slice(0, 10);
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) candidates.push(day);
  }
  if (userId) candidates.push(...collectDatesFromLocalStorage(userId));

  const earliest = candidates.sort()[0] ?? today;
  const minWindowStart = addDays(today, -(HISTORY_DAYS - 1));
  return earliest < minWindowStart ? earliest : minWindowStart;
}

export function buildFitnessScoreHistory(
  data: AthleteHomeDashboard,
  options: {
    userId?: string;
    sleepPreference?: string | null;
    language: AppLanguage;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
    days?: number;
    fullRange?: boolean;
  }
): FitnessScoreHistoryPoint[] {
  const { userId, sleepPreference, language, t, days = HISTORY_DAYS, fullRange = false } = options;
  const today = data.today.date;
  const dates = fullRange
    ? calendarDatesBetween(discoverFitnessHistoryStartDate(data, userId), today)
    : lastCalendarDates(today, days).filter((d) => d <= today);

  return dates.map((date) => {
    const breakdown =
      date === today
        ? computeFitnessScore(data, { userId, sleepPreference, t })
        : computeFitnessScoreBreakdownForDate(data, date, { userId, sleepPreference, t });

    return {
      date,
      label: formatWeekdayChartLabel(date, language, t),
      score: breakdown.score,
      pillars: breakdown.pillars,
    };
  });
}

export function sliceFitnessScoreWindow(
  points: FitnessScoreHistoryPoint[],
  options: {
    daysBack: number;
    windowDays?: number;
    language: AppLanguage;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
  }
): { visible: FitnessScoreHistoryPoint[]; daysBack: number; maxDaysBack: number } {
  const { daysBack, windowDays = HISTORY_DAYS, language, t } = options;
  if (points.length === 0) {
    return { visible: [], daysBack: 0, maxDaysBack: 0 };
  }

  const maxDaysBack = Math.max(0, points.length - windowDays);
  const clampedBack = Math.min(Math.max(0, daysBack), maxDaysBack);
  const endIndex = points.length - 1 - clampedBack;
  const startIndex = Math.max(0, endIndex - windowDays + 1);
  const useDateLabels = clampedBack > 0;

  const visible = points.slice(startIndex, endIndex + 1).map((point) => ({
    ...point,
    label: useDateLabels ? formatChartDateLabel(point.date, language) : formatWeekdayChartLabel(point.date, language, t),
  }));

  return { visible, daysBack: clampedBack, maxDaysBack };
}

export function averageFitnessScoreHistory(
  data: AthleteHomeDashboard,
  options: {
    userId?: string;
    sleepPreference?: string | null;
    language: AppLanguage;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
    days: number;
  }
): number {
  const points = buildFitnessScoreHistory(data, { ...options, days: options.days, fullRange: false });
  if (points.length === 0) return 0;
  return Math.round(points.reduce((sum, p) => sum + p.score, 0) / points.length);
}
