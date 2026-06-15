/**
 * Reception desk — present roster, search, check-in/out (Taqwin members only).
 */
const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { emitNotification } = require('../lib/notifications');
const {
  assertGymOwner,
  normalizeGender,
  membershipStatus,
  getActiveMembership,
  getOpenVisit,
  getOpenVisitsForUsers,
  MEMBER_USER_SELECT,
  MEMBERSHIP_PLAN_SELECT,
  formatMemberRow,
  removeGymMemberData,
} = require('../lib/gymAccess');
const { resolveMembershipPlanFields } = require('../lib/gymSubscription');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);
router.use(requireRole('gym'));

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const userIdBody = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ userId: z.string().uuid() }),
});

const searchQuery = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ q: z.string().max(120).optional() }),
});

const memberParam = z.object({
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
});

const updateMembershipSchema = z.object({
  params: z.object({ id: z.string().uuid(), userId: z.string().uuid() }),
  body: z.object({
    planId: z.string().uuid().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    paidAmount: z.number().nonnegative().optional(),
    paymentMethod: z.enum(['cash', 'card', 'transfer', 'online']).optional(),
    isActive: z.boolean().optional(),
  }),
});

const { normalizePhoneE164 } = require('../lib/phoneNormalize');

const registerMemberSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    gender: z.enum(['male', 'female']).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    planId: z.string().uuid().optional().nullable(),
    paidAmount: z.number().nonnegative().optional().nullable(),
    paymentMethod: z.enum(['cash', 'card', 'transfer', 'online']).optional().nullable(),
    avatarUrl: z.string().trim().max(2000).optional().nullable(),
  }),
});

function buildOnboardingData(existing, address) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  if (address?.trim()) {
    base.address = address.trim();
  }
  return Object.keys(base).length ? base : undefined;
}

function buildDisplayName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function formatVisitRow(visit, now = new Date()) {
  const checkedIn = new Date(visit.checkedInAt);
  const checkedOut = visit.checkedOutAt ? new Date(visit.checkedOutAt) : null;
  const end = checkedOut ?? now;
  const durationMinutes = Math.max(0, Math.floor((end.getTime() - checkedIn.getTime()) / 60000));
  return {
    visitId: visit.id,
    checkedInAt: visit.checkedInAt,
    checkedOutAt: visit.checkedOutAt,
    isOpen: !visit.checkedOutAt,
    durationMinutes,
  };
}

async function upsertGymMember(gymId, userId, input = {}) {
  const planFields = await resolveMembershipPlanFields(gymId, input);
  return prisma.gymMembership.upsert({
    where: { gymId_userId: { gymId, userId } },
    create: {
      gymId,
      userId,
      isActive: true,
      ...planFields,
    },
    update: {
      isActive: true,
      ...planFields,
    },
    include: {
      user: { select: MEMBER_USER_SELECT },
      plan: { select: MEMBERSHIP_PLAN_SELECT },
    },
  });
}

async function loadMembershipWithUser(gymId, userId) {
  return prisma.gymMembership.findUnique({
    where: { gymId_userId: { gymId, userId } },
    include: {
      user: { select: MEMBER_USER_SELECT },
      plan: { select: MEMBERSHIP_PLAN_SELECT },
    },
  });
}

router.get('/present', validate(idParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;

    const openVisits = await prisma.gymCheckIn.findMany({
      where: { gymId, checkedOutAt: null },
      include: {
        user: { select: MEMBER_USER_SELECT },
      },
      orderBy: { checkedInAt: 'desc' },
    });

    const counts = { total: openVisits.length, male: 0, female: 0, unknown: 0 };
    const members = openVisits.map((v) => {
      const gender = normalizeGender(v.user?.profile?.gender);
      counts[gender] += 1;
      return {
        visitId: v.id,
        userId: v.userId,
        checkedInAt: v.checkedInAt,
        gender,
        user: v.user,
      };
    });

    res.json({ counts, members });
  } catch (err) {
    next(err);
  }
});

