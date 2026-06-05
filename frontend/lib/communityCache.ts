import { peekGetCache, cachedGet, revalidateGet, setGetCache } from './apiGetCache';
import type { FeedFilter } from '../services/communityService';
import type { CommunityPost, CommunityComment, StoryAuthorBundle, CommunityConversation } from '../types';

export const COMMUNITY_FEED_TTL_MS = 12_000;
export const COMMUNITY_STORIES_TTL_MS = 12_000;
export const COMMUNITY_COMMENTS_TTL_MS = 20_000;
export const COMMUNITY_INBOX_TTL_MS = 3_000;

export function communityFeedKey(
  feed: FeedFilter,
  opts?: { groupId?: string; authorId?: string },
): string {
  return `community:feed:${feed}:${opts?.groupId ?? ''}:${opts?.authorId ?? ''}`;
}

export function communityStoriesKey(): string {
  return 'community:stories:feed';
}

export function communityCommentsKey(postId: string): string {
  return `community:comments:${postId}`;
}

export function communityInboxKey(folder: 'primary' | 'requests'): string {
  return `community:inbox:${folder}`;
}

export function peekCommunityFeed(
  feed: FeedFilter,
  opts?: { groupId?: string; authorId?: string },
): CommunityPost[] | null {
  return peekGetCache(communityFeedKey(feed, opts), COMMUNITY_FEED_TTL_MS);
}

export function peekCommunityStories(): StoryAuthorBundle[] | null {
  return peekGetCache(communityStoriesKey(), COMMUNITY_STORIES_TTL_MS);
}

export function peekCommunityComments(postId: string): CommunityComment[] | null {
  return peekGetCache(communityCommentsKey(postId), COMMUNITY_COMMENTS_TTL_MS);
}

export function peekCommunityInbox(folder: 'primary' | 'requests'): CommunityConversation[] | null {
  return peekGetCache(communityInboxKey(folder), COMMUNITY_INBOX_TTL_MS);
}

export function prependPostToFeedCaches(post: CommunityPost, feeds: FeedFilter[] = ['for_you', 'following']): void {
  for (const feed of feeds) {
    const key = communityFeedKey(feed);
    const hit = peekGetCache<CommunityPost[]>(key, COMMUNITY_FEED_TTL_MS * 4);
    if (hit) setGetCache(key, [post, ...hit.filter((p) => p.id !== post.id)]);
  }
}

export function removePostFromFeedCaches(postId: string): void {
  for (const feed of ['for_you', 'following', 'coaches', 'athletes', 'trending'] as FeedFilter[]) {
    const key = communityFeedKey(feed);
    const hit = peekGetCache<CommunityPost[]>(key, COMMUNITY_FEED_TTL_MS * 4);
    if (hit) setGetCache(key, hit.filter((p) => p.id !== postId));
  }
}

/** Prefetch default feed + stories (nav hover / idle warmup). */
export function prefetchCommunityWarmup(): void {
  void import('../services/communityService').then((m) => {
    m.default.getPosts('for_you');
    m.default.getStoriesFeed();
  });
}

export function prefetchCommunityFeed(feed: FeedFilter): void {
  void import('../services/communityService').then((m) => {
    m.default.getPosts(feed);
  });
}

export function prefetchCommunityComments(postId: string): void {
  void import('../services/communityService').then((m) => {
    m.default.getComments(postId);
  });
}

export { cachedGet, revalidateGet };
