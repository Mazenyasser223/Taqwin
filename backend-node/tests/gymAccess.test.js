import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { removeGymMemberData, purgeGymMember } = require('../src/lib/gymAccess');

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

describe('gymAccess.purgeGymMember', () => {
  it('deletes full user when desk-created and no other gym memberships', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const userDelete = vi.fn().mockResolvedValue({});
    const client = {
      gymMembership: { count: vi.fn().mockResolvedValue(0), deleteMany },
      gymClassBooking: { deleteMany },
      gymCheckIn: { deleteMany },
      user: { delete: userDelete },
    };

    const result = await purgeGymMember(client, 'gym-1', 'user-1', { accountCreatedAtDesk: true });

    expect(result.userDeleted).toBe(true);
    expect(result.mode).toBe('account_deleted');
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('removes gym data only for pre-existing Taqwin members', async () => {
    const deleteMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
    const userDelete = vi.fn();
    const client = {
      gymMembership: { count: vi.fn(), deleteMany },
      gymClassBooking: { deleteMany },
      gymCheckIn: { deleteMany },
      user: { delete: userDelete },
    };

    const result = await purgeGymMember(client, 'gym-1', 'user-1', { accountCreatedAtDesk: false });

    expect(result.userDeleted).toBe(false);
    expect(result.mode).toBe('gym_only');
    expect(userDelete).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledTimes(3);
  });

  it('removes gym data only when desk-created user has other gym memberships', async () => {
    const deleteMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const userDelete = vi.fn();
    const client = {
      gymMembership: { count: vi.fn().mockResolvedValue(1), deleteMany },
      gymClassBooking: { deleteMany },
      gymCheckIn: { deleteMany },
      user: { delete: userDelete },
    };

    const result = await purgeGymMember(client, 'gym-1', 'user-1', { accountCreatedAtDesk: true });

    expect(result.userDeleted).toBe(false);
    expect(result.mode).toBe('gym_only');
    expect(userDelete).not.toHaveBeenCalled();
  });
});
