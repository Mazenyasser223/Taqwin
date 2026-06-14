/**
 * One-time gym class session dates — upcoming filter and auto-expire.
 */

const GYM_TIMEZONE = 'Africa/Cairo';
const GYM_UTC_OFFSET = '+02:00';

function resolveSessionDate(gymClass) {
  if (gymClass.sessionDate) {
    return gymClass.sessionDate instanceof Date ? gymClass.sessionDate : new Date(gymClass.sessionDate);
  }
  return null;
}

function sessionDateKey(sessionDate) {
  if (!sessionDate) return null;
  if (typeof sessionDate === 'string') {
    const match = sessionDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = sessionDate instanceof Date ? sessionDate : new Date(sessionDate);
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIMEZONE }).format(d);
}

function gymTodayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIMEZONE }).format(now);
}

function parseTimeOnDate(sessionDate, timeStr) {
  const key = sessionDateKey(sessionDate);
  if (!key) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return new Date(`${key}T${hh}:${mm}:00${GYM_UTC_OFFSET}`);
}



function classSessionEndAt(gymClass) {
  const sessionDate = resolveSessionDate(gymClass);
  if (!sessionDate) return null;
  return parseTimeOnDate(sessionDate, gymClass.endTime);
}

function classSessionStartAt(gymClass) {
  const sessionDate = resolveSessionDate(gymClass);
  if (!sessionDate) return null;
  return parseTimeOnDate(sessionDate, gymClass.startTime);
}



function isClassUpcoming(gymClass, now = new Date()) {

  const endAt = classSessionEndAt(gymClass);

  if (!endAt) return true;

  return endAt > now;

}



function dayOfWeekFromDate(date) {

  const d = date instanceof Date ? date : new Date(date);

  return d.getDay();

}



function utcDayBounds(now = new Date()) {

  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const dayEnd = new Date(dayStart);

  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  return { dayStart, dayEnd };

}



function isSessionDay(gymClass, now = new Date()) {
  const key = sessionDateKey(resolveSessionDate(gymClass));
  if (!key) return false;
  return key === gymTodayKey(now);
}

function canMarkClassAttendance(gymClass, now = new Date()) {
  return isSessionDay(gymClass, now);
}

function sessionsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function findTrainerScheduleConflict(
  prisma,
  { gymId, staffId, sessionDate, startTime, endTime, excludeClassId },
) {
  const dateKey = sessionDateKey(sessionDate);
  const proposedStart = parseTimeOnDate(sessionDate, startTime);
  const proposedEnd = parseTimeOnDate(sessionDate, endTime);
  if (!proposedStart || !proposedEnd || proposedEnd <= proposedStart) {
    return null;
  }

  const existing = await prisma.gymClass.findMany({
    where: {
      gymId,
      staffId,
      isActive: true,
      sessionDate: new Date(`${dateKey}T12:00:00.000Z`),
      ...(excludeClassId ? { id: { not: excludeClassId } } : {}),
    },
    select: { id: true, name: true, startTime: true, endTime: true, sessionDate: true },
  });

  for (const cls of existing) {
    const start = classSessionStartAt(cls);
    const end = classSessionEndAt(cls);
    if (!start || !end) continue;
    if (sessionsOverlap(proposedStart, proposedEnd, start, end)) {
      return cls;
    }
  }
  return null;
}

async function findMemberClassConflict(
  prisma,
  { gymId, userId, sessionDate, startTime, endTime, excludeClassId },
) {
  const dateKey = sessionDateKey(sessionDate);
  const proposedStart = parseTimeOnDate(sessionDate, startTime);
  const proposedEnd = parseTimeOnDate(sessionDate, endTime);
  if (!proposedStart || !proposedEnd || proposedEnd <= proposedStart) {
    return null;
  }

  const bookings = await prisma.gymClassBooking.findMany({
    where: {
      gymId,
      userId,
      status: 'booked',
      sessionDate: new Date(`${dateKey}T12:00:00.000Z`),
      ...(excludeClassId ? { classId: { not: excludeClassId } } : {}),
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          sessionDate: true,
          isActive: true,
        },
      },
    },
  });

  for (const booking of bookings) {
    const cls = booking.class;
    if (!cls?.isActive) continue;
    const start = classSessionStartAt(cls);
    const end = classSessionEndAt(cls);
    if (!start || !end) continue;
    if (sessionsOverlap(proposedStart, proposedEnd, start, end)) {
      return cls;
    }
  }
  return null;
}

