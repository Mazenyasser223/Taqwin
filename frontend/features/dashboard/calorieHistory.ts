import type { AthleteHomeDashboard } from '../../services/dashboardService';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { AppLanguage } from '../../services/settingsService';
import { formatWeekdayLabel } from './dashboardLocale';
import {
  formatChartDateLabel,
  formatFitnessChartWeekdayLabel,
} from './fitnessScoreHistory';

export type CalorieHistoryPoint = {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logCount: number;
  target: number;
  pct: number;
  isToday: boolean;
};

export const CALORIE_WINDOW_DAYS = 7;
export const CALORIE_HISTORY_RANGE = 28;

function addDays(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
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

export function buildCalorieHistory(
  data: AthleteHomeDashboard,
  t: (key: TranslationKey, params?: Record<string, string>) => string
): CalorieHistoryPoint[] {
  const target = data.targets.calorieTarget;
  const today = data.today.date;
  const start = addDays(today, -(CALORIE_HISTORY_RANGE - 1));
  const historyRows =
    data.calorieHistory?.length
      ? data.calorieHistory
      : data.weekly.map((bucket) => ({
          date: bucket.date,
          caloriesEaten: bucket.caloriesEaten,
          protein: 0,
          carbs: 0,
          fat: 0,
          logCount: 0,
        }));
  const historyByDate = new Map(historyRows.map((row) => [row.date, row] as const));

  return calendarDatesBetween(start, today).map((date) => {
    const isToday = date === today;
    const row = historyByDate.get(date);
    const calories = isToday
      ? data.today.nutrition.calories
      : (row?.caloriesEaten ?? 0);
    const protein = isToday ? data.today.nutrition.protein : (row?.protein ?? 0);
    const carbs = isToday ? data.today.nutrition.carbs : (row?.carbs ?? 0);
    const fat = isToday ? data.today.nutrition.fat : (row?.fat ?? 0);
    const logCount = isToday ? data.today.nutrition.logCount : (row?.logCount ?? 0);
    return {
      date,
      label: formatFitnessChartWeekdayLabel(date, t),
      calories: Math.round(calories),
      protein,
      carbs,
      fat,
      logCount,
      target,
      pct: target > 0 ? Math.round((calories / target) * 100) : 0,
      isToday,
    };
  });
}

export function sliceCalorieWindow(
  points: CalorieHistoryPoint[],
  options: {
    daysBack: number;
    windowDays?: number;
    language: AppLanguage;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
  }
): { visible: CalorieHistoryPoint[]; daysBack: number; maxDaysBack: number } {
  const { daysBack, windowDays = CALORIE_WINDOW_DAYS, language, t } = options;
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
    label: useDateLabels
      ? formatChartDateLabel(point.date, language)
      : formatFitnessChartWeekdayLabel(point.date, t),
  }));

  return { visible, daysBack: clampedBack, maxDaysBack };
}

export function formatCalorieDayHeading(
  date: string,
  todayDate: string,
  language: AppLanguage,
  t: (key: TranslationKey, params?: Record<string, string>) => string
): string {
  const weekday = formatWeekdayLabel(date, language, t, false);
  const formatted = formatChartDateLabel(date, language);
  if (date === todayDate) {
    return `${t('dashboard.todayLabel')} – ${weekday} – ${formatted}`;
  }
  return `${weekday} – ${formatted}`;
}

export function averageCalories(points: CalorieHistoryPoint[]): number {
  if (points.length === 0) return 0;
  return Math.round(points.reduce((sum, p) => sum + p.calories, 0) / points.length);
}
