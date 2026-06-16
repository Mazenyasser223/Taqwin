/**
 * League tier + week bounds unit tests.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  promoteTier,
  demoteTier,
  tierIndex,
  MIN_DAYS_TO_RANK,
} = requireFromHere('../src/lib/gamification/leagueConfig');
const { getLeagueWeekBounds } = requireFromHere('../src/lib/gamification/leagueService');

describe('league tiers', () => {
  it('promotes and demotes within bounds', () => {
    expect(promoteTier('bronze')).toBe('silver');
    expect(promoteTier('silver')).toBe('gold');
    expect(promoteTier('gold')).toBe('diamond');
    expect(promoteTier('diamond')).toBe('diamond');
    expect(demoteTier('silver')).toBe('bronze');
    expect(demoteTier('bronze')).toBe('bronze');
  });

  it('tierIndex orders correctly', () => {
    expect(tierIndex('gold')).toBeGreaterThan(tierIndex('bronze'));
  });

  it('requires minimum days to rank', () => {
    expect(MIN_DAYS_TO_RANK).toBeGreaterThanOrEqual(3);
  });
});

describe('getLeagueWeekBounds', () => {
  it('returns 7 date keys starting Sunday UTC', () => {
    const { weekStart, weekEnd, dateKeys } = getLeagueWeekBounds(new Date('2026-06-10T12:00:00.000Z'));
    expect(dateKeys).toHaveLength(7);
    expect(dateKeys[0]).toBe(weekStart);
    expect(dateKeys[6]).toBe(weekEnd);
    const startDay = new Date(`${weekStart}T12:00:00.000Z`).getUTCDay();
    expect(startDay).toBe(0);
  });
});
