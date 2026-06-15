/**
 * Gym equipment inventory — CRUD + maintenance/cleaning status (owner only).
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { assertGymOwner } = require('../lib/gymAccess');
const { completeMaintenanceUpdate } = require('../lib/gymEquipment');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);
router.use(requireRole('gym'));

const gymIdParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const equipmentIdParam = z.object({
  params: z.object({ id: z.string().uuid(), equipmentId: z.string().uuid() }),
});

const createSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(120),
    nameAr: z.string().max(120).optional(),
    imageUrl: z.string().url().optional().nullable(),
    nextMaintenanceAt: z.string().datetime().optional().nullable(),
    maintenanceIntervalDays: z.number().int().positive().max(3650).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid(), equipmentId: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    nameAr: z.string().max(120).optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
    nextMaintenanceAt: z.string().datetime().optional().nullable(),
    maintenanceIntervalDays: z.number().int().positive().max(3650).optional(),
  }),
});

async function getOwnedEquipment(gymId, equipmentId, userId) {
  await assertGymOwner(gymId, userId);
  const equipment = await prisma.gymEquipment.findFirst({
    where: { id: equipmentId, gymId },
  });
  if (!equipment) {
    const err = new Error('Equipment not found');
    err.status = 404;
    throw err;
  }
  return equipment;
}

router.get('/', validate(gymIdParam), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const items = await prisma.gymEquipment.findMany({
      where: { gymId: req.params.id },
      orderBy: [{ needsMaintenance: 'desc' }, { needsCleaning: 'desc' }, { name: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    await assertGymOwner(req.params.id, req.user.id);
    const { name, nameAr, imageUrl, nextMaintenanceAt, maintenanceIntervalDays } = req.body;
    const item = await prisma.gymEquipment.create({
      data: {
        gymId: req.params.id,
        name,
        nameAr: nameAr ?? null,
        imageUrl: imageUrl ?? null,
        nextMaintenanceAt: nextMaintenanceAt ? new Date(nextMaintenanceAt) : null,
        maintenanceIntervalDays: maintenanceIntervalDays ?? 90,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.patch('/:equipmentId', validate(updateSchema), async (req, res, next) => {
  try {
    await getOwnedEquipment(req.params.id, req.params.equipmentId, req.user.id);
    const { name, nameAr, imageUrl, nextMaintenanceAt, maintenanceIntervalDays } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (nameAr !== undefined) data.nameAr = nameAr;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (maintenanceIntervalDays !== undefined) data.maintenanceIntervalDays = maintenanceIntervalDays;
    if (nextMaintenanceAt !== undefined) {
      data.nextMaintenanceAt = nextMaintenanceAt ? new Date(nextMaintenanceAt) : null;
    }
    const item = await prisma.gymEquipment.update({
      where: { id: req.params.equipmentId },
      data,
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete('/:equipmentId', validate(equipmentIdParam), async (req, res, next) => {
  try {
    await getOwnedEquipment(req.params.id, req.params.equipmentId, req.user.id);
    await prisma.gymEquipment.delete({ where: { id: req.params.equipmentId } });
    res.json({ ok: true, id: req.params.equipmentId });
  } catch (err) {
    next(err);
  }
});

router.post('/:equipmentId/mark-maintenance', validate(equipmentIdParam), async (req, res, next) => {
  try {
    await getOwnedEquipment(req.params.id, req.params.equipmentId, req.user.id);
    const item = await prisma.gymEquipment.update({
      where: { id: req.params.equipmentId },
      data: { needsMaintenance: true },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.post('/:equipmentId/complete-maintenance', validate(equipmentIdParam), async (req, res, next) => {
  try {
    const equipment = await getOwnedEquipment(req.params.id, req.params.equipmentId, req.user.id);
    const item = await prisma.gymEquipment.update({
      where: { id: equipment.id },
      data: completeMaintenanceUpdate(equipment),
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.post('/:equipmentId/mark-cleaning', validate(equipmentIdParam), async (req, res, next) => {
  try {
    await getOwnedEquipment(req.params.id, req.params.equipmentId, req.user.id);
    const item = await prisma.gymEquipment.update({
      where: { id: req.params.equipmentId },
      data: { needsCleaning: true },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.post('/:equipmentId/complete-cleaning', validate(equipmentIdParam), async (req, res, next) => {
  try {
    await getOwnedEquipment(req.params.id, req.params.equipmentId, req.user.id);
    const item = await prisma.gymEquipment.update({
      where: { id: req.params.equipmentId },
      data: {
        needsCleaning: false,
        lastCleanedAt: new Date(),
      },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
