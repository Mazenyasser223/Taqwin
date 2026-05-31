import { useEffect, useState } from 'react';

const WELLNESS_CHANGED = 'taqwin-wellness-changed';
const WORKOUT_SESSION_CHANGED = 'taqwin-workout-session-changed';

/** Notify dashboard widgets that sleep/water local state changed (same tab). */
export function emitWellnessChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WELLNESS_CHANGED));
}

/** Bump when sleep window or water boost updates so fitness score re-reads localStorage. */
export function useWellnessRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const onChange = () => setRevision((n) => n + 1);
    window.addEventListener(WELLNESS_CHANGED, onChange);
    window.addEventListener(WORKOUT_SESSION_CHANGED, onChange);
    return () => {
      window.removeEventListener(WELLNESS_CHANGED, onChange);
      window.removeEventListener(WORKOUT_SESSION_CHANGED, onChange);
    };
  }, []);
  return revision;
}

/** Derive typical sleep duration (hours) from onboarding sleep band. */
export function sleepHoursFromPreference(sleep: string | null | undefined): number {
  const key = String(sleep || '').toLowerCase();
  if (key.includes('lt5') || key.includes('fewer')) return 4.5;
  if (key === '5-6' || key.includes('5–6') || key.includes('5-6')) return 5.5;
  if (key === '7-8' || key.includes('7–8') || key.includes('7-8')) return 7.5;
  if (key.includes('gt8') || key.includes('over 8')) return 8.5;
  const m = key.match(/(\d+)/g);
  if (m?.length) return Math.min(10, Math.max(4, Number(m[0])));
  return 7;
}

export type SleepWindow = {
  hours: number;
  bedMinutes: number;
  wakeMinutes: number;
};

/** Default wake 6:40 AM; bed computed backward from sleep hours. */
export function buildSleepWindow(sleep: string | null | undefined, wakeMinutes = 6 * 60 + 40): SleepWindow {
  const hours = sleepHoursFromPreference(sleep);
  const bedMinutes = (wakeMinutes - Math.round(hours * 60) + 24 * 60) % (24 * 60);
  return { hours, bedMinutes, wakeMinutes };
}

export function formatClockMinutes(minutes: number, locale: string): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** 24h dial: 0 at top, clockwise. Returns [startDeg, sweepDeg] for SVG arc. */
export function sleepArcDegrees(bedMinutes: number, wakeMinutes: number): { start: number; sweep: number } {
  const toDeg = (mins: number) => minutesToDialDegrees(mins);
  let start = toDeg(bedMinutes);
  let end = toDeg(wakeMinutes);
  let sweep = end - start;
  if (sweep <= 0) sweep += 360;
  return { start, sweep };
}

/** Degrees for SVG (0° = top, clockwise). */
export function minutesToDialDegrees(minutes: number): number {
  return (minutes / (24 * 60)) * 360 - 90;
}

export function dialDegreesToMinutes(degrees: number, snapMinutes = 5): number {
  let angle = degrees + 90;
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  let minutes = Math.round((angle / 360) * 24 * 60);
  if (snapMinutes > 0) minutes = Math.round(minutes / snapMinutes) * snapMinutes;
  return ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
}

