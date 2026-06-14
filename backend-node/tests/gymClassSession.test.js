import { describe, it, expect, vi } from 'vitest';

import { createRequire } from 'node:module';



const require = createRequire(import.meta.url);

const { loadClassSessionStats, expirePastClasses, isSessionDay, canMarkClassAttendance, sessionsOverlap, findTrainerScheduleConflict, findMemberClassConflict } = require('../src/lib/gymClassSession');



describe('gymClassSession.loadClassSessionStats', () => {

  it('returns all gym classes with zeroed stats when no bookings', async () => {

    const prisma = {

      gymClass: {

        findMany: vi.fn().mockResolvedValue([

          {

            id: 'c1',

            name: 'HIIT',

            nameAr: null,

            sessionDate: new Date('2026-06-10'),

            startTime: '10:00',

            endTime: '11:00',

            isActive: true,

          },

        ]),

      },

      gymClassBooking: {

        findMany: vi.fn().mockResolvedValue([]),

      },

    };



    const result = await loadClassSessionStats(prisma, 'gym-1');



    expect(result.totalBooked).toBe(0);

    expect(result.totalAttended).toBe(0);

    expect(result.totalNoShow).toBe(0);

    expect(result.sessions[0]).toMatchObject({ booked: 0, attended: 0, noShow: 0 });

  });



  it('aggregates attended bookings per class', async () => {

    const prisma = {

      gymClass: {

        findMany: vi.fn().mockResolvedValue([

          {

            id: 'c1',

            name: 'HIIT',

            nameAr: null,

            sessionDate: new Date('2026-06-10'),

            startTime: '10:00',

            endTime: '11:00',

            isActive: true,

          },

        ]),

      },

      gymClassBooking: {

        findMany: vi.fn().mockResolvedValue([

          { classId: 'c1', paidAmount: 200, status: 'attended' },

          { classId: 'c1', paidAmount: 150, status: 'attended' },

        ]),

      },

    };



    const result = await loadClassSessionStats(prisma, 'gym-1');



    expect(result.totalAttended).toBe(2);

    expect(result.sessions[0]).toMatchObject({ attended: 2, attendedRevenue: 350 });

  });



  it('aggregates booked, attended, and no_show separately', async () => {

    const prisma = {

      gymClass: {

        findMany: vi.fn().mockResolvedValue([

          {

            id: 'c1',

            name: 'HIIT',

            nameAr: null,

            sessionDate: new Date('2026-06-10'),

            startTime: '10:00',

            endTime: '11:00',

            isActive: true,

          },

        ]),

      },

      gymClassBooking: {

        findMany: vi.fn().mockResolvedValue([

          { classId: 'c1', paidAmount: 200, status: 'booked' },

          { classId: 'c1', paidAmount: 200, status: 'attended' },

          { classId: 'c1', paidAmount: 150, status: 'no_show' },

        ]),

      },

    };



    const result = await loadClassSessionStats(prisma, 'gym-1');



    expect(result.totalBooked).toBe(1);

    expect(result.totalAttended).toBe(1);

    expect(result.totalNoShow).toBe(1);

    expect(result.sessions[0]).toMatchObject({

      booked: 1,

      attended: 1,

      noShow: 1,

      revenue: 550,

    });

  });

});



describe('gymClassSession.expirePastClasses', () => {

  it('marks remaining booked bookings as no_show when class ends', async () => {

    const pastClass = {

      id: 'c1',

      sessionDate: new Date('2020-01-01'),

      startTime: '08:00',

      endTime: '09:00',

    };

    const updateMany = vi.fn().mockResolvedValue({ count: 2 });

    const prisma = {

      gymClass: {

        findMany: vi.fn().mockResolvedValue([pastClass]),

        update: vi.fn().mockResolvedValue({}),

      },

      gymClassBooking: { updateMany },

      $transaction: vi.fn(async (ops) => Promise.all(ops.map((op) => op))),

    };



    await expirePastClasses(prisma, 'gym-1');



    expect(updateMany).toHaveBeenCalledWith({

      where: { classId: 'c1', status: 'booked' },

      data: { status: 'no_show' },

    });

  });

});



describe('gymClassSession.isSessionDay', () => {
  it('returns true when Cairo calendar date matches session date', () => {
    const now = new Date('2026-06-07T23:00:00.000Z');
    const gymClass = { sessionDate: new Date('2026-06-08T00:00:00.000Z'), startTime: '01:00', endTime: '02:00' };
    expect(isSessionDay(gymClass, now)).toBe(true);
  });

  it('returns false before session day in Cairo', () => {
    const now = new Date('2026-06-07T20:00:00.000Z');
    const gymClass = { sessionDate: new Date('2026-06-08T00:00:00.000Z'), startTime: '01:00', endTime: '02:00' };
    expect(isSessionDay(gymClass, now)).toBe(false);
  });
});

