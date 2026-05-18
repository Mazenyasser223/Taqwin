/**
 * Trainers + Bookings.
 *
 *   GET   /api/trainers                       (list trainers)
 *   GET   /api/trainers/:id                   (single trainer with profile)
 *   POST  /api/bookings                       (athlete books a trainer)
 *   GET   /api/bookings/me                    (athlete's bookings)
 *   GET   /api/bookings/trainer               (trainer's incoming bookings)
 *   PATCH /api/bookings/:id                   (status transitions)
 *   GET   /api/bookings/clients               (trainer: distinct athletes who booked me)
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');

const router = express.Router();
router.use(authMiddleware);

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const createBookingSchema = z.object({
  body: z.object({
    trainerId: z.string().uuid(),
    scheduledAt: z.string().datetime(),
    notes: z.string().max(1000).optional(),
  }),
});

const updateBookingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
  }),
});

const TRAINER_SELECT = {
  id: true,
  email: true,
  createdAt: true,
  profile: {
    select: {
      displayName: true,
      avatarUrl: true,
      bio: true,
      specialties: true,
      yearsExperience: true,
    },
  },
};

router.get('/trainers', async (req, res, next) => {
  try {
    const trainers = await prisma.user.findMany({
      where: { role: 'trainer', emailVerifiedAt: { not: null } },
      select: TRAINER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    res.json(trainers);
  } catch (err) {
    next(err);
  }
});

router.get('/trainers/:id', validate(idParam), async (req, res, next) => {
  try {
    const trainer = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'trainer' },
      select: TRAINER_SELECT,
    });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    res.json(trainer);
  } catch (err) {
    next(err);
  }
});

router.post('/bookings', validate(createBookingSchema), async (req, res, next) => {
  try {
    if (req.user.role === 'gym') {
      return res.status(403).json({ error: 'Gym owners cannot book trainers' });
    }
    const trainer = await prisma.user.findFirst({
      where: { id: req.body.trainerId, role: 'trainer' },
    });
    if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
    const scheduled = new Date(req.body.scheduledAt);
    if (Number.isNaN(scheduled.getTime()) || scheduled < new Date()) {
      return res.status(400).json({ error: 'scheduledAt must be a future datetime' });
    }
    const booking = await prisma.trainerBooking.create({
      data: {
        athleteId: req.user.id,
        trainerId: trainer.id,
        scheduledAt: scheduled,
        notes: req.body.notes ?? null,
      },
      include: {
        trainer: { select: TRAINER_SELECT },
        athlete: { select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });

    emitNotification({
      userId: trainer.id,
      type: 'booking.new',
      title: 'New booking request',
      message: `An athlete requested a session on ${scheduled.toLocaleString()}.`,
      link: '/clients',
    });

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

router.get('/bookings/me', async (req, res, next) => {
  try {
    const bookings = await prisma.trainerBooking.findMany({
      where: { athleteId: req.user.id },
      include: { trainer: { select: TRAINER_SELECT } },
      orderBy: { scheduledAt: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

router.get('/bookings/trainer', requireRole('trainer'), async (req, res, next) => {
  try {
    const bookings = await prisma.trainerBooking.findMany({
      where: { trainerId: req.user.id },
      include: {
        athlete: {
          select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

router.get('/bookings/clients', requireRole('trainer'), async (req, res, next) => {
  try {
    const bookings = await prisma.trainerBooking.findMany({
      where: { trainerId: req.user.id, status: { in: ['confirmed', 'completed'] } },
      include: {
        athlete: {
          select: {
            id: true,
            email: true,
            profile: {
              select: { displayName: true, avatarUrl: true, fitnessGoal: true, fitnessLevel: true, weight: true, height: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });
    const map = new Map();
    for (const b of bookings) {
      if (!map.has(b.athlete.id)) {
        map.set(b.athlete.id, {
          ...b.athlete,
          lastSessionAt: b.scheduledAt,
          totalSessions: 0,
        });
      }
      map.get(b.athlete.id).totalSessions += 1;
    }
    res.json(Array.from(map.values()));
  } catch (err) {
    next(err);
  }
});

router.patch('/bookings/:id', validate(updateBookingSchema), async (req, res, next) => {
  try {
    const booking = await prisma.trainerBooking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const isTrainer = booking.trainerId === req.user.id;
    const isAthlete = booking.athleteId === req.user.id;
    if (!isTrainer && !isAthlete) return res.status(403).json({ error: 'Forbidden' });

    const next_ = req.body.status;
    if (next_ === 'confirmed' && !isTrainer) {
      return res.status(403).json({ error: 'Only the trainer can confirm a booking' });
    }
    if (next_ === 'completed' && !isTrainer) {
      return res.status(403).json({ error: 'Only the trainer can mark a booking complete' });
    }
    const updated = await prisma.trainerBooking.update({
      where: { id: booking.id },
      data: { status: next_ },
      include: {
        trainer: { select: TRAINER_SELECT },
        athlete: { select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });

    const recipientId = isTrainer ? booking.athleteId : booking.trainerId;
    emitNotification({
      userId: recipientId,
      type: 'booking.update',
      title: `Booking ${next_}`,
      message: `Your training session is now ${next_}.`,
      link: isTrainer ? '/profile' : '/trainers',
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
