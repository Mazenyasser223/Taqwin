import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizeWorkingHours,
  summarizeWorkingHours,
  computePayAmounts,
  resolveProvider,
  buildPayrollCsv,
} = require('../src/lib/gymStaffPayroll');
const { normalizeStaffEmail, staffInitials, ROLE_ICONS } = require('../src/lib/gymStaffUtils');

describe('gymStaffUtils', () => {
  it('normalizeStaffEmail lowercases and trims valid email', () => {
    expect(normalizeStaffEmail('  Coach@Gym.COM  ')).toBe('coach@gym.com');
  });

  it('normalizeStaffEmail returns null for empty values', () => {
    expect(normalizeStaffEmail('')).toBeNull();
    expect(normalizeStaffEmail(null)).toBeNull();
    expect(normalizeStaffEmail(undefined)).toBeNull();
  });

  it('normalizeStaffEmail throws on invalid email', () => {
    expect(() => normalizeStaffEmail('not-an-email')).toThrow('Invalid email address');
  });

  it('staffInitials builds from full name', () => {
    expect(staffInitials('Ahmed Hassan')).toBe('AH');
    expect(staffInitials('Solo')).toBe('SO');
    expect(staffInitials('')).toBe('?');
  });

  it('ROLE_ICONS covers all roles', () => {
    expect(Object.keys(ROLE_ICONS).sort()).toEqual(['cleaner', 'other', 'receptionist', 'trainer']);
  });
});

describe('gymStaffPayroll', () => {
  it('normalizeWorkingHours filters invalid slots', () => {
    const result = normalizeWorkingHours([
      { day: 1, start: '09:00', end: '17:00' },
      { day: 8, start: '09:00', end: '17:00' },
      { day: 2, start: '', end: '17:00' },
    ]);
    expect(result).toEqual([{ day: 1, start: '09:00', end: '17:00' }]);
  });

  it('summarizeWorkingHours groups same hours across days', () => {
    const summary = summarizeWorkingHours([
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '09:00', end: '17:00' },
      { day: 3, start: '09:00', end: '17:00' },
    ]);
    expect(summary).toBe('Mon–Wed 09:00–17:00');
  });

  it('computePayAmounts adds salary and bonus', () => {
    expect(computePayAmounts({ type: 'salary', baseSalary: 5000, bonusAmount: 500 })).toEqual({
      baseAmount: 5000,
      bonusAmount: 500,
      totalAmount: 5500,
    });
  });

  it('computePayAmounts handles bonus-only payout', () => {
    expect(computePayAmounts({ type: 'bonus', baseSalary: 0, bonusOnlyAmount: 300 })).toEqual({
      baseAmount: 0,
      bonusAmount: 300,
      totalAmount: 300,
    });
  });

  it('resolveProvider defaults to mock when Paymob not configured', () => {
    const prevKey = process.env.PAYMOB_API_KEY;
    const prevId = process.env.PAYMOB_INTEGRATION_ID;
    delete process.env.PAYMOB_API_KEY;
    delete process.env.PAYMOB_INTEGRATION_ID;
    expect(resolveProvider(undefined)).toBe('mock');
    expect(resolveProvider('cash')).toBe('cash');
    if (prevKey) process.env.PAYMOB_API_KEY = prevKey;
    if (prevId) process.env.PAYMOB_INTEGRATION_ID = prevId;
  });

  it('buildPayrollCsv includes email column and escaped fields', () => {
    const csv = buildPayrollCsv([
      {
        staffName: 'Ali "Coach"',
        email: 'ali@gym.com',
        role: 'trainer',
        type: 'salary',
        baseAmount: 5000,
        bonusAmount: 0,
        totalAmount: 5000,
        periodMonth: 6,
        periodYear: 2026,
        status: 'paid',
        provider: 'mock',
        paidAt: '2026-06-01T10:00:00.000Z',
        notes: null,
      },
    ]);
    expect(csv.split('\n')[0]).toBe(
      'Staff Name,Email,Role,Type,Base,Bonus,Total,Period,Status,Provider,Paid At,Notes',
    );
    expect(csv).toContain('"Ali ""Coach"""');
    expect(csv).toContain('ali@gym.com');
    expect(csv).toContain('2026-06');
  });
});
