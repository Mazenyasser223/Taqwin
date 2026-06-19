/**
 * Unit tests for For You recommendation scoring helpers (no DB).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  scorePost,
  diversifyRankedPosts,
  diversifyContentTypes,
  extractKeywords,
  goalsRelated,
  prependOwnPosts,
} = requireFromHere('../src/services/community/recommendationService');

function baseSignals(overrides = {}) {
  return {
    followedIds: new Set(),
    ringedIds: new Set(),
    mutualIds: new Set(),
    viewerGymIds: new Set(),
    taggedPostIds: new Set(),
    blockedIds: [],
    savedAuthorIds: new Set(),
    groupPeerAuthorIds: new Set(),
    recentEngagementAuthorIds: new Set(),
    consumedPostIds: new Set(),
    interestKeywords: new Set(),
    recentlyServedPostIds: new Set(),
    viewerRole: 'athlete',
    fitnessGoal: 'Build Strength',
    gymPeerAuthorIds: new Set(),
    ...overrides,
  };
}

function mockPost(overrides = {}) {
  return {
    id: 'post-1',
    authorId: 'author-1',
    content: 'Leg day #strength training',
    createdAt: new Date(),
    likesCount: 10,
    repostsCount: 1,
    author: { role: 'athlete', athleteProfile: { fitnessGoal: 'Build Strength' } },
    tags: [],
    gymMentions: [],
    media: [],
    _count: { comments: 2, likes: 10, reposts: 1 },
    ...overrides,
  };
}

describe('recommendationService helpers', () => {
  it('extractKeywords finds hashtags and long words', () => {
    const keys = extractKeywords('Great #deadlift session for strength');
    expect(keys).toContain('deadlift');
    expect(keys).toContain('strength');
  });

  it('goalsRelated matches same and related fitness goals', () => {
    expect(goalsRelated('Build Strength', 'build strength')).toBe(true);
    expect(goalsRelated('Build Strength', 'Hypertrophy')).toBe(true);
    expect(goalsRelated('Build Strength', 'Endurance')).toBe(false);
  });

  it('scorePost boosts follow, ring, and fitness goal match', () => {
    const signals = baseSignals({
      followedIds: new Set(['author-1']),
      ringedIds: new Set(['author-1']),
    });
    const { score, breakdown } = scorePost(mockPost(), 'viewer-1', signals, {
      withBreakdown: true,
      secondDegreeIds: new Set(),
    });
    expect(score).toBeGreaterThan(0);
    expect(breakdown.follow).toBeGreaterThan(0);
    expect(breakdown.ring).toBeGreaterThan(0);
    expect(breakdown.fitnessGoalExact).toBeGreaterThan(0);
  });

  it('scorePost penalizes consumed and recently served posts', () => {
    const signals = baseSignals({
      consumedPostIds: new Set(['post-1']),
      recentlyServedPostIds: new Set(['post-1']),
    });
    const { breakdown } = scorePost(mockPost(), 'viewer-1', signals, {
      withBreakdown: true,
      secondDegreeIds: new Set(),
    });
    expect(breakdown.consumed).toBeLessThan(0);
    expect(breakdown.recentlyServed).toBeLessThan(0);
  });

  it('diversifyRankedPosts limits repeated authors in the top window', () => {
    const ranked = [
      { post: mockPost({ id: 'a1', authorId: 'same' }), score: 100 },
      { post: mockPost({ id: 'a2', authorId: 'same' }), score: 99 },
      { post: mockPost({ id: 'a3', authorId: 'same' }), score: 98 },
      { post: mockPost({ id: 'b1', authorId: 'other' }), score: 50 },
    ];
    const out = diversifyRankedPosts(ranked, 4, 2, 3);
    const sameAuthorInHead = out.slice(0, 3).filter((p) => p.authorId === 'same').length;
    expect(sameAuthorInHead).toBeLessThanOrEqual(2);
    expect(out).toHaveLength(4);
  });

  it('diversifyContentTypes promotes poll and media into the head window', () => {
    const posts = [
      mockPost({ id: 't1', content: 'text only' }),
      mockPost({ id: 't2', content: 'text two' }),
      mockPost({ id: 't3', content: 'text three' }),
      mockPost({ id: 'p1', poll: { id: 'poll-1' }, content: 'poll post' }),
      mockPost({ id: 'm1', media: [{ url: 'x', mediaType: 'image' }], content: 'media post' }),
    ];
    const out = diversifyContentTypes(posts, 3);
    const head = out.slice(0, 3);
    expect(head.some((p) => p.poll)).toBe(true);
    expect(head.some((p) => p.media?.length)).toBe(true);
  });
});

describe('prependOwnPosts', () => {
  it('puts own posts first without duplicates', () => {
    const own = [
      { id: 'mine-1', createdAt: new Date() },
      { id: 'mine-2', createdAt: new Date() },
    ];
    const ranked = [
      { id: 'mine-1', createdAt: new Date() },
      { id: 'other-1', createdAt: new Date() },
      { id: 'other-2', createdAt: new Date() },
    ];
    const out = prependOwnPosts(own, ranked, 3);
    expect(out.map((p) => p.id)).toEqual(['mine-1', 'mine-2', 'other-1']);
  });
});
