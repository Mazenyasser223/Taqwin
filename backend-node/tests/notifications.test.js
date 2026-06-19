/**
 * Unit tests for notification metadata and templates.
 */
import { describe, it, expect } from 'vitest';
import {
  categoryForType,
  priorityForType,
  buildGroupKey,
  buildDedupeKey,
} from '../src/lib/notifications/notificationConstants.js';
import { renderNotification } from '../src/lib/notifications/notificationTemplates.js';

describe('notificationConstants', () => {
  it('maps community types to SOCIAL category', () => {
    expect(categoryForType('community.reaction')).toBe('SOCIAL');
    expect(categoryForType('workout.reminder')).toBe('WORKOUT');
    expect(categoryForType('support.reply')).toBe('SUPPORT');
  });

  it('assigns priority by type', () => {
    expect(priorityForType('support.reply')).toBe('URGENT');
    expect(priorityForType('promo.sale')).toBe('LOW');
    expect(priorityForType('community.follow')).toBe('NORMAL');
  });

  it('builds group keys for reactions', () => {
    expect(buildGroupKey('community.reaction', { postId: 'abc' })).toBe(
      'group:community.reaction:post:abc'
    );
  });

  it('builds dedupe keys', () => {
    expect(buildDedupeKey('user1', 'workout.reminder', { entityId: 'x', dateKey: '2026-06-18' })).toBe(
      'user1:workout.reminder:x:2026-06-18'
    );
  });
});

describe('notificationTemplates', () => {
  it('renders grouped reaction copy in English', () => {
    const out = renderNotification(
      'community.reaction',
      {
        actors: [{ displayName: 'Ahmed' }],
        actorCount: 19,
      },
      'en'
    );
    expect(out.message).toContain('Ahmed');
    expect(out.message).toContain('others');
  });

  it('renders follow copy in Arabic', () => {
    const out = renderNotification('community.follow', { actorName: 'Ahmed' }, 'ar');
    expect(out.message).toContain('Ahmed');
    expect(out.message).toContain('متابعتك');
  });

  it('renders follow copy in English', () => {
    const out = renderNotification('community.follow', { actorName: 'Ahmed' }, 'en');
    expect(out.message).toBe('Ahmed started following you.');
    expect(out.title).toContain('follower');
  });

  it('renders community reaction with emoji', () => {
    const out = renderNotification('community.reaction', { actorName: 'Ahmed', emoji: '❤️' }, 'en');
    expect(out.message).toContain('Ahmed');
    expect(out.message).toContain('❤️');
  });

  it('renders order.placed COD in Arabic', () => {
    const out = renderNotification(
      'order.placed',
      { variant: 'cod', total: '500', currency: 'EGP', phone: '+201234567890' },
      'ar',
    );
    expect(out.title).toContain('استلام');
    expect(out.message).toContain('500');
  });

  it('formats Telegram body from templates without footer hint', async () => {
    const { formatTelegramHtml, buildAppLink } = await import('../src/lib/telegram/telegramDelivery.js');
    const row = {
      type: 'coach.feedback_available',
      title: 'Old title',
      message: 'Old body',
      link: '/dashboard',
      payload: {},
    };
    const htmlEn = formatTelegramHtml(row, 'en');
    expect(htmlEn).toContain('Coach weekly review');
    expect(htmlEn).toContain('━━━━━━━━');
    expect(htmlEn).not.toContain('Open Taqwin');
    expect(htmlEn).not.toContain('Open the Taqwin app');
    expect(htmlEn).not.toContain('Old title');

    const htmlAr = formatTelegramHtml(row, 'ar');
    expect(htmlAr).toContain('مراجعة المدرب');
    expect(htmlAr).not.toContain('Open the Taqwin app');

    const link = buildAppLink(row);
    expect(link.startsWith('https://')).toBe(true);
    expect(link).not.toContain('localhost');
  });

  it('renders fitness streak milestone', () => {
    const out = renderNotification('fitness.streak_milestone', { days: 7 }, 'en');
    expect(out.title).toBeTruthy();
    expect(out.message).toMatch(/7/);
  });

  it('renders Arabic fitness insight from structured payload', () => {
    const out = renderNotification(
      'fitness.ai_insight',
      { exerciseName: 'Squat', exerciseNameAr: 'السكوات', percentChange: 12 },
      'ar',
    );
    expect(out.message).toContain('السكوات');
    expect(out.message).not.toContain('Your Squat');
  });

  it('renders coach feedback available', () => {
    const out = renderNotification(
      'coach.feedback_available',
      { message: 'Great week — increase volume slightly.', copyLocale: 'en' },
      'en'
    );
    expect(out.message).toContain('Great week');
  });

  it('renders weekly summary', () => {
    const out = renderNotification(
      'fitness.weekly_summary',
      { summary: 'Workout 85% · Nutrition 90%' },
      'en'
    );
    expect(out.message).toContain('85%');
  });
});

