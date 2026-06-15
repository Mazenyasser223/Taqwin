import { describe, expect, it } from 'vitest';

const { parseCheckInsRange, buildCheckInSeries, aggregateCheckIns } = require('../src/lib/gymCheckInSeries');

describe('gymCheckInSeries', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('parses valid ranges and defaults to 6m', () => {
    expect(parseCheckInsRange('1m')).toBe('1m');
    expect(parseCheckInsRange('1y')).toBe('1y');
    expect(parseCheckInsRange('invalid')).toBe('6m');
  });

  it('builds daily buckets for current month', () => {
    const { series, range } = buildCheckInSeries('1m', now);
    expect(range).toBe('1m');
    expect(series).toHaveLength(30);
    expect(series[0].date).toBe('2026-06-01');
  });

  it('builds 12 monthly buckets for year view', () => {
    const { series } = buildCheckInSeries('1y', now);
    expect(series).toHaveLength(12);
    expect(series[0].date).toBe('2025-07');
    expect(series[11].date).toBe('2026-06');
  });

  it('aggregates check-ins into buckets', () => {
    const { series, range } = buildCheckInSeries('6m', now);
    const filled = aggregateCheckIns(
      series.map((s) => ({ ...s })),
      [{ checkedInAt: new Date('2026-06-10T08:00:00.000Z') }],
      range,
    );
    expect(filled.find((s) => s.date === '2026-06')?.checkIns).toBe(1);
  });
});
