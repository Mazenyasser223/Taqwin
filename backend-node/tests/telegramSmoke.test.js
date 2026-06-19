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

  it('sends coach.feedback_available when coach pref is on', async () => {
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

  it('sends multiple non-critical types when prefs allow', async () => {
    const deps = smokeDeps();
    const row = {
      id: 'n6',
      type: 'fitness.hydration_goal',
      title: 'Hydration',
      message: 'Goal reached',
      link: '/dashboard',
      priority: 'LOW',
    };
    for (let i = 0; i < 5; i += 1) {
      const result = await maybeSendTelegram('user-1', { ...row, id: `n6-${i}` }, deps);
      expect(result.ok).toBe(true);
    }
    expect(deps.sendTelegramMessage).toHaveBeenCalledTimes(5);
    expect(metrics.snapshot().telegramSentToday).toBe(5);
  });

  it('sends workout.reminder when workout Telegram pref is on', async () => {
    const deps = smokeDeps();
    const row = {
      id: 'n7',
      type: 'workout.reminder',
      title: 'Workout reminder',
      message: 'You have a workout scheduled today.',
      link: '/dashboard?reminder=workout',
      priority: 'NORMAL',
    };
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result).toMatchObject({ ok: true, sent: true });
    expect(deps.sendTelegramMessage).toHaveBeenCalledOnce();
  });

  it('sends plan.meal_reminder when meal Telegram pref is on', async () => {
    const deps = smokeDeps({
      loadTelegramContext: vi.fn().mockResolvedValue({
        ...linkedContext,
        settings: { ...linkedSettings, telegramMealReminders: true },
      }),
    });
    const row = {
      id: 'n8',
      type: 'plan.meal_reminder',
      title: 'Meal time',
      message: 'Time for lunch.',
      link: '/nutrition',
      priority: 'NORMAL',
    };
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result).toMatchObject({ ok: true, sent: true });
    expect(deps.sendTelegramMessage).toHaveBeenCalledOnce();
  });

  it('skips plan.meal_reminder when meal Telegram pref is off', async () => {
    const deps = smokeDeps();
    const row = {
      id: 'n9',
      type: 'plan.meal_reminder',
      title: 'Meal time',
      message: 'Time for lunch.',
      link: '/nutrition',
    };
    expect(shouldSendTelegram(row, linkedSettings)).toBe(false);
    const result = await maybeSendTelegram('user-1', row, deps);
    expect(result).toMatchObject({ skipped: true, reason: 'prefs' });
    expect(deps.sendTelegramMessage).not.toHaveBeenCalled();
  });
});