describe('in-app notification prefs', () => {
  it('only promo types map to in-app opt-out pref', async () => {
    const { inAppPrefKeyForType } = await import('../src/lib/notifications/notificationsCore.js');
    expect(inAppPrefKeyForType('promo.sale')).toBe('notifyPromotional');
    expect(inAppPrefKeyForType('workout.reminder')).toBeNull();
    expect(inAppPrefKeyForType('coach.feedback_available')).toBeNull();
    expect(inAppPrefKeyForType('community.follow')).toBeNull();
    expect(inAppPrefKeyForType('order.placed')).toBeNull();
  });
});

describe('telegram shouldNotifyUser', () => {
  it('checks telegram prefs only', async () => {
    const { shouldNotifyUser } = await import('../src/lib/telegram/telegramTypeMap.js');
    const base = { telegramEnabled: true, telegramFitnessAchievements: true, notifyPromotional: true };
    expect(shouldNotifyUser('fitness.pr_achieved', base)).toBe(true);
    expect(
      shouldNotifyUser('fitness.pr_achieved', { ...base, telegramFitnessAchievements: false }),
    ).toBe(false);
    expect(shouldNotifyUser('community.reaction', base)).toBe(false);
    expect(shouldNotifyUser('coach.feedback_available', { ...base, telegramCoachAi: true })).toBe(true);
  });

  it('sends nothing on Telegram when master toggle is off', async () => {
    const { shouldNotifyUser } = await import('../src/lib/telegram/telegramTypeMap.js');
    const settings = {
      telegramEnabled: false,
      telegramCoachAi: true,
      telegramFitnessAchievements: true,
      notifyPromotional: true,
    };
    expect(shouldNotifyUser('coach.feedback_available', settings)).toBe(false);
    expect(shouldNotifyUser('support.reply', settings)).toBe(false);
    expect(shouldNotifyUser('fitness.pr_achieved', settings)).toBe(false);
  });

  it('blocks promo on Telegram when promotions pref is off', async () => {
    const { shouldNotifyUser } = await import('../src/lib/telegram/telegramTypeMap.js');
    expect(
      shouldNotifyUser('promo.sale', {
        telegramEnabled: true,
        notifyPromotional: false,
        telegramCoachAi: true,
      }),
    ).toBe(false);
  });
});

describe('quiet hours deferral', () => {
  it('defers LOW/NORMAL only — HIGH and URGENT pass through', async () => {
    const quietHours = await import('../src/lib/notifications/notificationQuietHours.js');
    const settings = {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      timezone: 'UTC',
    };
    const duringQuietHours = new Date('2024-06-15T23:30:00.000Z');

    expect(quietHours.shouldDefer('LOW', settings, duringQuietHours)).toBe(true);
    expect(quietHours.shouldDefer('NORMAL', settings, duringQuietHours)).toBe(true);
    expect(quietHours.shouldDefer('HIGH', settings, duringQuietHours)).toBe(false);
    expect(quietHours.shouldDefer('URGENT', settings, duringQuietHours)).toBe(false);
  });

  it('does not defer when quiet hours are disabled', async () => {
    const quietHours = await import('../src/lib/notifications/notificationQuietHours.js');
    expect(quietHours.shouldDefer('NORMAL', { quietHoursEnabled: false })).toBe(false);
  });
});

describe('notification list filters', () => {
  it('maps notification types to drawer filter categories', () => {
    expect(categoryForType('community.follow')).toBe('SOCIAL');
    expect(categoryForType('gamification.duel.invited')).toBe('SOCIAL');
    expect(categoryForType('workout.reminder')).toBe('WORKOUT');
    expect(categoryForType('fitness.pr_achieved')).toBe('WORKOUT');
    expect(categoryForType('coach.feedback_available')).toBe('AI');
    expect(categoryForType('ai.plan_change')).toBe('AI');
    expect(categoryForType('order.placed')).toBe('SHOP');
    expect(categoryForType('support.reply')).toBe('SUPPORT');
    expect(categoryForType('gym.checkin')).toBe('GYM');
    expect(categoryForType('auth.new_device')).toBe('SYSTEM');
  });
});

describe('fitness notification metadata', () => {
  it('maps fitness and coach types to expected categories and priority', () => {
    expect(categoryForType('fitness.streak_milestone')).toBe('WORKOUT');
    expect(categoryForType('coach.feedback_available')).toBe('AI');
    expect(priorityForType('fitness.pr_achieved')).toBe('HIGH');
    expect(priorityForType('fitness.recovery_changed')).toBe('NORMAL');
  });
});