describe('gymClassSession.canMarkClassAttendance', () => {
  it('allows marking any time on session day in Cairo', () => {
    const now = new Date('2026-06-08T20:00:00.000Z');
    const gymClass = { sessionDate: new Date('2026-06-08T00:00:00.000Z'), startTime: '01:00', endTime: '02:00' };
    expect(canMarkClassAttendance(gymClass, now)).toBe(true);
  });

  it('blocks marking before session day in Cairo', () => {
    const now = new Date('2026-06-07T20:00:00.000Z');
    const gymClass = { sessionDate: new Date('2026-06-08T00:00:00.000Z'), startTime: '10:00', endTime: '11:00' };
    expect(canMarkClassAttendance(gymClass, now)).toBe(false);
  });
});

describe('gymClassSession.sessionsOverlap', () => {
  it('detects exact and partial overlaps', () => {
    const aStart = new Date('2026-06-14T15:00:00+02:00');
    const aEnd = new Date('2026-06-14T16:00:00+02:00');
    const bStart = new Date('2026-06-14T15:00:00+02:00');
    const bEnd = new Date('2026-06-14T16:00:00+02:00');
    expect(sessionsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);

    const cStart = new Date('2026-06-14T15:30:00+02:00');
    const cEnd = new Date('2026-06-14T16:30:00+02:00');
    expect(sessionsOverlap(aStart, aEnd, cStart, cEnd)).toBe(true);
  });

  it('allows back-to-back sessions', () => {
    const aStart = new Date('2026-06-14T15:00:00+02:00');
    const aEnd = new Date('2026-06-14T16:00:00+02:00');
    const bStart = new Date('2026-06-14T16:00:00+02:00');
    const bEnd = new Date('2026-06-14T17:00:00+02:00');
    expect(sessionsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
});

describe('gymClassSession.findTrainerScheduleConflict', () => {
  it('returns conflicting class when trainer has overlapping session', async () => {
    const existing = {
      id: 'c2',
      name: 'Weight Loss',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '15:00',
      endTime: '16:00',
    };
    const prisma = {
      gymClass: {
        findMany: vi.fn().mockResolvedValue([existing]),
      },
    };

    const conflict = await findTrainerScheduleConflict(prisma, {
      gymId: 'gym-1',
      staffId: 'staff-1',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(conflict).toMatchObject({ id: 'c2', name: 'Weight Loss' });
  });

  it('returns null when sessions do not overlap', async () => {
    const existing = {
      id: 'c2',
      name: 'Morning Yoga',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
    };
    const prisma = {
      gymClass: {
        findMany: vi.fn().mockResolvedValue([existing]),
      },
    };

    const conflict = await findTrainerScheduleConflict(prisma, {
      gymId: 'gym-1',
      staffId: 'staff-1',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(conflict).toBeNull();
  });

  it('excludes the class being edited', async () => {
    const prisma = {
      gymClass: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const conflict = await findTrainerScheduleConflict(prisma, {
      gymId: 'gym-1',
      staffId: 'staff-1',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '15:00',
      endTime: '16:00',
      excludeClassId: 'c1',
    });

    expect(conflict).toBeNull();
    expect(prisma.gymClass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'c1' } }),
      }),
    );
  });
});

describe('gymClassSession.findMemberClassConflict', () => {
  it('returns conflicting class when member has overlapping booking', async () => {
    const existing = {
      id: 'b1',
      class: {
        id: 'c2',
        name: 'CrossFit & HIIT',
        sessionDate: new Date('2026-06-14T12:00:00.000Z'),
        startTime: '15:00',
        endTime: '16:00',
        isActive: true,
      },
    };
    const prisma = {
      gymClassBooking: {
        findMany: vi.fn().mockResolvedValue([existing]),
      },
    };

    const conflict = await findMemberClassConflict(prisma, {
      gymId: 'gym-1',
      userId: 'user-1',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '15:00',
      endTime: '16:00',
      excludeClassId: 'c3',
    });

    expect(conflict).toMatchObject({ id: 'c2', name: 'CrossFit & HIIT' });
  });

  it('returns null when member bookings do not overlap', async () => {
    const existing = {
      id: 'b1',
      class: {
        id: 'c2',
        name: 'Morning Yoga',
        sessionDate: new Date('2026-06-14T12:00:00.000Z'),
        startTime: '10:00',
        endTime: '11:00',
        isActive: true,
      },
    };
    const prisma = {
      gymClassBooking: {
        findMany: vi.fn().mockResolvedValue([existing]),
      },
    };

    const conflict = await findMemberClassConflict(prisma, {
      gymId: 'gym-1',
      userId: 'user-1',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(conflict).toBeNull();
  });

  it('ignores inactive or non-booked classes', async () => {
    const prisma = {
      gymClassBooking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const conflict = await findMemberClassConflict(prisma, {
      gymId: 'gym-1',
      userId: 'user-1',
      sessionDate: new Date('2026-06-14T12:00:00.000Z'),
      startTime: '15:00',
      endTime: '16:00',
    });

    expect(conflict).toBeNull();
    expect(prisma.gymClassBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'booked' }),
      }),
    );
  });
});

