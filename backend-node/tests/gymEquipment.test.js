import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  computeNextMaintenanceAt,
  completeMaintenanceUpdate,
} = require('../src/lib/gymEquipment');

describe('gymEquipment', () => {
  it('computeNextMaintenanceAt adds interval days', () => {
    const from = new Date('2026-01-01T12:00:00.000Z');
    const next = computeNextMaintenanceAt(from, 90);
    expect(next.toISOString().slice(0, 10)).toBe('2026-04-01');
  });

  it('completeMaintenanceUpdate clears flag and sets dates', () => {
    const completedAt = new Date('2026-06-07T10:00:00.000Z');
    const result = completeMaintenanceUpdate({ maintenanceIntervalDays: 30 }, completedAt);
    expect(result.needsMaintenance).toBe(false);
    expect(result.lastMaintenanceAt).toEqual(completedAt);
    expect(result.nextMaintenanceAt.toISOString().slice(0, 10)).toBe('2026-07-07');
  });

  it('computeNextMaintenanceAt falls back to 90 days', () => {
    const from = new Date('2026-01-01T12:00:00.000Z');
    const next = computeNextMaintenanceAt(from, 0);
    expect(next.toISOString().slice(0, 10)).toBe('2026-04-01');
  });
});
