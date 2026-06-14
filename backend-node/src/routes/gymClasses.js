/**
 * Gym group classes — schedule, trainer, price (owner only).
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertGymOwner, MEMBER_USER_SELECT } = require('../lib/gymAccess');
const { ensureAthleteUser } = require('../lib/receptionPerson');
const {
  dayOfWeekFromDate,
  expirePastClasses,
  isClassUpcoming,
  isSessionDay,
  canMarkClassAttendance,
  loadClassSessionStats,
  gymTodayKey,
  sessionDateKey,
  findTrainerScheduleConflict,
  findMemberClassConflict,
} = require('../lib/gymClassSession');
const { emitNotification } = require('../lib/notifications');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);
router.use(requireRole('gym'));

const gymIdParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const classIdParam = z.object({
  params: z.object({ id: z.string().uuid(), classId: z.string().uuid() }),
});

const updateBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    classId: z.string().uuid(),
    bookingId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['attended', 'no_show', 'cancelled']),
  }),
});

const timeRegex = /^\d{2}:\d{2}$/;

const classBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive().max(1_000_000),
  currency: z.string().length(3).optional(),
  staffId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: classBodySchema,
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid(), classId: z.string().uuid() }),
  body: classBodySchema.partial(),
});

const bookSchema = z.object({
  params: z.object({ id: z.string().uuid(), classId: z.string().uuid() }),
  body: z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    gender: z.enum(['male', 'female']).optional().nullable(),
    avatarUrl: z.string().trim().max(2000).optional().nullable(),
    paymentMethod: z.enum(['cash', 'card', 'transfer', 'online']),
    paidAmount: z.number().nonnegative().optional().nullable(),
    sessionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  }),
});

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

async function validateStaffForClass(gymId, staffId) {
  const staff = await prisma.gymStaff.findFirst({
    where: { id: staffId, gymId, isActive: true },
  });
  if (!staff) return { error: 'Trainer not found for this gym' };
  if (staff.role !== 'trainer') return { error: 'Only staff with trainer role can lead a class' };
  return { staff };
}

function validateTimeRange(startTime, endTime) {
  if (startTime >= endTime) return 'End time must be after start time';
  return null;
}

function respondTrainerConflict(res, conflict) {
  return res.status(409).json({
    error: `This trainer already has "${conflict.name}" scheduled at ${conflict.startTime}–${conflict.endTime}.`,
    code: 'TRAINER_SCHEDULE_CONFLICT',
    conflict: {
      name: conflict.name,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
    },
  });
}

function respondMemberClassConflict(res, conflict) {
  return res.status(409).json({
    error: `This member is already booked for "${conflict.name}" at ${conflict.startTime}–${conflict.endTime}.`,
    code: 'MEMBER_CLASS_CONFLICT',
    conflict: {
      name: conflict.name,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
    },
  });
}

const classInclude = {
  staff: { select: { id: true, fullName: true, role: true, email: true } },
};

router.get('/stats', validate(gymIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const stats = await loadClassSessionStats(prisma, req.params.id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/today', validate(gymIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    await expirePastClasses(prisma, req.params.id);
    const todayKey = gymTodayKey();

    const rows = await prisma.gymClass.findMany({
      where: { gymId: req.params.id, isActive: true },
      include: classInclude,
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    });
    const today = rows.filter(
      (row) => sessionDateKey(row.sessionDate) === todayKey && isClassUpcoming(row),
    );
    res.json(today.map(formatClassRow));
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(gymIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const rows = await prisma.gymClass.findMany({
      where: { gymId: req.params.id, isActive: true },
      include: classInclude,
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { name: 'asc' }],
    });
    const upcoming = rows.filter((row) => isClassUpcoming(row));
    res.json(upcoming.map(formatClassRow));
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const timeErr = validateTimeRange(req.body.startTime, req.body.endTime);
    if (timeErr) return res.status(400).json({ error: timeErr });

    const staffCheck = await validateStaffForClass(req.params.id, req.body.staffId);
    if (staffCheck.error) return res.status(400).json({ error: staffCheck.error });

    const sessionDate = new Date(`${req.body.sessionDate}T12:00:00.000Z`);
    const draft = {
      sessionDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    };
    if (!isClassUpcoming(draft)) {
      return res.status(400).json({ error: 'Session date and time must be in the future' });
    }

    const conflict = await findTrainerScheduleConflict(prisma, {
      gymId: req.params.id,
      staffId: req.body.staffId,
      sessionDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    });
    if (conflict) return respondTrainerConflict(res, conflict);

    const row = await prisma.gymClass.create({
      data: {
        gymId: req.params.id,
        name: req.body.name.trim(),
        nameAr: req.body.nameAr?.trim() || null,
        description: req.body.description?.trim() || null,
        price: req.body.price,
        currency: req.body.currency || 'EGP',
        staffId: req.body.staffId,
        sessionDate,
        dayOfWeek: dayOfWeekFromDate(sessionDate),
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        imageUrl: req.body.imageUrl || null,
      },
      include: classInclude,
    });
    res.status(201).json(formatClassRow(row));
  } catch (err) {
    next(err);
  }
});

router.patch('/:classId', validate(updateSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const existing = await prisma.gymClass.findFirst({
      where: { id: req.params.classId, gymId: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    const startTime = req.body.startTime ?? existing.startTime;
    const endTime = req.body.endTime ?? existing.endTime;
    const timeErr = validateTimeRange(startTime, endTime);
    if (timeErr) return res.status(400).json({ error: timeErr });

    if (req.body.staffId) {
      const staffCheck = await validateStaffForClass(req.params.id, req.body.staffId);
      if (staffCheck.error) return res.status(400).json({ error: staffCheck.error });
    }

    const data = { ...req.body };
    if (data.name) data.name = data.name.trim();
    if (data.nameAr !== undefined) data.nameAr = data.nameAr?.trim() || null;
    if (data.description !== undefined) data.description = data.description?.trim() || null;
    if (data.sessionDate) {
      data.sessionDate = new Date(`${data.sessionDate}T12:00:00.000Z`);
      data.dayOfWeek = dayOfWeekFromDate(data.sessionDate);
    }

    const merged = { ...existing, ...data };
    if (!isClassUpcoming(merged)) {
      return res.status(400).json({ error: 'Session date and time must be in the future' });
    }

    const willBeActive = data.isActive !== undefined ? data.isActive : existing.isActive;
    if (willBeActive) {
      const conflict = await findTrainerScheduleConflict(prisma, {
        gymId: req.params.id,
        staffId: merged.staffId,
        sessionDate: merged.sessionDate,
        startTime: merged.startTime,
        endTime: merged.endTime,
        excludeClassId: existing.id,
      });
      if (conflict) return respondTrainerConflict(res, conflict);
    }

    const row = await prisma.gymClass.update({
      where: { id: req.params.classId },
      data,
      include: classInclude,
    });
    res.json(formatClassRow(row));
  } catch (err) {
    next(err);
  }
});

function formatBookingRow(row) {
  return {
    id: row.id,
    gymId: row.gymId,
    classId: row.classId,
    userId: row.userId,
    sessionDate: row.sessionDate,
    paidAmount: row.paidAmount,
    paymentMethod: row.paymentMethod,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          profile: row.user.profile
            ? {
                displayName: row.user.profile.displayName,
                avatarUrl: row.user.profile.avatarUrl,
                gender: row.user.profile.gender,
              }
            : null,
        }
      : null,
    class: row.class
      ? {
          id: row.class.id,
          name: row.class.name,
          nameAr: row.class.nameAr,
          dayOfWeek: row.class.dayOfWeek,
          startTime: row.class.startTime,
          endTime: row.class.endTime,
          price: row.class.price,
        }
      : null,
  };
}

router.get('/:classId/bookings', validate(classIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const gymClass = await prisma.gymClass.findFirst({
      where: { id: req.params.classId, gymId: req.params.id },
    });
    if (!gymClass) return res.status(404).json({ error: 'Class not found' });

    const rows = await prisma.gymClassBooking.findMany({
      where: {
        gymId: req.params.id,
        classId: req.params.classId,
        status: { in: ['booked', 'attended', 'no_show'] },
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
            sessionDate: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    res.json({
      class: formatClassRow({ ...gymClass, staff: null }),
      bookings: rows.map(formatBookingRow),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:classId/bookings/:bookingId', validate(updateBookingSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const gymClass = await prisma.gymClass.findFirst({
      where: { id: req.params.classId, gymId: req.params.id },
    });
    if (!gymClass) return res.status(404).json({ error: 'Class not found' });

    const booking = await prisma.gymClassBooking.findFirst({
      where: {
        id: req.params.bookingId,
        gymId: req.params.id,
        classId: req.params.classId,
      },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const nextStatus = req.body.status;

    if (nextStatus === 'attended') {
      if (booking.status !== 'booked') {
        return res.status(400).json({ error: 'Only booked sessions can be marked as attended' });
      }
      if (!canMarkClassAttendance(gymClass)) {
        return res.status(400).json({ error: 'Attendance can only be marked on the session day' });
      }
    }

    if (nextStatus === 'no_show') {
      if (booking.status !== 'booked') {
        return res.status(400).json({ error: 'Only booked sessions can be marked as no-show' });
      }
      if (!isSessionDay(gymClass)) {
        return res.status(400).json({ error: 'No-show can only be marked on the session day' });
      }
    }

    if (nextStatus === 'cancelled') {
      if (booking.status !== 'booked') {
        return res.status(400).json({ error: 'Only booked sessions can be cancelled' });
      }
    }

    const updated = await prisma.gymClassBooking.update({
      where: { id: booking.id },
      data: { status: nextStatus },
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

    res.json(formatBookingRow(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/:classId/bookings', validate(bookSchema), async (req, res, next) => {
  try {
    const gym = await assertGymOwner(req.params.id, req.user.id);
    await expirePastClasses(prisma, req.params.id);
    const gymClass = await prisma.gymClass.findFirst({
      where: { id: req.params.classId, gymId: req.params.id },
      include: classInclude,
    });
    if (!gymClass) return res.status(404).json({ error: 'Class not found' });
    if (!gymClass.isActive) {
      return res.status(410).json({ error: 'This class is no longer available for booking' });
    }
    if (!isClassUpcoming(gymClass)) {
      return res.status(400).json({ error: 'This class session has already ended' });
    }

    const { user, accountCreated } = await ensureAthleteUser(req.body);

    const sessionDate = gymClass.sessionDate;

    const duplicate = await prisma.gymClassBooking.findFirst({
      where: {
        classId: gymClass.id,
        userId: user.id,
        sessionDate,
        status: 'booked',
      },
    });
    if (duplicate) {
      return res.status(409).json({ error: 'This person is already booked for this class session' });
    }

    const memberConflict = await findMemberClassConflict(prisma, {
      gymId: gym.id,
      userId: user.id,
      sessionDate: gymClass.sessionDate,
      startTime: gymClass.startTime,
      endTime: gymClass.endTime,
      excludeClassId: gymClass.id,
    });
    if (memberConflict) return respondMemberClassConflict(res, memberConflict);

    const paidAmount = req.body.paidAmount ?? gymClass.price;
    const booking = await prisma.gymClassBooking.create({
      data: {
        gymId: gym.id,
        classId: gymClass.id,
        userId: user.id,
        sessionDate,
        paidAmount,
        paymentMethod: req.body.paymentMethod,
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
      userId: user.id,
      type: 'gym.class',
      title: accountCreated ? `Class booked at ${gym.name}` : `Session confirmed`,
      message: accountCreated
        ? `You were registered and booked for ${classLabel}. Use "Forgot password" to set your login.`
        : `You are booked for ${classLabel} on ${sessionDate.toISOString().slice(0, 10)}.`,
      link: '/gyms',
    });

    res.status(201).json({
      accountCreated,
      booking: formatBookingRow(booking),
    });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'This person is already booked for this class session' });
    }
    next(err);
  }
});

router.delete('/:classId', validate(classIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const existing = await prisma.gymClass.findFirst({
      where: { id: req.params.classId, gymId: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Class not found' });

    await prisma.gymClass.update({
      where: { id: req.params.classId },
      data: { isActive: false },
    });
    res.json({ ok: true, id: req.params.classId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
