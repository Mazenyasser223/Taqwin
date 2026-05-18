/**
 * Gym routes — discovery, membership, check-ins, and gym-owner CRUD.
 *
 * Public to all authenticated users:
 *   GET    /api/gyms
 *   GET    /api/gyms/:id
 *   POST   /api/gyms/:id/check-in
 *   GET    /api/gyms/memberships/me
 *   GET    /api/gyms/check-ins/me
 *
 * Gym-owner only:
 *   POST   /api/gyms                      (create)
 *   PATCH  /api/gyms/:id                  (update own gym)
 *   GET    /api/gyms/:id/members          (list members)
 *   POST   /api/gyms/:id/members          (add member by email)
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');

const router = express.Router();
router.use(authMiddleware);

const gymCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    location: z.string().min(2).max(200),
    bio: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    phone: z.string().max(40).optional(),
    maxCapacity: z.number().int().positive().max(10000).optional(),
    amenities: z.string().max(2000).optional(),
  }),
});

const gymUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: gymCreateSchema.shape.body.partial().extend({
    isActive: z.boolean().optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const addMemberSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    email: z.string().email(),
    expiresAt: z.string().datetime().optional(),
  }),
});

const PUBLIC_GYM_SELECT = {
  id: true,
  name: true,
  location: true,
  bio: true,
  imageUrl: true,
  phone: true,
  maxCapacity: true,
  amenities: true,
  isActive: true,
  ownerId: true,
  createdAt: true,
  owner: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
  _count: { select: { memberships: true } },
};

router.get('/', async (req, res, next) => {
  try {
    const gyms = await prisma.gym.findMany({
      where: { isActive: true },
      select: PUBLIC_GYM_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    res.json(gyms);
  } catch (err) {
    next(err);
  }
});

router.get('/memberships/me', async (req, res, next) => {
  try {
    const memberships = await prisma.gymMembership.findMany({
      where: { userId: req.user.id, isActive: true },
      include: {
        gym: { select: { id: true, name: true, location: true, imageUrl: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });
    res.json(memberships);
  } catch (err) {
    next(err);
  }
});

router.get('/check-ins/me', async (req, res, next) => {
  try {
    const checkIns = await prisma.gymCheckIn.findMany({
      where: { userId: req.user.id },
      include: { gym: { select: { id: true, name: true, location: true } } },
      orderBy: { checkedInAt: 'desc' },
      take: 50,
    });
    res.json(checkIns);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('gym'), validate(gymCreateSchema), async (req, res, next) => {
  try {
    const gym = await prisma.gym.create({
      data: { ...req.body, ownerId: req.user.id },
      select: PUBLIC_GYM_SELECT,
    });
    res.status(201).json(gym);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validate(idParam), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({
      where: { id: req.params.id },
      select: PUBLIC_GYM_SELECT,
    });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    res.json(gym);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('gym'), validate(gymUpdateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Gym not found' });
    if (existing.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this gym' });
    }
    const gym = await prisma.gym.update({
      where: { id: req.params.id },
      data: req.body,
      select: PUBLIC_GYM_SELECT,
    });
    res.json(gym);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/check-in', validate(idParam), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });

    const membership = await prisma.gymMembership.findUnique({
      where: { gymId_userId: { gymId: gym.id, userId: req.user.id } },
    });
    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: 'You are not a member of this gym' });
    }
    if (membership.expiresAt && membership.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Your membership has expired' });
    }

    const checkIn = await prisma.gymCheckIn.create({
      data: { gymId: gym.id, userId: req.user.id },
      include: { gym: { select: { id: true, name: true } } },
    });

    emitNotification({
      userId: gym.ownerId,
      type: 'gym.checkin',
      title: 'New check-in',
      message: `A member just checked in to ${gym.name}.`,
      link: `/owner/dashboard`,
    });

    res.status(201).json(checkIn);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/members', requireRole('gym'), validate(idParam), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    if (gym.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this gym' });
    }
    const members = await prisma.gymMembership.findMany({
      where: { gymId: gym.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    res.json(members);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/members', requireRole('gym'), validate(addMemberSchema), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    if (gym.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this gym' });
    }
    const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'User with that email not found' });

    const membership = await prisma.gymMembership.upsert({
      where: { gymId_userId: { gymId: gym.id, userId: user.id } },
      create: {
        gymId: gym.id,
        userId: user.id,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      },
      update: {
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    emitNotification({
      userId: user.id,
      type: 'gym.membership',
      title: `You joined ${gym.name}`,
      message: `Your membership at ${gym.name} is now active.`,
      link: `/gyms`,
    });

    res.status(201).json(membership);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
