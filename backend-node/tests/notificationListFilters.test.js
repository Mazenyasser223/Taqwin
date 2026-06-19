/**
 * Notification list filter tests.
 */
import { describe, it, expect } from 'vitest';
import {
  buildListWhere,
  buildUnreadWhere,
  categoryNeedsRepair,
} from '../src/lib/notifications/notificationListFilters.js';
import { categoryForType } from '../src/lib/notifications/notificationConstants.js';

describe('notificationListFilters', () => {
  const userId = 'user-1';

  it('builds ALL filter without category constraint', () => {
    const where = buildListWhere(userId, 'ALL');
    expect(where.userId).toBe(userId);
    expect(where.category).toBeUndefined();
    expect(where.readAt).toBeUndefined();
  });

  it('builds UNREAD filter on readAt only', () => {
    const where = buildUnreadWhere(userId);
    expect(where.readAt).toBeNull();
    expect(where.category).toBeUndefined();
  });

  it('builds category filters for drawer tabs', () => {
    expect(buildListWhere(userId, 'SUPPORT').category).toBe('SUPPORT');
    expect(buildListWhere(userId, 'WORKOUT').category).toBe('WORKOUT');
    expect(buildListWhere(userId, 'AI').category).toBe('AI');
    expect(buildListWhere(userId, 'SOCIAL').category).toBe('SOCIAL');
    expect(buildListWhere(userId, 'SHOP').category).toBe('SHOP');
    expect(buildListWhere(userId, 'SYSTEM').category).toBe('SYSTEM');
  });

  it('detects stale category rows for repair', () => {
    expect(
      categoryNeedsRepair({ type: 'support.reply', category: 'SYSTEM' }),
    ).toBe(true);
    expect(
      categoryNeedsRepair({ type: 'support.reply', category: categoryForType('support.reply') }),
    ).toBe(false);
    expect(
      categoryNeedsRepair({ type: 'community.follow', category: 'SOCIAL' }),
    ).toBe(false);
  });
});
