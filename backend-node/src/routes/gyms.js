/**
 * Gym routes — discovery, membership, check-ins, and gym-owner CRUD.
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');
const { getOpenVisit, extractMemberAddress } = require('../lib/gymAccess');
const { resolveMembershipPlanFields, formatPlanRow } = require('../lib/gymSubscription');
const { parsePlanBenefitsInput, planBenefitsBodySchema } = require('../lib/planBenefits');
const { normalizeWorkingHours } = require('../lib/gymStaffPayroll');
const { attachProfile, USER_PUBLIC_SELECT } = require('../lib/profile');
const { moderateTextFast, ModerationError } = require('../lib/moderation');
const {
  getGymReviewSummary,
  scheduleGymReviewAnalysisRefresh,
} = require('../lib/gymReviewAnalysis');
const {
  listCatalogBasicSessions,
  listCatalogClasses,
  selfBookBasicSession,
  selfBookClassSession,
} = require('../lib/gymCatalog');

const workingHourSlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const gymReceptionRoutes = require('./gymReception');
const gymEquipmentRoutes = require('./gymEquipment');
const gymStaffRoutes = require('./gymStaff');
const gymClassRoutes = require('./gymClasses');
const gymBasicSessionRoutes = require('./gymBasicSessions');

const router = express.Router();
router.use(authMiddleware);

const gymCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    location: z.string().min(2).max(200),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    bio: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    galleryUrls: z.array(z.string().url()).max(12).optional(),
    videoUrl: z.string().url().nullable().optional(),
    workingHours: z.array(workingHourSlotSchema).max(14).optional(),
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
    planId: z.string().uuid().optional(),
    paidAmount: z.number().nonnegative().optional(),
    paymentMethod: z.enum(['cash', 'card', 'transfer', 'online']).optional(),
  }),
});

const planCreateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(80),
    nameAr: z.string().max(80).optional(),
    durationDays: z.number().int().positive().max(3650),
    price: z.number().positive().max(1_000_000),
    currency: z.string().length(3).optional(),
    description: z.string().max(500).optional(),
    benefits: planBenefitsBodySchema.nullable().optional(),
    sortOrder: z.number().int().min(0).max(100).optional(),
  }),
});

const planUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid(), planId: z.string().uuid() }),
  body: planCreateSchema.shape.body.partial().extend({
    isActive: z.boolean().optional(),
  }),
});

const planIdParam = z.object({
  params: z.object({ id: z.string().uuid(), planId: z.string().uuid() }),
});

const createReviewSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    body: z.string().min(1).max(2000),
  }),
});

const catalogSessionIdParam = z.object({
  params: z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }),
});

const catalogClassIdParam = z.object({
  params: z.object({ id: z.string().uuid(), classId: z.string().uuid() }),
});

const selfBookSchema = z.object({
  body: z.object({
    paymentMethod: z.enum(['cash', 'card', 'transfer', 'online']).default('online'),
  }),
});

function reqLang(req) {
  const h = (req.headers['accept-language'] || '').toLowerCase();
  return h.startsWith('en') ? 'en' : 'ar';
}

const PUBLIC_GYM_SELECT = {
  id: true,
  name: true,
  location: true,
  latitude: true,
  longitude: true,
  bio: true,
  imageUrl: true,
  galleryUrls: true,
  videoUrl: true,
  workingHours: true,
  phone: true,
  maxCapacity: true,
  amenities: true,
  isActive: true,
  ownerId: true,
  createdAt: true,
  owner: { select: USER_PUBLIC_SELECT },
  _count: { select: { memberships: true } },
};

function mapGymRow(gym) {
  if (!gym) return gym;
  return {
    ...gym,
    galleryUrls: Array.isArray(gym.galleryUrls) ? gym.galleryUrls : [],
    workingHours: normalizeWorkingHours(gym.workingHours),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const gyms = await prisma.gym.findMany({
      where: { isActive: true },
      select: PUBLIC_GYM_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    const gymIds = gyms.map((g) => g.id);
    const openCounts =
      gymIds.length === 0
        ? []
        : await prisma.gymCheckIn.groupBy({
            by: ['gymId'],
            where: { gymId: { in: gymIds }, checkedOutAt: null },
            _count: { _all: true },
          });
    const presentByGym = new Map(openCounts.map((row) => [row.gymId, row._count._all]));

    res.json(
      gyms.map((g) => ({
        ...mapGymRow(g),
        currentOccupancy: presentByGym.get(g.id) ?? 0,
        owner: g.owner ? attachProfile(g.owner) : null,
      })),
    );
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
    res.status(201).json(mapGymRow(gym));
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
    const presentNow = await prisma.gymCheckIn.count({
      where: { gymId: gym.id, checkedOutAt: null },
    });
    res.json({ ...mapGymRow(gym), currentOccupancy: presentNow });
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
    const data = { ...req.body };
    if (data.workingHours !== undefined) {
      data.workingHours = normalizeWorkingHours(data.workingHours);
    }
    if (data.galleryUrls !== undefined && !Array.isArray(data.galleryUrls)) {
      return res.status(400).json({ error: 'galleryUrls must be an array' });
    }
    const hasLat = data.latitude != null;
    const hasLng = data.longitude != null;
    if (hasLat !== hasLng) {
      return res.status(400).json({ error: 'Both latitude and longitude are required together' });
    }
    const gym = await prisma.gym.update({
      where: { id: req.params.id },
      data,
      select: PUBLIC_GYM_SELECT,
    });
    res.json(mapGymRow(gym));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/catalog/basic-sessions', validate(idParam), async (req, res, next) => {
  try {
    const sessions = await listCatalogBasicSessions(req.params.id);
    res.json(sessions);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/:id/catalog/classes', validate(idParam), async (req, res, next) => {
  try {
    const classes = await listCatalogClasses(req.params.id);
    res.json(classes);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post(
  '/:id/catalog/basic-sessions/:sessionId/book',
  validate(catalogSessionIdParam.merge(selfBookSchema)),
  async (req, res, next) => {
    try {
      const booking = await selfBookBasicSession(
        req.params.id,
        req.params.sessionId,
        req.user.id,
        req.body.paymentMethod,
      );
      res.status(201).json({ booking });
    } catch (err) {
      if (err?.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  },
);

router.post(
  '/:id/catalog/classes/:classId/book',
  validate(catalogClassIdParam.merge(selfBookSchema)),
  async (req, res, next) => {
    try {
      const booking = await selfBookClassSession(
        req.params.id,
        req.params.classId,
        req.user.id,
        req.body.paymentMethod,
      );
      res.status(201).json({ booking });
    } catch (err) {
      if (err?.status) {
        const body = { error: err.message };
        if (err.code) body.code = err.code;
        if (err.conflict) {
          body.conflict = {
            name: err.conflict.name,
            startTime: err.conflict.startTime,
            endTime: err.conflict.endTime,
          };
        }
        return res.status(err.status).json(body);
      }
      next(err);
    }
  },
);

router.use('/:id/reception', gymReceptionRoutes);
router.use('/:id/equipment', gymEquipmentRoutes);
router.use('/:id/staff', gymStaffRoutes);
router.use('/:id/classes', gymClassRoutes);
router.use('/:id/basic-sessions', gymBasicSessionRoutes);

async function assertOwnsGym(gymId, userId) {
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return { error: 'Gym not found', status: 404 };
  if (gym.ownerId !== userId) return { error: 'You do not own this gym', status: 403 };
  return { gym };
}

router.get('/:id/plans', validate(idParam), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });

    const plans = await prisma.gymSubscriptionPlan.findMany({
      where: { gymId: gym.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
    res.json(plans.map((p) => formatPlanRow(p)));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/plans', requireRole('gym'), validate(planCreateSchema), async (req, res, next) => {
  try {
    const owned = await assertOwnsGym(req.params.id, req.user.id);
    if (owned.error) return res.status(owned.status).json({ error: owned.error });

    const benefits = parsePlanBenefitsInput(req.body.benefits);

    const plan = await prisma.gymSubscriptionPlan.create({
      data: {
        gymId: owned.gym.id,
        name: req.body.name,
        nameAr: req.body.nameAr,
        durationDays: req.body.durationDays,
        price: req.body.price,
        currency: req.body.currency?.toUpperCase() ?? 'EGP',
        description: req.body.description,
        benefits: benefits ?? undefined,
        sortOrder: req.body.sortOrder ?? 0,
      },
    });
    res.status(201).json(formatPlanRow(plan));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/plans/:planId', requireRole('gym'), validate(planUpdateSchema), async (req, res, next) => {
  try {
    const owned = await assertOwnsGym(req.params.id, req.user.id);
    if (owned.error) return res.status(owned.status).json({ error: owned.error });

    const existing = await prisma.gymSubscriptionPlan.findFirst({
      where: { id: req.params.planId, gymId: owned.gym.id },
    });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    const data = { ...req.body };
    if (data.currency) data.currency = data.currency.toUpperCase();
    if (Object.prototype.hasOwnProperty.call(req.body, 'benefits')) {
      data.benefits = parsePlanBenefitsInput(req.body.benefits);
    }

    const plan = await prisma.gymSubscriptionPlan.update({
      where: { id: existing.id },
      data,
    });
    res.json(formatPlanRow(plan));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/plans/:planId', requireRole('gym'), validate(planIdParam), async (req, res, next) => {
  try {
    const owned = await assertOwnsGym(req.params.id, req.user.id);
    if (owned.error) return res.status(owned.status).json({ error: owned.error });

    const existing = await prisma.gymSubscriptionPlan.findFirst({
      where: { id: req.params.planId, gymId: owned.gym.id },
    });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    const plan = await prisma.gymSubscriptionPlan.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    res.json(formatPlanRow(plan));
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

    const existing = await getOpenVisit(gym.id, req.user.id);
    if (existing) {
      return res.status(409).json({
        error: 'You are already checked in',
        visitId: existing.id,
        checkedInAt: existing.checkedInAt,
      });
    }

    const checkIn = await prisma.gymCheckIn.create({
      data: { gymId: gym.id, userId: req.user.id },
      include: { gym: { select: { id: true, name: true } } },
    });

    emitNotification({
      userId: gym.ownerId,
      type: 'gym.checkin',
      link: `/owner/reception`,
      payload: { gymName: gym.name, forOwner: true },
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
        plan: { select: { id: true, name: true, nameAr: true, price: true, durationDays: true } },
        user: { select: USER_PUBLIC_SELECT },
      },
      orderBy: { joinedAt: 'desc' },
    });
    res.json(
      members.map((m) => ({
        ...m,
        address: extractMemberAddress(m.user?.profile),
        user: m.user ? attachProfile(m.user) : null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reviews', validate(createReviewSchema), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym || !gym.isActive) return res.status(404).json({ error: 'Gym not found' });

    const lang = reqLang(req);
    const body = req.body.body.trim();
    const { rating } = req.body;

    try {
      await moderateTextFast(body, lang);
    } catch (err) {
      if (err instanceof ModerationError) {
        return res.status(422).json({
          error: err.messageFor(lang),
          code: 'content_moderated',
          category: err.category,
        });
      }
      throw err;
    }

    const review = await prisma.gymReview.upsert({
      where: {
        gymId_userId: { gymId: gym.id, userId: req.user.id },
      },
      create: {
        gymId: gym.id,
        userId: req.user.id,
        rating,
        body,
      },
      update: {
        rating,
        body,
      },
    });

    scheduleGymReviewAnalysisRefresh(gym.id);

    res.status(201).json({
      id: review.id,
      rating: review.rating,
      body: review.body,
      helpfulCount: review.helpfulCount,
      createdAt: review.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/reviews/summary', validate(idParam), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym || !gym.isActive) return res.status(404).json({ error: 'Gym not found' });

    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const summary = await getGymReviewSummary(gym.id, { refresh });
    if (!summary) return res.status(404).json({ error: 'Gym not found' });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/reviews', validate(idParam), async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym || !gym.isActive) return res.status(404).json({ error: 'Gym not found' });

    const reviews = await prisma.gymReview.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        body: true,
        helpfulCount: true,
        createdAt: true,
      },
    });

    res.json(
      reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        helpfulCount: review.helpfulCount,
        createdAt: review.createdAt.toISOString(),
      })),
    );
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

    const planFields = await resolveMembershipPlanFields(gym.id, req.body);

    const membership = await prisma.gymMembership.upsert({
      where: { gymId_userId: { gymId: gym.id, userId: user.id } },
      create: {
        gymId: gym.id,
        userId: user.id,
        isActive: true,
        accountCreatedAtDesk: false,
        ...planFields,
      },
      update: {
        isActive: true,
        ...planFields,
      },
      include: {
        plan: { select: { id: true, name: true, nameAr: true, price: true, durationDays: true } },
        user: { select: USER_PUBLIC_SELECT },
      },
    });

    emitNotification({
      userId: user.id,
      type: 'gym.membership',
      link: `/gyms`,
      payload: { gymName: gym.name },
    });

    res.status(201).json(membership);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