router.get('/search', validate(searchQuery), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;
    const q = (req.query.q || '').trim().toLowerCase();
    if (q.length < 2) {
      return res.json({ members: [] });
    }

    const memberships = await prisma.gymMembership.findMany({
      where: {
        gymId,
        OR: [
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { phone: { contains: q } } },
          { user: { profile: { displayName: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      include: {
        user: { select: MEMBER_USER_SELECT },
        plan: { select: MEMBERSHIP_PLAN_SELECT },
      },
      take: 20,
      orderBy: { joinedAt: 'desc' },
    });

    const now = new Date();
    const userIds = memberships.map((m) => m.userId);
    const openByUser = await getOpenVisitsForUsers(gymId, userIds);
    const members = memberships.map((m) =>
      formatMemberRow({ ...m, user: m.user }, openByUser.get(m.userId), now),
    );

    res.json({ members });
  } catch (err) {
    next(err);
  }
});

router.get('/members', validate(idParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;

    const memberships = await prisma.gymMembership.findMany({
      where: { gymId },
      include: {
        user: { select: MEMBER_USER_SELECT },
        plan: { select: MEMBERSHIP_PLAN_SELECT },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const now = new Date();
    const userIds = memberships.map((m) => m.userId);
    const openByUser = await getOpenVisitsForUsers(gymId, userIds);
    const members = memberships.map((m) =>
      formatMemberRow({ ...m, user: m.user }, openByUser.get(m.userId), now),
    );

    res.json({ members });
  } catch (err) {
    next(err);
  }
});

function formatClassBookingRow(row) {
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
          sessionDate: row.class.sessionDate,
        }
      : null,
  };
}

router.get('/users/:userId/class-bookings', validate(memberParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rows = await prisma.gymClassBooking.findMany({
      where: {
        gymId,
        userId,
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
      orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ bookings: rows.map(formatClassBookingRow) });
  } catch (err) {
    next(err);
  }
});

router.get('/members/:userId/visits', validate(memberParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;
    const membership = await loadMembershipWithUser(gymId, req.params.userId);
    if (!membership) {
      return res.status(404).json({ error: 'Member not found at this gym' });
    }

    const visits = await prisma.gymCheckIn.findMany({
      where: { gymId, userId: req.params.userId },
      orderBy: { checkedInAt: 'desc' },
      take: 50,
    });

    const now = new Date();
    const formatted = visits.map((v) => formatVisitRow(v, now));
    const totalMinutes = formatted.reduce((sum, v) => sum + v.durationMinutes, 0);

    res.json({
      visits: formatted,
      stats: {
        totalVisits: formatted.length,
        totalMinutes,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/members/:userId', validate(memberParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;
    const membership = await loadMembershipWithUser(gymId, req.params.userId);
    if (!membership) {
      return res.status(404).json({ error: 'Member not found at this gym' });
    }
    const openVisit = await getOpenVisit(gymId, membership.userId);
    res.json(formatMemberRow(membership, openVisit));
  } catch (err) {
    next(err);
  }
});

router.patch('/members/:userId/membership', validate(updateMembershipSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;
    const { userId } = req.params;

    const existing = await loadMembershipWithUser(gymId, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Member not found at this gym' });
    }

    const planFields = req.body.planId
      ? await resolveMembershipPlanFields(gymId, req.body)
      : await resolveMembershipPlanFields(gymId, {
          expiresAt: req.body.expiresAt,
          paidAmount: req.body.paidAmount,
          paymentMethod: req.body.paymentMethod,
        });

    const membership = await prisma.gymMembership.update({
      where: { id: existing.id },
      data: {
        isActive: req.body.isActive ?? true,
        ...planFields,
      },
      include: {
        user: { select: MEMBER_USER_SELECT },
        plan: { select: MEMBERSHIP_PLAN_SELECT },
      },
    });

    const openVisit = await getOpenVisit(gymId, userId);
    res.json(formatMemberRow(membership, openVisit));
  } catch (err) {
    next(err);
  }
});

router.delete('/members/:userId', validate(memberParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;
    const { userId } = req.params;

    const membership = await loadMembershipWithUser(gymId, userId);
    if (!membership) {
      return res.status(404).json({ error: 'Member not found at this gym' });
    }

    const removed = await prisma.$transaction((tx) => removeGymMemberData(tx, gymId, userId));

    res.json({ ok: true, userId, removed });
  } catch (err) {
    next(err);
  }
});

router.post('/check-in', validate(userIdBody), async (req, res, next) => {
  try {
    const gym = await assertGymOwner(req.params.id, req.user.id);
    const gymId = gym.id;
    const { userId } = req.body;

    const membership = await getActiveMembership(gymId, userId);
    if (!membership) {
      return res.status(404).json({ error: 'Member not found at this gym' });
    }
    const status = membershipStatus(membership);
    if (status !== 'active') {
      return res.status(403).json({
        error: status === 'expired' ? 'Membership has expired' : 'Membership is inactive',
        membershipStatus: status,
      });
    }

    const existing = await getOpenVisit(gymId, userId);
    if (existing) {
      return res.status(409).json({
        error: 'Member is already checked in',
        visitId: existing.id,
        checkedInAt: existing.checkedInAt,
      });
    }

    const visit = await prisma.gymCheckIn.create({
      data: {
        gymId,
        userId,
        registeredById: req.user.id,
      },
      include: { user: { select: MEMBER_USER_SELECT } },
    });

    emitNotification({
      userId,
      type: 'gym.checkin',
      title: 'Checked in',
      message: `You checked in at ${gym.name}.`,
      link: '/gyms',
    });

    res.status(201).json({
      visitId: visit.id,
      checkedInAt: visit.checkedInAt,
      user: visit.user,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/check-out', validate(userIdBody), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const gymId = req.params.id;
    const { userId } = req.body;

    const openVisit = await getOpenVisit(gymId, userId);
    if (!openVisit) {
      return res.status(404).json({ error: 'No active check-in found for this member' });
    }

    const updated = await prisma.gymCheckIn.update({
      where: { id: openVisit.id },
      data: { checkedOutAt: new Date() },
    });

    res.json({
      visitId: updated.id,
      checkedInAt: updated.checkedInAt,
      checkedOutAt: updated.checkedOutAt,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/register', validate(registerMemberSchema), async (req, res, next) => {
  try {
    const gym = await assertGymOwner(req.params.id, req.user.id);
    const gymId = gym.id;
    const {
      firstName,
      lastName,
      email,
      phone: rawPhone,
      address: rawAddress,
      gender,
      expiresAt,
      planId,
      paidAmount,
      paymentMethod,
      avatarUrl,
    } = req.body;

    const emailLower = email.trim().toLowerCase();
    const address = rawAddress?.trim() || null;
    let phone = null;
    if (rawPhone?.trim()) {
      phone = normalizePhoneE164(rawPhone);
      if (!phone) {
        return res.status(400).json({
          error: 'Enter a valid Egyptian mobile number (e.g. 01012345678)',
        });
      }
    }
    const displayName = buildDisplayName(firstName, lastName);

    if (phone) {
      const phoneTaken = await prisma.user.findFirst({
        where: { phone, NOT: { email: emailLower } },
        select: { id: true },
      });
      if (phoneTaken) {
        return res.status(409).json({ error: 'Phone number is already used by another account' });
      }
    }

    let user = await prisma.user.findUnique({ where: { email: emailLower } });
    let accountCreated = false;

    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(18).toString('base64url'), 10);
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: emailLower,
            passwordHash,
            role: 'athlete',
            phone,
            emailVerifiedAt: new Date(),
          },
        });
        await tx.profile.create({
          data: {
            userId: created.id,
            displayName,
            gender: gender || null,
            avatarUrl: avatarUrl || null,
            onboardingData: address ? { address } : undefined,
          },
        });
        await tx.userSettings.create({ data: { userId: created.id } });
        return created;
      });
      accountCreated = true;
    } else {
      const existingProfile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { onboardingData: true },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: phone ? { phone } : {},
      });
      await prisma.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          displayName,
          gender: gender || null,
          avatarUrl: avatarUrl || null,
          onboardingData: address ? { address } : undefined,
        },
        update: {
          displayName,
          ...(gender ? { gender } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
          ...(address ? { onboardingData: buildOnboardingData(existingProfile?.onboardingData, address) } : {}),
        },
      });
    }

    const membership = await upsertGymMember(gymId, user.id, {
      expiresAt,
      planId: planId ?? undefined,
      paidAmount: paidAmount ?? undefined,
      paymentMethod: paymentMethod ?? undefined,
    });
    const openVisit = await getOpenVisit(gymId, user.id);

    if (accountCreated) {
      emitNotification({
        userId: user.id,
        type: 'gym.membership',
        title: `Welcome to ${gym.name}`,
        message: `You were registered at ${gym.name}. Use "Forgot password" with your email to set a login password.`,
        link: '/auth',
      });
    } else {
      emitNotification({
        userId: user.id,
        type: 'gym.membership',
        title: `You joined ${gym.name}`,
        message: `Your membership at ${gym.name} is now active.`,
        link: '/gyms',
      });
    }

    res.status(accountCreated ? 201 : 200).json({
      accountCreated,
      member: formatMemberRow(membership, openVisit),
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Email or phone is already registered' });
    }
    next(err);
  }
});

module.exports = router;
