/**
 * Public gym offerings — list sessions/classes and self-book as the signed-in user.
 */
const { prisma } = require('../db');
const { emitNotification } = require('./notifications');
const { MEMBER_USER_SELECT } = require('./gymAccess');
const {
  ensureBasicSessionsForGym,
  formatBookingRow,
} = require('./gymBasicSessions');
const {
  expirePastClasses,
  isClassUpcoming,
  findMemberClassConflict,
} = require('./gymClassSession');

const classInclude = {
  staff: { select: { id: true, fullName: true, role: true, email: true } },
};

function formatClassRow(row) {
  return {
    id: row.id,
    gymId: row.gymId,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    price: row.price,
    currency: row.currency,
    staffId: row.staffId,
    sessionDate: row.sessionDate,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    imageUrl: row.imageUrl,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    staff: row.staff
      ? {
          id: row.staff.id,
          fullName: row.staff.fullName,
          role: row.staff.role,
          email: row.staff.email,
        }
      : null,
  };
}

async function assertActiveGym(gymId) {
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) {
    const err = new Error('Gym not found');
    err.status = 404;
    throw err;
  }
  if (!gym.isActive) {
    const err = new Error('Gym not found');
    err.status = 404;
    throw err;
  }
  return gym;
}

async function listCatalogBasicSessions(gymId) {
  await assertActiveGym(gymId);
  const sessions = await ensureBasicSessionsForGym(gymId);
  return sessions.filter((s) => s.isActive);
}

async function listCatalogClasses(gymId) {
  await assertActiveGym(gymId);
  await expirePastClasses(prisma, gymId);
  const rows = await prisma.gymClass.findMany({
    where: { gymId, isActive: true },
    include: classInclude,
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { name: 'asc' }],
  });
  return rows.filter((row) => isClassUpcoming(row)).map(formatClassRow);
}

async function selfBookBasicSession(gymId, sessionId, userId, paymentMethod) {
  const gym = await assertActiveGym(gymId);

  const session = await prisma.gymBasicSession.findFirst({
    where: { id: sessionId, gymId },
  });
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (!session.isActive) {
    const err = new Error('This session is no longer available for booking');
    err.status = 410;
    throw err;
  }

  const duplicate = await prisma.gymBasicSessionBooking.findFirst({
    where: { sessionId: session.id, userId, status: 'booked' },
  });
  if (duplicate) {
    const err = new Error('You already have an active booking for this session');
    err.status = 409;
    throw err;
  }

  const booking = await prisma.gymBasicSessionBooking.create({
    data: {
      gymId: gym.id,
      sessionId: session.id,
      userId,
      paidAmount: session.price,
      paymentMethod,
    },
    include: {
      user: { select: MEMBER_USER_SELECT },
      session: { select: { id: true, type: true, name: true, nameAr: true, price: true } },
    },
  });

  const sessionLabel = session.nameAr || session.name;
  emitNotification({
    userId,
    type: 'gym.class',
    link: '/gyms',
    payload: { sessionLabel, gymName: gym.name },
  });

  return formatBookingRow(booking);
}

async function selfBookClassSession(gymId, classId, userId, paymentMethod) {
  const gym = await assertActiveGym(gymId);
  await expirePastClasses(prisma, gymId);

  const gymClass = await prisma.gymClass.findFirst({
    where: { id: classId, gymId },
    include: classInclude,
  });
  if (!gymClass) {
    const err = new Error('Class not found');
    err.status = 404;
    throw err;
  }
  if (!gymClass.isActive) {
    const err = new Error('This class is no longer available for booking');
    err.status = 410;
    throw err;
  }
  if (!isClassUpcoming(gymClass)) {
    const err = new Error('This class session has already ended');
    err.status = 400;
    throw err;
  }

  const sessionDate = gymClass.sessionDate;

  const duplicate = await prisma.gymClassBooking.findFirst({
    where: { classId: gymClass.id, userId, sessionDate, status: 'booked' },
  });
  if (duplicate) {
    const err = new Error('You are already booked for this class session');
    err.status = 409;
    throw err;
  }

  const memberConflict = await findMemberClassConflict(prisma, {
    gymId: gym.id,
    userId,
    sessionDate: gymClass.sessionDate,
    startTime: gymClass.startTime,
    endTime: gymClass.endTime,
    excludeClassId: gymClass.id,
  });
  if (memberConflict) {
    const err = new Error(
      `You are already booked for "${memberConflict.name}" at ${memberConflict.startTime}–${memberConflict.endTime}.`,
    );
    err.status = 409;
    err.code = 'MEMBER_CLASS_CONFLICT';
    err.conflict = memberConflict;
    throw err;
  }

  const booking = await prisma.gymClassBooking.create({
    data: {
      gymId: gym.id,
      classId: gymClass.id,
      userId,
      sessionDate,
      paidAmount: gymClass.price,
      paymentMethod,
    },
    include: {
      user: { select: MEMBER_USER_SELECT },
      class: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          price: true,
        },
      },
    },
  });

  const classLabel = gymClass.nameAr || gymClass.name;
  emitNotification({
    userId,
    type: 'gym.class',
    link: '/gyms',
    payload: {
      classLabel,
      gymName: gym.name,
      sessionDate: sessionDate.toISOString().slice(0, 10),
    },
  });

  return {
    id: booking.id,
    gymId: booking.gymId,
    classId: booking.classId,
    userId: booking.userId,
    sessionDate: booking.sessionDate,
    paidAmount: booking.paidAmount,
    paymentMethod: booking.paymentMethod,
    status: booking.status,
    createdAt: booking.createdAt,
    user: booking.user ?? null,
    class: booking.class ?? null,
  };
}

module.exports = {
  listCatalogBasicSessions,
  listCatalogClasses,
  selfBookBasicSession,
  selfBookClassSession,
};
