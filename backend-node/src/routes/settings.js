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
const { isTelegramConfigured } = require('../lib/telegram/telegramClient');
const {
  createTelegramLinkToken,
  unlinkTelegram,
  getTelegramStatus,
} = require('../lib/telegram/telegramLink');

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
      publicProfile: z.boolean().optional(),
      unitSystem: z.enum(['metric', 'imperial']).optional(),
      timezone: z.string().min(1).max(64).optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
      quietHoursEnd: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
      digestNotifications: z.boolean().optional(),
      telegramEnabled: z.boolean().optional(),
      telegramSecurityAlerts: z.boolean().optional(),
      telegramCoachAi: z.boolean().optional(),
      telegramFitnessAchievements: z.boolean().optional(),
      telegramOrders: z.boolean().optional(),
      telegramCommunityMessages: z.boolean().optional(),
      telegramSocialActivity: z.boolean().optional(),
      telegramCommunityComments: z.boolean().optional(),
      telegramDailyDigest: z.boolean().optional(),
      telegramDailyDigestHour: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
      telegramWeeklySummary: z.boolean().optional(),
      telegramMealReminders: z.boolean().optional(),
      telegramWorkoutMissed: z.boolean().optional(),
      telegramAiInsights: z.boolean().optional(),
    })
    .strict(),
});

router.get('/', async (req, res, next) => {
  try {
    const settings = await getOrCreateUserSettings(req.user.id);
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { telegramChatId: true, telegramLinkedAt: true },
    });
    res.json({
      ...toResponse(settings),
      telegramLinked: Boolean(user?.telegramChatId),
      telegramLinkedAt: user?.telegramLinkedAt || null,
    });
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

router.post('/telegram/link', async (req, res, next) => {
  try {
    if (!isTelegramConfigured()) {
      return res.status(503).json({ error: 'Telegram bot is not configured on the server' });
    }
    const link = await createTelegramLinkToken(req.user.id);
    res.json(link);
  } catch (err) {
    next(err);
  }
});

router.get('/telegram/status', async (req, res, next) => {
  try {
    const status = await getTelegramStatus(req.user.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.delete('/telegram/unlink', async (req, res, next) => {
  try {
    await unlinkTelegram(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
