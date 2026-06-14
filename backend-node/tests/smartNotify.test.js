/**
 * Block D10 — smart notification helper unit tests (no DB).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  parseWindowStartMinutes,
  mealStartMinutes,
  workoutReminderHour,
  localNowParts,
} = requireFromHere('../src/lib/adaptation/smartNotify');

describe('parseWindowStartMinutes', () => {
  it('parses a HH:MM-HH:MM window to start minutes', () => {
    expect(parseWindowStartMinutes('07:00-09:00')).toBe(420);
    expect(parseWindowStartMinutes('13:30-15:00')).toBe(810);
  });

  it('parses a single time', () => {
    expect(parseWindowStartMinutes('19:00')).toBe(1140);
  });

  it('returns null for invalid input', () => {
    expect(parseWindowStartMinutes('')).toBeNull();
    expect(parseWindowStartMinutes(null)).toBeNull();
    expect(parseWindowStartMinutes('lunchtime')).toBeNull();
  });
});

describe('mealStartMinutes', () => {
  it('prefers the explicit time window', () => {
    expect(mealStartMinutes({ mealType: 'lunch', timeWindow: '12:15-13:00' })).toBe(735);
  });

  it('falls back to a per-mealType default', () => {
    expect(mealStartMinutes({ mealType: 'breakfast' })).toBe(8 * 60);
    expect(mealStartMinutes({ mealType: 'dinner' })).toBe(19 * 60);
  });

  it('falls back to midday for unknown meal types', () => {
    expect(mealStartMinutes({ mealType: 'brunch' })).toBe(12 * 60);
  });
});

describe('workoutReminderHour', () => {
  const original = process.env.SMART_NOTIFY_WORKOUT_HOUR;
  beforeEach(() => {
    delete process.env.SMART_NOTIFY_WORKOUT_HOUR;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SMART_NOTIFY_WORKOUT_HOUR;
    else process.env.SMART_NOTIFY_WORKOUT_HOUR = original;
  });

  it('defaults to 17', () => {
    expect(workoutReminderHour()).toBe(17);
  });

  it('honors a valid env override', () => {
    process.env.SMART_NOTIFY_WORKOUT_HOUR = '20';
    expect(workoutReminderHour()).toBe(20);
  });

  it('ignores out-of-range overrides', () => {
    process.env.SMART_NOTIFY_WORKOUT_HOUR = '99';
    expect(workoutReminderHour()).toBe(17);
  });
});

describe('localNowParts', () => {
  it('reports the local hour for a timezone', () => {
    const noonUtc = new Date('2026-06-06T12:00:00.000Z');
    expect(localNowParts('UTC', noonUtc).hour).toBe(12);
    // Africa/Cairo is UTC+3 in June (no DST since 2014, EEST varies; +2/+3).
    const cairo = localNowParts('Africa/Cairo', noonUtc).hour;
    expect(cairo).toBeGreaterThanOrEqual(13);
    expect(cairo).toBeLessThanOrEqual(15);
  });

  it('returns hour in 0..23 range', () => {
    const midnightUtc = new Date('2026-06-06T00:00:00.000Z');
    const parts = localNowParts('UTC', midnightUtc);
    expect(parts.hour).toBeGreaterThanOrEqual(0);
    expect(parts.hour).toBeLessThanOrEqual(23);
  });
});
