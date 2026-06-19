/**
 * Telegram delivery smoke tests — allowed/blocked types + failure isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maybeSendTelegram, shouldSendTelegram } from '../src/lib/telegram/telegramDelivery.js';

const metrics = require('../src/lib/notifications/notificationMetrics');

process.env.TELEGRAM_BOT_TOKEN = 'test-token-smoke';

const linkedSettings = {
  telegramEnabled: true,
  telegramSecurityAlerts: true,
  telegramCoachAi: true,
  telegramFitnessAchievements: true,
  telegramOrders: true,
  telegramCommunityMessages: true,
  telegramSocialActivity: false,
  telegramCommunityComments: false,
  telegramDailyDigest: false,
  telegramWeeklySummary: true,
  telegramMealReminders: false,
  telegramWorkoutMissed: true,
  telegramAiInsights: true,
};

const linkedContext = {
  user: { telegramChatId: '123456789', telegramLinkedAt: new Date() },
  settings: linkedSettings,
};

function smokeDeps(overrides = {}) {
  return {
    loadTelegramContext: vi.fn().mockResolvedValue(linkedContext),
    sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true, result: { message_id: 1 } }),
    readDailyCount: overrides.readDailyCount,
    ...overrides,
  };
}

describe('telegram delivery smoke', () => {
  beforeEach(() => {
    metrics.resetMetricsForTest();
  });

  it('sends fitness.pr_achieved to Telegram', async () => {
    const deps = smokeDeps();
    const row = {
      id: 'n1',
      type: 'fitness.pr_achieved',
      title: 'New PR!',
      message: 'Bench Press 100kg',
      link: '/dashboard',
      priority: 'HIGH',
    };
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result).toMatchObject({ ok: true, sent: true });
    expect(deps.sendTelegramMessage).toHaveBeenCalledOnce();
    expect(metrics.snapshot().telegramSentToday).toBe(1);
  });

  it('sends coach.feedback_available (critical, bypasses cap)', async () => {
    const deps = smokeDeps();
    const row = {
      id: 'n2',
      type: 'coach.feedback_available',
      title: 'Coach reviewed your week',
      message: 'Plan adjusted for your goal',
      link: '/dashboard?weeklyReview=1',
      priority: 'HIGH',
    };
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result.ok).toBe(true);
    expect(deps.sendTelegramMessage).toHaveBeenCalledOnce();
  });

  it('sends support.reply (critical)', async () => {
    const deps = smokeDeps();
    const row = {
      id: 'n3',
      type: 'support.reply',
      title: 'Support',
      message: 'We replied to your ticket',
      link: '/support',
      priority: 'URGENT',
    };
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result.ok).toBe(true);
    expect(deps.sendTelegramMessage).toHaveBeenCalledOnce();
  });

  it('blocks community.reaction — no Telegram call', async () => {
    const deps = smokeDeps();
    const row = {
      id: 'n4',
      type: 'community.reaction',
      title: 'Ahmed',
      message: 'liked your post',
      link: '/community/post/1',
    };
    expect(shouldSendTelegram(row, linkedSettings)).toBe(false);
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result).toMatchObject({ skipped: true, reason: 'blocked_type' });
    expect(deps.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('logs API failure without throwing — in-app path stays safe', async () => {
    const deps = smokeDeps({
      sendTelegramMessage: vi.fn().mockResolvedValue({ ok: false, description: 'Forbidden: bot blocked' }),
    });
    const row = {
      id: 'n5',
      type: 'fitness.pr_achieved',
      title: 'PR',
      message: 'Squat 140kg',
      link: '/dashboard',
    };
    await expect(maybeSendTelegram('user-1', row, deps)).resolves.toMatchObject({
      ok: false,
      sent: false,
      reason: 'api_error',
    });
    expect(metrics.snapshot().telegramFailedToday).toBe(1);
    expect(metrics.snapshot().telegramSentToday).toBe(0);
  });

  it('increments rateLimited when daily cap reached', async () => {
    const deps = smokeDeps({
      readDailyCount: vi.fn().mockResolvedValue(3),
    });
    const row = {
      id: 'n6',
      type: 'fitness.hydration_goal',
      title: 'Hydration',
      message: 'Goal reached',
      link: '/dashboard',
      priority: 'LOW',
    };
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result.reason).toBe('rate_limited');
    expect(deps.sendTelegramMessage).not.toHaveBeenCalled();
    expect(metrics.snapshot().telegramRateLimitedToday).toBe(1);
  });
});
