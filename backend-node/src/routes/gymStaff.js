/**
 * Gym staff management — CRUD, payroll, working hours (owner only).
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertGymOwner } = require('../lib/gymAccess');
const {
  normalizeWorkingHours,
  summarizeWorkingHours,
  initiatePayout,
  confirmMockPayout,
  buildPayrollCsv,
} = require('../lib/gymStaffPayroll');
const { normalizeStaffEmail } = require('../lib/gymStaffUtils');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);
router.use(requireRole('gym'));

const gymIdParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const staffIdParam = z.object({
  params: z.object({ id: z.string().uuid(), staffId: z.string().uuid() }),
});

const payoutIdParam = z.object({
  params: z.object({
    id: z.string().uuid(),
    staffId: z.string().uuid(),
    payoutId: z.string().uuid(),
  }),
});

const workingHourSlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const createSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    fullName: z.string().min(1).max(120),
    email: z.string().email().max(200).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    role: z.enum(['trainer', 'receptionist', 'cleaner', 'other']).optional(),
    baseSalary: z.number().nonnegative().max(10_000_000).optional(),
    workingHours: z.array(workingHourSlotSchema).optional(),
    hiredAt: z.string().datetime().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid(), staffId: z.string().uuid() }),
  body: z.object({
    fullName: z.string().min(1).max(120).optional(),
    email: z.string().email().max(200).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    role: z.enum(['trainer', 'receptionist', 'cleaner', 'other']).optional(),
    baseSalary: z.number().nonnegative().max(10_000_000).optional(),
    workingHours: z.array(workingHourSlotSchema).optional(),
    hiredAt: z.string().datetime().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

const paySchema = z.object({
  params: z.object({ id: z.string().uuid(), staffId: z.string().uuid() }),
  body: z.object({
    type: z.enum(['salary', 'bonus']),
    provider: z.enum(['mock', 'paymob', 'manual', 'cash']).optional(),
    bonusAmount: z.number().nonnegative().max(10_000_000).optional(),
    bonusOnlyAmount: z.number().positive().max(10_000_000).optional(),
    periodMonth: z.number().int().min(1).max(12).optional(),
    periodYear: z.number().int().min(2000).max(2100).optional(),
    notes: z.string().max(500).optional().nullable(),
  }),
});

const exportQuerySchema = {
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
};

function formatStaffRow(staff, lastPayout) {
  return {
    ...staff,
    workingHoursSummary: summarizeWorkingHours(staff.workingHours),
    lastPayout: lastPayout
      ? {
          id: lastPayout.id,
          type: lastPayout.type,
          totalAmount: lastPayout.totalAmount,
          status: lastPayout.status,
          paidAt: lastPayout.paidAt,
          createdAt: lastPayout.createdAt,
        }
      : null,
  };
}

async function getOwnedStaff(gymId, staffId, userId) {
  await assertGymOwner(gymId, userId);
  const staff = await prisma.gymStaff.findFirst({
    where: { id: staffId, gymId },
  });
  if (!staff) {
    const err = new Error('Staff member not found');
    err.status = 404;
    throw err;
  }
  return staff;
}

router.get('/payroll/export', validate(exportQuerySchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();

    const payouts = await prisma.gymStaffPayout.findMany({
      where: { gymId: req.params.id, periodMonth: month, periodYear: year },
      include: { staff: { select: { fullName: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const csv = buildPayrollCsv(
      payouts.map((p) => ({
        staffName: p.staff.fullName,
        email: p.staff.email,
        role: p.staff.role,
        type: p.type,
        baseAmount: p.baseAmount,
        bonusAmount: p.bonusAmount,
        totalAmount: p.totalAmount,
        periodMonth: p.periodMonth,
        periodYear: p.periodYear,
        status: p.status,
        provider: p.provider,
        paidAt: p.paidAt,
        notes: p.notes,
      })),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${year}-${String(month).padStart(2, '0')}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(gymIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const roleFilter = req.query.role;
    const where = { gymId: req.params.id, isActive: true };
    if (roleFilter && ['trainer', 'receptionist', 'cleaner', 'other'].includes(String(roleFilter))) {
      where.role = roleFilter;
    }

    const staffList = await prisma.gymStaff.findMany({
      where,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    const staffIds = staffList.map((s) => s.id);
    let lastPayouts = [];
    if (staffIds.length > 0) {
      const grouped = await prisma.gymStaffPayout.groupBy({
        by: ['staffId'],
        _max: { createdAt: true },
        where: { staffId: { in: staffIds } },
      });
      if (grouped.length > 0) {
        lastPayouts = await prisma.gymStaffPayout.findMany({
          where: {
            OR: grouped.map((g) => ({
              staffId: g.staffId,
              createdAt: g._max.createdAt,
            })),
          },
        });
      }
    }

    const lastByStaff = new Map();
    for (const p of lastPayouts) {
      if (!lastByStaff.has(p.staffId)) lastByStaff.set(p.staffId, p);
    }

    res.json(staffList.map((s) => formatStaffRow(s, lastByStaff.get(s.id))));
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const { fullName, email, phone, role, baseSalary, workingHours, hiredAt, notes } = req.body;
    const staff = await prisma.gymStaff.create({
      data: {
        gymId: req.params.id,
        fullName,
        email: normalizeStaffEmail(email),
        phone: phone ?? null,
        role: role ?? 'other',
        baseSalary: baseSalary ?? 0,
        workingHours: normalizeWorkingHours(workingHours ?? []),
        hiredAt: hiredAt ? new Date(hiredAt) : new Date(),
        notes: notes ?? null,
      },
    });
    res.status(201).json(formatStaffRow(staff, null));
  } catch (err) {
    next(err);
  }
});

router.patch('/:staffId', validate(updateSchema), async (req, res, next) => {
  try {
    await getOwnedStaff(req.params.id, req.params.staffId, req.user.id);
    const { fullName, email, phone, role, baseSalary, workingHours, hiredAt, notes, isActive } = req.body;
    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = normalizeStaffEmail(email);
    if (phone !== undefined) data.phone = phone;
    if (role !== undefined) data.role = role;
    if (baseSalary !== undefined) data.baseSalary = baseSalary;
    if (workingHours !== undefined) data.workingHours = normalizeWorkingHours(workingHours);
    if (hiredAt !== undefined) data.hiredAt = hiredAt ? new Date(hiredAt) : null;
    if (notes !== undefined) data.notes = notes;
    if (isActive !== undefined) data.isActive = isActive;

    const staff = await prisma.gymStaff.update({
      where: { id: req.params.staffId },
      data,
    });

    const lastPayout = await prisma.gymStaffPayout.findFirst({
      where: { staffId: staff.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(formatStaffRow(staff, lastPayout));
  } catch (err) {
    next(err);
  }
});

router.delete('/:staffId', validate(staffIdParam), async (req, res, next) => {
  try {
    await getOwnedStaff(req.params.id, req.params.staffId, req.user.id);
    const staff = await prisma.gymStaff.update({
      where: { id: req.params.staffId },
      data: { isActive: false },
    });
    res.json({ ok: true, id: staff.id });
  } catch (err) {
    next(err);
  }
});

router.get('/:staffId/payouts', validate(staffIdParam), async (req, res, next) => {
  try {
    await getOwnedStaff(req.params.id, req.params.staffId, req.user.id);
    const payouts = await prisma.gymStaffPayout.findMany({
      where: { staffId: req.params.staffId, gymId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ payouts });
  } catch (err) {
    next(err);
  }
});

router.post('/:staffId/pay', validate(paySchema), async (req, res, next) => {
  try {
    const staff = await getOwnedStaff(req.params.id, req.params.staffId, req.user.id);
    const { type, provider, bonusAmount, bonusOnlyAmount, periodMonth, periodYear, notes } = req.body;

    if (type === 'bonus' && !bonusOnlyAmount) {
      const err = new Error('bonusOnlyAmount is required for bonus payouts');
      err.status = 400;
      throw err;
    }

    const result = await initiatePayout({
      staff,
      gymId: req.params.id,
      type,
      provider,
      bonusAmount,
      bonusOnlyAmount,
      periodMonth,
      periodYear,
      notes,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:staffId/pay/:payoutId/confirm', validate(payoutIdParam), async (req, res, next) => {
  try {
    await getOwnedStaff(req.params.id, req.params.staffId, req.user.id);
    const payout = await confirmMockPayout(req.params.payoutId, req.params.staffId, req.params.id);
    res.json({ payout });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
