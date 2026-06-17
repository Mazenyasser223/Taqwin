/**
 * Gym basic sessions — spa / jacuzzi / sauna (no trainer, no schedule).
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertGymOwner, MEMBER_USER_SELECT } = require('../lib/gymAccess');
const { ensureAthleteUser } = require('../lib/receptionPerson');
const { emitNotification } = require('../lib/notifications');
const {
  ensureBasicSessionsForGym,
  formatSessionRow,
  formatBookingRow,
  gymTodayBounds,
} = require('../lib/gymBasicSessions');
const { updateBookingWithAttendedAt } = require('../lib/gymBookingAttendedAt');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);
router.use(requireRole('gym'));

const sessionIdParam = z.object({
  params: z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }),
});

const updateSessionSchema = z.object({
  params: z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    nameAr: z.string().trim().max(120).optional().nullable(),
    price: z.number().positive().max(1_000_000).optional(),
    currency: z.string().length(3).optional(),
    isActive: z.boolean().optional(),
  }),
});

const bookSchema = z.object({
  params: z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }),
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
    notes: z.string().trim().max(500).optional().nullable(),
  }),
});

const updateBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    bookingId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['attended', 'no_show', 'cancelled']),
  }),
});

router.get('/bookings/today', async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const { start, end } = gymTodayBounds();

    const rows = await prisma.gymBasicSessionBooking.findMany({
      where: {
        gymId: req.params.id,
        createdAt: { gte: start, lt: end },
        status: { in: ['booked', 'attended', 'no_show'] },
      },
      include: {
        user: { select: MEMBER_USER_SELECT },
        session: { select: { id: true, type: true, name: true, nameAr: true, price: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    res.json(rows.map(formatBookingRow));
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const sessions = await ensureBasicSessionsForGym(req.params.id);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId', validate(updateSessionSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const existing = await prisma.gymBasicSession.findFirst({
      where: { id: req.params.sessionId, gymId: req.params.id },
    });
    if (!existing) return res.status(404).json({ error: 'Session not found' });

    const updated = await prisma.gymBasicSession.update({
      where: { id: existing.id },
      data: req.body,
    });

    res.json(formatSessionRow(updated));
  } catch (err) {
    next(err);
  }
});

router.get('/:sessionId/bookings', validate(sessionIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const session = await prisma.gymBasicSession.findFirst({
      where: { id: req.params.sessionId, gymId: req.params.id },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const rows = await prisma.gymBasicSessionBooking.findMany({
      where: {
        gymId: req.params.id,
        sessionId: session.id,
        status: { in: ['booked', 'attended', 'no_show'] },
      },
      include: {
        user: { select: MEMBER_USER_SELECT },
        session: { select: { id: true, type: true, name: true, nameAr: true, price: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
    });

    res.json({
      session: formatSessionRow(session),
      bookings: rows.map(formatBookingRow),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId/bookings/:bookingId', validate(updateBookingSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);

    const booking = await prisma.gymBasicSessionBooking.findFirst({
      where: {
        id: req.params.bookingId,
        gymId: req.params.id,
        sessionId: req.params.sessionId,
      },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const nextStatus = req.body.status;
    if (nextStatus !== 'cancelled' && booking.status !== 'booked') {
      return res.status(400).json({ error: 'Only booked sessions can be updated' });
    }
    if (nextStatus === 'cancelled' && booking.status !== 'booked') {
      return res.status(400).json({ error: 'Only booked sessions can be cancelled' });
    }

    const updated = await updateBookingWithAttendedAt(
      prisma,
      'gymBasicSessionBooking',
      { id: booking.id },
      nextStatus,
      {
        user: { select: MEMBER_USER_SELECT },
        session: { select: { id: true, type: true, name: true, nameAr: true, price: true } },
      },
    );

    res.json(formatBookingRow(updated));
  } catch (err) {
    next(err);
  }
});

router.post('/:sessionId/bookings', validate(bookSchema), async (req, res, next) => {
  try {
    const gym = await assertGymOwner(req.params.id, req.user.id);

    const session = await prisma.gymBasicSession.findFirst({
      where: { id: req.params.sessionId, gymId: req.params.id },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.isActive) {
      return res.status(410).json({ error: 'This session is no longer available for booking' });
    }

    const { user, accountCreated } = await ensureAthleteUser(req.body);

    const duplicate = await prisma.gymBasicSessionBooking.findFirst({
      where: {
        sessionId: session.id,
        userId: user.id,
        status: 'booked',
      },
    });
    if (duplicate) {
      return res.status(409).json({ error: 'This person already has an active booking for this session' });
    }

    const paidAmount = req.body.paidAmount ?? session.price;
    const booking = await prisma.gymBasicSessionBooking.create({
      data: {
        gymId: gym.id,
        sessionId: session.id,
        userId: user.id,
        paidAmount,
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes ?? null,
      },
      include: {
        user: { select: MEMBER_USER_SELECT },
        session: { select: { id: true, type: true, name: true, nameAr: true, price: true } },
      },
    });

    const sessionLabel = session.nameAr || session.name;
    emitNotification({
      userId: user.id,
      type: 'gym.class',
      title: accountCreated ? `Session booked at ${gym.name}` : 'Session confirmed',
      message: accountCreated
        ? `You were registered and booked for ${sessionLabel}. Use "Forgot password" to set your login.`
        : `You are booked for ${sessionLabel}.`,
      link: '/gyms',
    });

    res.status(201).json({
      accountCreated,
      booking: formatBookingRow(booking),
    });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
