/**
 * Community poll helpers (no DB).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const { mapPoll, normalizePollOptions } = requireFromHere('../src/services/community/pollService');

describe('normalizePollOptions', () => {
  it('dedupes and caps at 4 labels', () => {
    expect(normalizePollOptions(['A', 'B', 'A', 'C', 'D', 'E', 'F'])).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('mapPoll', () => {
  it('marks viewer selection and computes percents', () => {
    const mapped = mapPoll(
      {
        id: 'poll-1',
        postId: 'post-1',
        endsAt: null,
        options: [
          { id: 'opt-a', label: 'Yes', votesCount: 3, sortOrder: 0 },
          { id: 'opt-b', label: 'No', votesCount: 1, sortOrder: 1 },
        ],
        votes: [{ userId: 'user-1', optionId: 'opt-a' }],
      },
      'user-1',
    );
    expect(mapped.myOptionId).toBe('opt-a');
    expect(mapped.totalVotes).toBe(4);
    expect(mapped.options[0].percent).toBe(75);
    expect(mapped.options[1].percent).toBe(25);
  });

  it('uses knownMyOptionId without loading votes', () => {
    const mapped = mapPoll(
      {
        id: 'poll-1',
        postId: 'post-1',
        endsAt: null,
        options: [
          { id: 'opt-a', label: 'Yes', votesCount: 2, sortOrder: 0 },
          { id: 'opt-b', label: 'No', votesCount: 0, sortOrder: 1 },
        ],
      },
      'user-1',
      'opt-a',
    );
    expect(mapped.myOptionId).toBe('opt-a');
    expect(mapped.totalVotes).toBe(2);
  });
});
