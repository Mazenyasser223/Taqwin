import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadClassBookingRevenueSince, loadBasicSessionBookingRevenueSince, summarizeMemberships } = require('../src/lib/gymDashboard');

describe('gymDashboard.loadClassBookingRevenueSince', () => {
  it('sums paid amounts for active class bookings since date', async () => {
    const prisma = {
      gymClassBooking: {
        findMany: vi.fn().mockResolvedValue([
          { paidAmount: 200 },
          { paidAmount: 150 },
        ]),
      },
    };

    const since = new Date('2026-06-01T00:00:00.000Z');
    const total = await loadClassBookingRevenueSince(prisma, 'gym-1', since);

    expect(total).toBe(350);
    expect(prisma.gymClassBooking.findMany).toHaveBeenCalledWith({
      where: {
        gymId: 'gym-1',
        status: { in: ['booked', 'attended', 'no_show'] },
        createdAt: { gte: since },
      },
      select: { paidAmount: true },
    });
  });
});

describe('gymDashboard.loadBasicSessionBookingRevenueSince', () => {
  it('sums paid amounts for active basic session bookings since date', async () => {
    const prisma = {
      gymBasicSessionBooking: {
        findMany: vi.fn().mockResolvedValue([
          { paidAmount: 300 },
          { paidAmount: 250 },
        ]),
      },
    };

    const since = new Date('2026-06-01T00:00:00.000Z');
    const total = await loadBasicSessionBookingRevenueSince(prisma, 'gym-1', since);

    expect(total).toBe(550);
    expect(prisma.gymBasicSessionBooking.findMany).toHaveBeenCalledWith({
      where: {
        gymId: 'gym-1',
        status: { in: ['booked', 'attended', 'no_show'] },
        createdAt: { gte: since },
      },
      select: { paidAmount: true },
    });
  });
});

describe('gymDashboard.summarizeMemberships', () => {
  it('includes membership payments in month revenue', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const monthStart = new Date(Date.UTC(2026, 5, 1));
    const result = summarizeMemberships(
      [
        {
          isActive: true,
          expiresAt: null,
          joinedAt: new Date('2026-06-01'),
          paidAt: new Date('2026-06-02'),
          paidAmount: 1000,
          plan: { name: 'Beginner' },
          planId: 'p1',
        },
      ],
      now,
      monthStart,
    );

    expect(result.monthRevenue).toBe(1000);
  });
});
