import type { StoryAuthorBundle } from '../../types';

/** Self first, then unseen rings, then fully seen (back of the row). */
export function sortStoryBundles(
  bundles: StoryAuthorBundle[],
  selfUserId?: string | null,
): StoryAuthorBundle[] {
  return [...bundles].sort((a, b) => {
    const aSelf = Boolean(selfUserId && a.author.id === selfUserId);
    const bSelf = Boolean(selfUserId && b.author.id === selfUserId);
    if (aSelf && !bSelf) return -1;
    if (!aSelf && bSelf) return 1;
    if (a.hasUnseen && !b.hasUnseen) return -1;
    if (!a.hasUnseen && b.hasUnseen) return 1;
    return 0;
  });
}

/** Mark stories 0..throughIndex as seen; reorder when the ring is fully seen. */
export function markAuthorStoriesSeen(
  bundles: StoryAuthorBundle[],
  authorId: string,
  throughIndex: number,
  selfUserId?: string | null,
): StoryAuthorBundle[] {
  const next = bundles.map((b) => {
    if (b.author.id !== authorId) return b;
    const stories = b.stories.map((s, i) => (i <= throughIndex ? { ...s, seen: true } : s));
    const hasUnseen = stories.some((s) => !s.seen);
    return { ...b, stories, hasUnseen };
  });
  return sortStoryBundles(next, selfUserId);
}
