/**
 * User settings — preferences, notifications, privacy.
 *
 *   GET   /api/settings  — current user's settings (auto-creates defaults)
 *   PATCH /api/settings  — partial update
 */
const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getOrCreateUserSettings,
  buildSettingsResponse,
  pickSettingsUpdate,
} = require('../lib/userSettings');
const { isTelegramConfigured } = require('../lib/telegram/telegramClient');
const {
  createTelegramLinkToken,
  unlinkTelegram,
  getTelegramStatus,
} = require('../lib/telegram/telegramLink');
const { prisma } = require('../db');

const router = express.Router();
router.use(authMiddleware);

const patchSchema = {
  body: z
    .object({
      language: z.enum(['en', 'ar']).optional(),
      theme: z.enum(['light', 'dark']).optional(),
      notifyPromotional: z.boolean().optional(),
      publicProfile: z.boolean().optional(),
      unitSystem: z.enum(['metric', 'imperial']).optional(),
      timezone: z.string().min(1).max(64).optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
      quietHoursEnd: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
      telegramEnabled: z.boolean().optional(),
      telegramSecurityAlerts: z.boolean().optional(),
      telegramCoachAi: z.boolean().optional(),
      telegramFitnessAchievements: z.boolean().optional(),
      telegramOrders: z.boolean().optional(),
      telegramCommunityMessages: z.boolean().optional(),
      telegramGroupInvites: z.boolean().optional(),
      telegramFollowRequests: z.boolean().optional(),
      telegramSocialActivity: z.boolean().optional(),
      telegramMentions: z.boolean().optional(),
      telegramCommunityComments: z.boolean().optional(),
      telegramDailyDigest: z.boolean().optional(),
      telegramDailyDigestHour: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
      telegramWeeklySummary: z.boolean().optional(),
      telegramMealReminders: z.boolean().optional(),
      telegramWorkoutMissed: z.boolean().optional(),
      telegramAiInsights: z.boolean().optional(),
    })
    .strict(),
};

router.get('/', async (req, res, next) => {
  try {
    res.json(await buildSettingsResponse(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.patch('/', validate(patchSchema), async (req, res, next) => {
  try {
    const updateData = pickSettingsUpdate(req.body);
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await getOrCreateUserSettings(req.user.id);
    const updated = await prisma.userSettings.update({
      where: { userId: req.user.id },
      data: updateData,
    });
    res.json(await buildSettingsResponse(req.user.id, updated));
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

router.post('/telegram/test', async (req, res, next) => {
  try {
    if (!isTelegramConfigured()) {
      return res.status(503).json({ error: 'Telegram bot is not configured on the server' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { telegramChatId: true },
    });
    if (!user?.telegramChatId) {
      return res.status(400).json({ error: 'Telegram account is not linked' });
    }
    const settings = await getOrCreateUserSettings(req.user.id);
    if (!settings.telegramEnabled) {
      return res.status(400).json({ error: 'Telegram alerts are disabled' });
    }

    const { maybeSendTelegram } = require('../lib/telegram/telegramDelivery');
    const lang = settings.language === 'ar' ? 'ar' : 'en';
    const result = await maybeSendTelegram(req.user.id, {
      id: `test-${Date.now()}`,
      type: 'system.telegram_test',
      title: lang === 'ar' ? '✅ تنبيه تجريبي' : '✅ Test notification',
      message:
        lang === 'ar'
          ? 'تكامل Telegram يعمل بنجاح.'
          : 'Your Telegram integration is working.',
      link: '/dashboard',
      priority: 'HIGH',
    });

    if (!result?.ok && !result?.sent) {
      return res.status(502).json({ error: result?.error || result?.reason || 'Telegram delivery failed' });
    }
    res.json({ ok: true, sent: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
