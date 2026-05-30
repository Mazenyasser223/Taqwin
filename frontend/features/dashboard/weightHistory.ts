import type { AppLanguage } from '../../services/settingsService';
import type { WeightLogEntry } from './weightLogStore';

export type WeightWeekPoint = {
  weekStart: string;
  weekEnd: string;
  label: string;
  weight: number | null;
  isCurrentWeek: boolean;
  weekIndex?: number;
};

export const WEIGHT_WINDOW_WEEKS = 4;

function addDays(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Monday for the week containing `date`. */
export function weekStartKey(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const daysSinceMonday = (day + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

function weekEndKey(weekStart: string): string {
  return addDays(weekStart, 6);
}

function formatWeekLabel(weekStart: string, language: AppLanguage): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${addDays(weekStart, 6)}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const locale = language === 'ar' ? 'ar' : 'en';
  return `${start.toLocaleDateString(locale, opts)}`;
}

/** Latest logged weight per calendar week (user-provided values only). */
export function buildWeightWeekSeries(
  entries: WeightLogEntry[],
  today: string,
  language: AppLanguage
): WeightWeekPoint[] {
  if (entries.length === 0) return [];

  const byWeek = new Map<string, WeightLogEntry>();
  for (const entry of entries) {
    const ws = weekStartKey(entry.date);
    const prev = byWeek.get(ws);
    if (!prev || entry.date >= prev.date) {
      byWeek.set(ws, entry);
    }
  }

  const currentWeekStart = weekStartKey(today);
  const sortedWeeks = [...byWeek.keys()].sort();
  const firstWeek = sortedWeeks[0];
  const weeks: WeightWeekPoint[] = [];

  let cursor = firstWeek;
  while (cursor <= currentWeekStart) {
    const logged = byWeek.get(cursor);
    weeks.push({
      weekStart: cursor,
      weekEnd: weekEndKey(cursor),
      label: formatWeekLabel(cursor, language),
      weight: logged?.weight ?? null,
      isCurrentWeek: cursor === currentWeekStart,
    });
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

export function sliceWeightWeekWindow(
  weeks: WeightWeekPoint[],
  weeksBack: number
): {
  visible: WeightWeekPoint[];
  weeksBack: number;
  maxWeeksBack: number;
} {
  if (weeks.length === 0) {
    return { visible: [], weeksBack: 0, maxWeeksBack: 0 };
  }

  const maxWeeksBack = Math.max(0, weeks.length - WEIGHT_WINDOW_WEEKS);
  const clampedBack = Math.min(Math.max(0, weeksBack), maxWeeksBack);
  const endIndex = weeks.length - 1 - clampedBack;
  const startIndex = Math.max(0, endIndex - WEIGHT_WINDOW_WEEKS + 1);

  return {
    visible: weeks.slice(startIndex, endIndex + 1),
    weeksBack: clampedBack,
    maxWeeksBack,
  };
}

/** Week-over-week change using latest logged weight per calendar week. */
export function weightDeltaVsLastWeek(
  entries: WeightLogEntry[],
  today: string
): number | null {
  const weeks = buildWeightWeekSeries(entries, today, 'en');
  const logged = weeks.filter((w) => w.weight != null);
  if (logged.length < 2) return null;
  const cur = logged[logged.length - 1].weight!;
  const prev = logged[logged.length - 2].weight!;
  return Math.round((cur - prev) * 10) / 10;
}

export function formatWeightWeekLabel(index: number): string {
  return `W${index + 1}`;
}

export function withWeekNumbers(weeks: WeightWeekPoint[]): Array<WeightWeekPoint & { weekIndex: number }> {
  return weeks.map((w, i) => ({
    ...w,
    weekIndex: i + 1,
    label: formatWeightWeekLabel(i),
  }));
}

export function weekOverWeekDeltas(
  weeks: WeightWeekPoint[]
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  let prev: number | null = null;
  for (const w of weeks) {
    if (w.weight == null) {
      map.set(w.weekStart, null);
      continue;
    }
    map.set(w.weekStart, prev != null ? Math.round((w.weight - prev) * 10) / 10 : null);
    prev = w.weight;
  }
  return map;
}

export function scaleWeightWeekBars(
  points: WeightWeekPoint[]
): Array<WeightWeekPoint & { barPct: number }> {
  const weights = points.map((p) => p.weight).filter((w): w is number => w != null);
  if (weights.length === 0) {
    return points.map((p) => ({ ...p, barPct: 0 }));
  }
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  return points.map((p) => ({
    ...p,
    barPct: p.weight != null ? Math.round(((p.weight - min) / span) * 100) : 0,
  }));
}
