import { describe, it, expect } from 'vitest';
import { optimisticPollVote } from '../features/community/communityOptimistic';
import type { CommunityPoll } from '../types';

describe('optimisticPollVote', () => {
  const basePoll: CommunityPoll = {
    id: 'poll-1',
    postId: 'post-1',
    totalVotes: 4,
    myOptionId: null,
    options: [
      { id: 'a', label: 'A', votesCount: 2, percent: 50 },
      { id: 'b', label: 'B', votesCount: 2, percent: 50 },
    ],
  };

  it('selects an option and updates bars immediately', () => {
    const next = optimisticPollVote(basePoll, 'a');
    expect(next.myOptionId).toBe('a');
    expect(next.totalVotes).toBe(5);
    expect(next.options[0].votesCount).toBe(3);
    expect(next.options[0].percent).toBe(60);
  });

  it('moves vote between options without changing total', () => {
    const voted: CommunityPoll = { ...basePoll, myOptionId: 'a', totalVotes: 5 };
    const next = optimisticPollVote(voted, 'b');
    expect(next.myOptionId).toBe('b');
    expect(next.totalVotes).toBe(5);
    expect(next.options[0].votesCount).toBe(1);
    expect(next.options[1].votesCount).toBe(3);
  });
});
