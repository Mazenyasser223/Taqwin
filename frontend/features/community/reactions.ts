import type { CommunityPost } from '../../types';

export type ReactionEmoji = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export type ReactionDef = {
  id: ReactionEmoji;
  label: string;
  symbol: string;
  /** Facebook-style accent for active label */
  color: string;
  /** Circle background in the summary stack */
  bg: string;
};

export const REACTIONS: ReactionDef[] = [
  { id: 'like', label: 'Like', symbol: '👍', color: '#1877F2', bg: '#1877F2' },
  { id: 'love', label: 'Love', symbol: '❤️', color: '#f33e58', bg: '#f33e58' },
  { id: 'haha', label: 'Haha', symbol: '😂', color: '#f7b125', bg: '#f7b125' },
  { id: 'wow', label: 'Wow', symbol: '😮', color: '#f7b125', bg: '#f7b125' },
  { id: 'sad', label: 'Sad', symbol: '😢', color: '#f7b125', bg: '#f7b125' },
  { id: 'angry', label: 'Angry', symbol: '😠', color: '#e9710f', bg: '#e9710f' },
];

export function reactionSymbol(id: ReactionEmoji | string | null | undefined) {
  return REACTIONS.find((r) => r.id === id)?.symbol ?? '👍';
}

export function reactionDef(id: ReactionEmoji | string | null | undefined): ReactionDef | undefined {
  return REACTIONS.find((r) => r.id === id);
}

export function reactionColor(id: ReactionEmoji | string | null | undefined) {
  return reactionDef(id)?.color ?? '#1877F2';
}

/** Top reactions by count — for the Facebook-style stacked bubble row. */
export function getTopReactions(post: CommunityPost, limit = 3): (ReactionDef & { count: number })[] {
  return REACTIONS.map((r) => ({ ...r, count: post.reactions?.[r.id] ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function totalReactions(post: CommunityPost): number {
  if (post.likesCount != null) return post.likesCount;
  const rx = post.reactions;
  if (!rx) return 0;
  return REACTIONS.reduce((sum, r) => sum + (rx[r.id] ?? 0), 0);
}
