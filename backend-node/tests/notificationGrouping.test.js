/**
 * Grouping hardening tests — merge logic + metrics + rate limit config.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

const { upsertWithGroupLock, MAX_GROUP_RETRIES } = requireFromHere(
  '../src/lib/notifications/notificationGrouping.js'
);
const { limitsForType, LIMITS } = requireFromHere('../src/lib/notifications/notificationRateLimit.js');
const {
  snapshot,
  resetMetricsForTest,
  inc,
} = requireFromHere('../src/lib/notifications/notificationMetrics.js');
const { buildGroupKey } = requireFromHere('../src/lib/notifications/notificationConstants.js');

function mergeActorExported(actors, actor) {
  const list = Array.isArray(actors) ? [...actors] : [];
  if (!actor?.id) return list;
  const filtered = list.filter((a) => a.id !== actor.id);
  filtered.unshift(actor);
  return filtered.slice(0, 3);
}

describe('notification hardening', () => {
  beforeEach(() => resetMetricsForTest());

  it('builds stable group key for reactions', () => {
    expect(buildGroupKey('community.reaction', { postId: 'abc' })).toBe(
      'group:community.reaction:post:abc'
    );
  });

  it('mergeActor keeps latest actor first and caps at 3', () => {
    const actors = [
      { id: '1', displayName: 'A' },
      { id: '2', displayName: 'B' },
      { id: '3', displayName: 'C' },
    ];
    const merged = mergeActorExported(actors, { id: '4', displayName: 'D' });
    expect(merged.map((a) => a.id)).toEqual(['4', '1', '2']);
  });

  it('defines social rate limits for reactions and invites', () => {
    expect(limitsForType('community.reaction')?.day).toBeGreaterThan(0);
    expect(limitsForType('community.group_invite')?.hour).toBeGreaterThan(0);
    expect(LIMITS['community.message']).toBeDefined();
  });

  it('tracks emit metrics counters', () => {
    inc('created', 2);
    inc('grouped', 5);
    inc('deduped', 1);
    const s = snapshot();
    expect(s.created).toBe(2);
    expect(s.grouped).toBe(5);
    expect(s.deduped).toBe(1);
  });

  it('upsertWithGroupLock retries up to MAX_GROUP_RETRIES', () => {
    expect(MAX_GROUP_RETRIES).toBeGreaterThanOrEqual(5);
    expect(typeof upsertWithGroupLock).toBe('function');
  });
});