async function expirePastClasses(prisma, gymId) {
  const active = await prisma.gymClass.findMany({

    where: { gymId, isActive: true },

  });

  const now = new Date();



  for (const gymClass of active) {

    const endAt = classSessionEndAt(gymClass);

    if (!endAt || endAt > now) continue;



    await prisma.$transaction([

      prisma.gymClass.update({

        where: { id: gymClass.id },

        data: { isActive: false },

      }),

      prisma.gymClassBooking.updateMany({

        where: { classId: gymClass.id, status: 'booked' },

        data: { status: 'no_show' },

      }),

    ]);

  }

}



async function loadClassSessionStats(prisma, gymId) {

  const allClasses = await prisma.gymClass.findMany({

    where: { gymId },

    select: {

      id: true,

      name: true,

      nameAr: true,

      sessionDate: true,

      startTime: true,

      endTime: true,

      isActive: true,

    },

    orderBy: [{ sessionDate: 'desc' }, { name: 'asc' }],

  });

  const bookings = await prisma.gymClassBooking.findMany({

      where: { gymId, status: { in: ['booked', 'attended', 'no_show'] } },

      select: { classId: true, paidAmount: true, status: true },

    });



  let totalBooked = 0;

  let totalAttended = 0;

  let totalNoShow = 0;

  let totalRevenue = 0;



  const statsByClass = new Map();

  for (const booking of bookings) {

    const row = statsByClass.get(booking.classId) ?? {

      booked: 0,

      attended: 0,

      noShow: 0,

      bookedRevenue: 0,

      attendedRevenue: 0,

      noShowRevenue: 0,

    };

    const amount = booking.paidAmount || 0;

    totalRevenue += amount;

    if (booking.status === 'booked') {

      row.booked += 1;

      row.bookedRevenue += amount;

      totalBooked += 1;

    } else if (booking.status === 'attended') {

      row.attended += 1;

      row.attendedRevenue += amount;

      totalAttended += 1;

    } else if (booking.status === 'no_show') {

      row.noShow += 1;

      row.noShowRevenue += amount;

      totalNoShow += 1;

    }

    statsByClass.set(booking.classId, row);

  }



  const sessions = allClasses.map((gymClass) => {

    const stats = statsByClass.get(gymClass.id) ?? {

      booked: 0,

      attended: 0,

      noShow: 0,

      bookedRevenue: 0,

      attendedRevenue: 0,

      noShowRevenue: 0,

    };

    return {

      classId: gymClass.id,

      name: gymClass.name,

      nameAr: gymClass.nameAr,

      sessionDate: gymClass.sessionDate,

      startTime: gymClass.startTime,

      endTime: gymClass.endTime,

      isActive: gymClass.isActive,

      booked: stats.booked,

      attended: stats.attended,

      noShow: stats.noShow,

      bookedRevenue: Math.round(stats.bookedRevenue),

      attendedRevenue: Math.round(stats.attendedRevenue),

      noShowRevenue: Math.round(stats.noShowRevenue),

      revenue: Math.round(stats.bookedRevenue + stats.attendedRevenue + stats.noShowRevenue),

    };

  });



  return {

    totalBooked,

    totalAttended,

    totalNoShow,

    totalAttendees: totalAttended,

    totalRevenue: Math.round(totalRevenue),

    sessions,

  };

}



module.exports = {
  resolveSessionDate,
  sessionDateKey,
  gymTodayKey,
  classSessionEndAt,
  classSessionStartAt,
  isClassUpcoming,
  isSessionDay,
  canMarkClassAttendance,
  utcDayBounds,
  dayOfWeekFromDate,
  expirePastClasses,
  loadClassSessionStats,
  sessionsOverlap,
  findTrainerScheduleConflict,
  findMemberClassConflict,
};


