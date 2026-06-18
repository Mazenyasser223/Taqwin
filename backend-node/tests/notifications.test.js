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
  });

  it('renders fitness streak milestone', () => {
    const out = renderNotification('fitness.streak_milestone', { days: 7 }, 'en');
    expect(out.title).toBeTruthy();
    expect(out.message).toMatch(/7/);
  });

  it('renders coach feedback available', () => {
    const out = renderNotification(
      'coach.feedback_available',
      { message: 'Great week — increase volume slightly.' },
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

describe('fitness notification metadata', () => {
  it('maps fitness and coach types to expected categories and priority', () => {
    expect(categoryForType('fitness.streak_milestone')).toBe('WORKOUT');
    expect(categoryForType('coach.feedback_available')).toBe('AI');
    expect(priorityForType('fitness.pr_achieved')).toBe('HIGH');
    expect(priorityForType('fitness.recovery_changed')).toBe('NORMAL');
  });
});
