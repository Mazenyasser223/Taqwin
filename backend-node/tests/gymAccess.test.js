import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { removeGymMemberData } = require('../src/lib/gymAccess');

describe('gymAccess.removeGymMemberData', () => {
  it('deletes bookings, visits, and membership for the gym only', async () => {
    const deleteMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 1 });

    const client = {
      gymClassBooking: { deleteMany },
      gymCheckIn: { deleteMany },
      gymMembership: { deleteMany },
    };

    const result = await removeGymMemberData(client, 'gym-1', 'user-1');

    expect(result).toEqual({
      deletedBookings: 2,
      deletedVisits: 5,
      deletedMemberships: 1,
    });
    expect(deleteMany).toHaveBeenNthCalledWith(1, {
      where: { gymId: 'gym-1', userId: 'user-1' },
    });
    expect(deleteMany).toHaveBeenNthCalledWith(2, {
      where: { gymId: 'gym-1', userId: 'user-1' },
    });
    expect(deleteMany).toHaveBeenNthCalledWith(3, {
      where: { gymId: 'gym-1', userId: 'user-1' },
    });
  });
});
