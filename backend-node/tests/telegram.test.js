/**
 * Unit tests for Telegram delivery rules.
 */
import { describe, it, expect } from 'vitest';
import {
  isBlockedType,
  isCriticalType,
  isAllowedByPrefs,
  prefKeyForTelegramType,
} from '../src/lib/telegram/telegramTypeMap.js';

const baseSettings = {
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

describe('telegramTypeMap', () => {
  it('blocks noisy social types', () => {
    expect(isBlockedType('community.reaction')).toBe(true);
    expect(isBlockedType('community.like')).toBe(true);
    expect(isBlockedType('community.ring')).toBe(true);
    expect(isBlockedType('promo.sale')).toBe(true);
  });

  it('allows coach and support types', () => {
    expect(isBlockedType('coach.feedback_available')).toBe(false);
    expect(isBlockedType('support.reply')).toBe(false);
    expect(isBlockedType('fitness.pr_achieved')).toBe(false);
  });

  it('marks support and auth as critical', () => {
    expect(isCriticalType('support.reply', { priority: 'URGENT' })).toBe(true);
    expect(isCriticalType('auth.new_device', {})).toBe(true);
    expect(isCriticalType('coach.feedback_available', {})).toBe(true);
  });

  it('marks recovery drop as critical', () => {
    expect(
      isCriticalType('fitness.recovery_changed', {
        payload: { score: 63, previousScore: 82, delta: -19 },
      }),
    ).toBe(true);
    expect(
      isCriticalType('fitness.recovery_changed', {
        payload: { score: 80, previousScore: 85, delta: -5 },
      }),
    ).toBe(false);
  });

  it('respects granular prefs', () => {
    expect(isAllowedByPrefs('community.follow', baseSettings)).toBe(false);
    expect(
      isAllowedByPrefs('community.follow', { ...baseSettings, telegramSocialActivity: true }),
    ).toBe(true);
    expect(isAllowedByPrefs('fitness.pr_achieved', baseSettings)).toBe(true);
    expect(
      isAllowedByPrefs('fitness.pr_achieved', { ...baseSettings, telegramFitnessAchievements: false }),
    ).toBe(false);
  });

  it('maps types to preference keys', () => {
    expect(prefKeyForTelegramType('auth.password_changed')).toBe('telegramSecurityAlerts');
    expect(prefKeyForTelegramType('coach.feedback_available')).toBe('telegramCoachAi');
    expect(prefKeyForTelegramType('community.message')).toBe('telegramCommunityMessages');
  });
});
