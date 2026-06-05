/**
 * User settings — preferences, notifications, privacy.
 *
 *   GET   /api/settings  — current user's settings (auto-creates defaults)
 *   PATCH /api/settings  — partial update
 */
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getOrCreateUserSettings, toResponse } = require('../lib/userSettings');

const router = express.Router();
router.use(authMiddleware);

const patchSchema = z.object({
  body: z
    .object({
      language: z.enum(['en', 'ar']).optional(),
      theme: z.enum(['light', 'dark']).optional(),
      notifyWorkoutReminders: z.boolean().optional(),
      notifyAiSuggestions: z.boolean().optional(),
      notifyPromotional: z.boolean().optional(),
      shareWithTrainers: z.boolean().optional(),
      publicProfile: z.boolean().optional(),
      unitSystem: z.enum(['metric', 'imperial']).optional(),
      timezone: z.string().min(1).max(64).optional(),
    })
    .strict(),
});

router.get('/', async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    res.json(toResponse(settings));
  } catch (err) {
    next(err);
  }
});

router.patch('/', validate(patchSchema), async (req, res, next) => {
  try {
    await getOrCreateUserSettings(req.user.id);
    const updated = await prisma.userSettings.update({
      where: { userId: req.user.id },
      data: req.body,
    });
    res.json(toResponse(updated));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
