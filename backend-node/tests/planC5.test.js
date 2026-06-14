import { describe, it, expect } from 'vitest';
import { planDayIndex, calendarDateOnly, addCalendarDays } from '../src/lib/plans/planCalendar.js';

describe('Block C5 planCalendar', () => {
  it('planDayIndex uses Sun=1 in UTC', () => {
    const sunday = new Date('2026-06-07T15:00:00.000Z');
    expect(planDayIndex(sunday, 'UTC')).toBe(1);
    const monday = new Date('2026-06-08T15:00:00.000Z');
    expect(planDayIndex(monday, 'UTC')).toBe(2);
  });

  it('calendarDateOnly returns UTC midnight for calendar day', () => {
    const d = calendarDateOnly(new Date('2026-06-03T22:00:00.000Z'), 'UTC');
    expect(d.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });

  it('addCalendarDays advances calendar dates', () => {
    const start = new Date('2026-06-01T00:00:00.000Z');
    const next = addCalendarDays(start, 3);
    expect(next.toISOString()).toBe('2026-06-04T00:00:00.000Z');
  });
});
