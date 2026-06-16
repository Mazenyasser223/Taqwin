import type { GymClass } from '../types';

const GYM_TIMEZONE = 'Africa/Cairo';

export function sessionDateKey(sessionDate: string | Date): string {
  if (typeof sessionDate === 'string') {
    const match = sessionDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = sessionDate instanceof Date ? sessionDate : new Date(String(sessionDate));
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIMEZONE }).format(d);
}

export function gymTodayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIMEZONE }).format(now);
}

export function isClassSessionToday(sessionDate: string | Date, now = new Date()): boolean {
  return sessionDateKey(sessionDate) === gymTodayKey(now);
}

export function canMarkSessionAttendance(
  gymClass: Pick<GymClass, 'sessionDate'>,
  now = new Date(),
): boolean {
  return !!gymClass.sessionDate && isClassSessionToday(gymClass.sessionDate, now);
}

export function formatClassSessionDate(
  sessionDate: string | Date,
  language: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const d = sessionDate instanceof Date ? sessionDate : new Date(`${String(sessionDate).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatClassSchedule(cls: GymClass, language: string) {
  const dateLabel = cls.sessionDate
    ? formatClassSessionDate(cls.sessionDate, language)
    : '';
  const time = `${cls.startTime} – ${cls.endTime}`;
  return dateLabel ? `${dateLabel} · ${time}` : time;
}