export function pointOnSleepDial(cx: number, cy: number, radius: number, minutes: number) {
  const rad = (minutesToDialDegrees(minutes) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export const SLEEP_RING_MIN_DURATION = 3 * 60;
export const SLEEP_RING_MAX_DURATION = 14 * 60;

export function clampSleepHandle(
  handle: 'bed' | 'wake',
  bedMinutes: number,
  wakeMinutes: number
): { bedMinutes: number; wakeMinutes: number } {
  let bed = bedMinutes;
  let wake = wakeMinutes;
  let duration = wake - bed;
  if (duration <= 0) duration += 24 * 60;

  if (duration < SLEEP_RING_MIN_DURATION) {
    if (handle === 'bed') bed = (wake - SLEEP_RING_MIN_DURATION + 24 * 60) % (24 * 60);
    else wake = (bed + SLEEP_RING_MIN_DURATION) % (24 * 60);
  } else if (duration > SLEEP_RING_MAX_DURATION) {
    if (handle === 'bed') bed = (wake - SLEEP_RING_MAX_DURATION + 24 * 60) % (24 * 60);
    else wake = (bed + SLEEP_RING_MAX_DURATION) % (24 * 60);
  }

  return { bedMinutes: bed, wakeMinutes: wake };
}

export function clientPointToSleepMinutes(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  cx: number,
  cy: number,
  snapMinutes = 5
): number {
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const vw = vb.width || 200;
  const vh = vb.height || 200;
  const x = ((clientX - rect.left) / rect.width) * vw - cx;
  const y = ((clientY - rect.top) / rect.height) * vh - cy;
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return dialDegreesToMinutes(deg, snapMinutes);
}

export function sleepHoursBetween(bedMinutes: number, wakeMinutes: number): number {
  let diff = wakeMinutes - bedMinutes;
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

export function minutesToTimeValue(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseTimeValue(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

const SLEEP_WINDOW_PREFIX = 'taqwin-sleep-window';

export function sleepWindowStorageKey(userId: string): string {
  return `${SLEEP_WINDOW_PREFIX}:${userId}`;
}

export function readSleepWindowOverride(userId: string | undefined): SleepWindow | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(sleepWindowStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { bedMinutes?: number; wakeMinutes?: number };
    if (
      typeof parsed.bedMinutes !== 'number' ||
      typeof parsed.wakeMinutes !== 'number' ||
      parsed.bedMinutes < 0 ||
      parsed.bedMinutes >= 24 * 60 ||
      parsed.wakeMinutes < 0 ||
      parsed.wakeMinutes >= 24 * 60
    ) {
      return null;
    }
    return {
      bedMinutes: parsed.bedMinutes,
      wakeMinutes: parsed.wakeMinutes,
      hours: sleepHoursBetween(parsed.bedMinutes, parsed.wakeMinutes),
    };
  } catch {
    return null;
  }
}

export function saveSleepWindowOverride(
  userId: string | undefined,
  bedMinutes: number,
  wakeMinutes: number
): SleepWindow | null {
  if (!userId) return null;
  const window: SleepWindow = {
    bedMinutes,
    wakeMinutes,
    hours: sleepHoursBetween(bedMinutes, wakeMinutes),
  };
  try {
    localStorage.setItem(
      sleepWindowStorageKey(userId),
      JSON.stringify({ bedMinutes: window.bedMinutes, wakeMinutes: window.wakeMinutes })
    );
  } catch {
    /* ignore */
  }
  emitWellnessChanged();
  return window;
}

export function resolveSleepWindow(
  sleepPreference: string | null | undefined,
  userId: string | undefined
): SleepWindow {
  return readSleepWindowOverride(userId) ?? buildSleepWindow(sleepPreference);
}

const WATER_BOOST_PREFIX = 'taqwin-water-boost';

export function waterBoostStorageKey(userId: string, dateKey: string): string {
  return `${WATER_BOOST_PREFIX}:${userId}:${dateKey}`;
}

export function readWaterBoostMl(userId: string | undefined, dateKey: string): number {
  if (!userId) return 0;
  try {
    const raw = localStorage.getItem(waterBoostStorageKey(userId, dateKey));
    return raw ? Math.max(0, Number(raw) || 0) : 0;
  } catch {
    return 0;
  }
}

export function addWaterBoostMl(userId: string | undefined, dateKey: string, delta: number): number {
  if (!userId) return 0;
  const next = readWaterBoostMl(userId, dateKey) + delta;
  try {
    localStorage.setItem(waterBoostStorageKey(userId, dateKey), String(next));
  } catch {
    /* ignore */
  }
  emitWellnessChanged();
  return next;
}
