import type { CommunityPost } from '../../types';
import type { ReactionEmoji } from './reactions';

/** Instant UI update before react API returns. */
export function optimisticPostReaction(post: CommunityPost, emoji: ReactionEmoji): CommunityPost {
  const prev = post.myReaction;
  const reactions = { ...(post.reactions ?? {}) };
  let likesCount = post.likesCount ?? 0;

  const dec = (e: ReactionEmoji) => {
    const n = Math.max(0, (reactions[e] ?? 0) - 1);
    if (n === 0) delete reactions[e];
    else reactions[e] = n;
  };

  if (prev === emoji) {
    if (prev) dec(prev);
    return { ...post, myReaction: null, reactions, likesCount: Math.max(0, likesCount - 1) };
  }

  if (prev) {
    dec(prev);
  } else {
    likesCount += 1;
  }
  reactions[emoji] = (reactions[emoji] ?? 0) + 1;

  return { ...post, myReaction: emoji, reactions, likesCount };
}
