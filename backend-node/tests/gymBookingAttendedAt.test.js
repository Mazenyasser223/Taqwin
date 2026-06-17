import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sumAttendedBookingRevenue } = require('../src/lib/gymBookingAttendedAt');

describe('gymBookingAttendedAt.sumAttendedBookingRevenue', () => {
  it('falls back to createdAt when attendedAt column is missing', async () => {
    const since = new Date('2026-06-01T00:00:00.000Z');
    const findMany = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2022', message: 'column attended_at does not exist' })
      .mockResolvedValueOnce([{ paidAmount: 200 }]);

    const prisma = { gymClassBooking: { findMany } };
    const total = await sumAttendedBookingRevenue(prisma, 'gymClassBooking', 'gym-1', since);

    expect(total).toBe(200);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0]).toEqual({
      where: { gymId: 'gym-1', status: 'attended', createdAt: { gte: since } },
      select: { paidAmount: true },
    });
  });
});
