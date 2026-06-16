import { peekGetCache, cachedGet, revalidateGet, setGetCache, peekStaleGetCache } from './apiGetCache';
import { filterGroupsByPrefix } from './communitySearch';
import type { FeedFilter } from '../services/communityService';
import type { CommunityPost, CommunityComment, StoryAuthorBundle, CommunityConversation, CommunityAuthor, CommunityUserProfile, CommunityMessage, InboxMessagesResponse, CommunityGroup } from '../types';

export const COMMUNITY_GROUPS_TTL_MS = 12_000;
export const COMMUNITY_GROUPS_STALE_MS = 5 * 60_000;

export function communityGroupsListKey(): string {
  return 'community:groups:list';
}

export function communityGroupKey(groupId: string): string {
  return `community:groups:detail:${groupId}`;
}

export function communityGroupPostsKey(groupId: string): string {
  return communityFeedKey('for_you', { groupId });
}

export function peekCommunityGroups(): CommunityGroup[] | null {
  const key = communityGroupsListKey();
  return (
    peekGetCache<CommunityGroup[]>(key, COMMUNITY_GROUPS_TTL_MS) ??
    peekStaleGetCache<CommunityGroup[]>(key, COMMUNITY_GROUPS_STALE_MS)
  );
}

export function peekCommunityGroup(groupId: string): CommunityGroup | null {
  const key = communityGroupKey(groupId);
  return (
    peekGetCache<CommunityGroup>(key, COMMUNITY_GROUPS_TTL_MS) ??
    peekStaleGetCache<CommunityGroup>(key, COMMUNITY_GROUPS_STALE_MS)
  );
}

/** Keep groups list + detail caches in sync after join/leave/update on this device. */
export function patchGroupInCaches(group: CommunityGroup): void {
  setGetCache(communityGroupKey(group.id), group);
  const list = peekStaleGetCache<CommunityGroup[]>(communityGroupsListKey(), COMMUNITY_GROUPS_STALE_MS);
  if (!list?.length) return;
  const idx = list.findIndex((g) => g.id === group.id);
  const next = idx >= 0 ? list.map((g) => (g.id === group.id ? group : g)) : [group, ...list];
  setGetCache(communityGroupsListKey(), next);
}

export function prependGroupToListCache(group: CommunityGroup): void {
  setGetCache(communityGroupKey(group.id), group);
  const list = peekStaleGetCache<CommunityGroup[]>(communityGroupsListKey(), COMMUNITY_GROUPS_STALE_MS) ?? [];
  setGetCache(communityGroupsListKey(), [group, ...list.filter((g) => g.id !== group.id)]);
}

export function prefetchCommunityGroups(): void {
  void import('../services/communityService').then((m) => {
    m.default.getGroups();
  });
}

export function communityGroupsSearchKey(q: string): string {
  return `community:groups:search:${q.trim().toLowerCase()}`;
}

export function peekCommunityGroupsSearch(q: string): CommunityGroup[] | null {
  if (!q.trim()) return null;
  const key = communityGroupsSearchKey(q);
  return (
    peekGetCache<CommunityGroup[]>(key, COMMUNITY_GROUPS_TTL_MS) ??
    peekStaleGetCache<CommunityGroup[]>(key, COMMUNITY_GROUPS_STALE_MS)
  );
}

export function setCommunityGroupsSearchCache(q: string, groups: CommunityGroup[]): void {
  if (!q.trim()) return;
  setGetCache(communityGroupsSearchKey(q), groups);
}

export function filterCommunityGroupsLocal(groups: CommunityGroup[], q: string): CommunityGroup[] {
  return filterGroupsByPrefix(groups, q);
}

export function prefetchCommunityGroup(groupId: string): void {
  void import('../services/communityService').then((m) => {
    m.default.getGroup(groupId);
    m.default.getPosts('for_you', { groupId });
  });
}

export const COMMUNITY_FEED_TTL_MS = 8_000;
export const COMMUNITY_STORIES_TTL_MS = 20_000;
export const COMMUNITY_FEED_STALE_MS = 5 * 60_000;
export const COMMUNITY_STORIES_STALE_MS = 5 * 60_000;
export const COMMUNITY_COMMENTS_TTL_MS = 20_000;
export const COMMUNITY_COMMENTS_STALE_MS = 5 * 60_000;
export const COMMUNITY_INBOX_TTL_MS = 10_000;
export const COMMUNITY_INBOX_STALE_MS = 5 * 60_000;
export const COMMUNITY_MESSAGES_TTL_MS = 15_000;
export const COMMUNITY_MESSAGES_STALE_MS = 5 * 60_000;
export const COMMUNITY_BROWSE_SEARCH_TTL_MS = 30_000;
export const COMMUNITY_BROWSE_DISCOVER_TTL_MS = 60_000;
export const COMMUNITY_BROWSE_STALE_MS = 5 * 60_000;
export const COMMUNITY_PROFILE_TTL_MS = 12_000;
export const COMMUNITY_PROFILE_TAB_TTL_MS = 15_000;
export const COMMUNITY_PROFILE_STALE_MS = 5 * 60_000;

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

export function communityMessagesKey(conversationId: string): string {
  return `community:inbox:messages:${conversationId}`;
}

export function communityBrowseSearchKey(q: string): string {
  return `community:browse:search:${q.trim().toLowerCase()}`;
}

export function communityBrowseDiscoverKey(): string {
  return 'community:browse:discover';
}

export function communityProfileKey(userId: string): string {
  return `community:profile:${userId}`;
}

export function communityProfileMentionsKey(userId: string): string {
  return `community:profile:mentions:${userId}`;
}

export type ProfileTabCacheKey = 'followers' | 'following' | 'reposts' | 'saved' | 'mutual';

export function communityProfileTabKey(userId: string, tab: ProfileTabCacheKey): string {
  return `community:profile:tab:${tab}:${userId}`;
}

export function peekCommunityBrowseSearch(q: string): CommunityAuthor[] | null {
  const key = communityBrowseSearchKey(q);
  return (
    peekGetCache<CommunityAuthor[]>(key, COMMUNITY_BROWSE_SEARCH_TTL_MS) ??
    peekStaleGetCache<CommunityAuthor[]>(key, COMMUNITY_BROWSE_STALE_MS)
  );
}

export function peekCommunityBrowseDiscover(): CommunityAuthor[] | null {
  const key = communityBrowseDiscoverKey();
  return (
    peekGetCache<CommunityAuthor[]>(key, COMMUNITY_BROWSE_DISCOVER_TTL_MS) ??
    peekStaleGetCache<CommunityAuthor[]>(key, COMMUNITY_BROWSE_STALE_MS)
  );
}

export function peekCommunityProfile(userId: string): CommunityUserProfile | null {
  const key = communityProfileKey(userId);
  return (
    peekGetCache<CommunityUserProfile>(key, COMMUNITY_PROFILE_TTL_MS) ??
    peekStaleGetCache<CommunityUserProfile>(key, COMMUNITY_PROFILE_STALE_MS)
  );
}

export function peekCommunityProfileMentions(userId: string): CommunityPost[] | null {
  const key = communityProfileMentionsKey(userId);
  return (
    peekGetCache<CommunityPost[]>(key, COMMUNITY_PROFILE_TAB_TTL_MS) ??
    peekStaleGetCache<CommunityPost[]>(key, COMMUNITY_PROFILE_STALE_MS)
  );
}

export function peekCommunityProfileTab(
  userId: string,
  tab: ProfileTabCacheKey,
): CommunityAuthor[] | CommunityPost[] | null {
  const key = communityProfileTabKey(userId, tab);
  return (
    peekGetCache<CommunityAuthor[] | CommunityPost[]>(key, COMMUNITY_PROFILE_TAB_TTL_MS) ??
    peekStaleGetCache<CommunityAuthor[] | CommunityPost[]>(key, COMMUNITY_PROFILE_STALE_MS)
  );
}

/** Keep profile post caches in sync after like/comment on this device. */
export function patchPostInProfileCaches(userId: string, postId: string, patch: Partial<CommunityPost>): void {
  const authorKey = communityFeedKey('for_you', { authorId: userId });
  const authorHit = peekStaleGetCache<CommunityPost[]>(authorKey, COMMUNITY_PROFILE_STALE_MS);
  if (authorHit?.length) {
    setGetCache(
      authorKey,
      authorHit.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  }
  const mentionsKey = communityProfileMentionsKey(userId);
  const mentionHit = peekStaleGetCache<CommunityPost[]>(mentionsKey, COMMUNITY_PROFILE_STALE_MS);
  if (mentionHit?.length) {
    setGetCache(
      mentionsKey,
      mentionHit.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  }
  for (const tab of ['reposts', 'saved'] as ProfileTabCacheKey[]) {
    const tabKey = communityProfileTabKey(userId, tab);
    const tabHit = peekStaleGetCache<CommunityPost[]>(tabKey, COMMUNITY_PROFILE_STALE_MS);
    if (!tabHit?.length) continue;
    setGetCache(
      tabKey,
      tabHit.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  }
}

export function peekCommunityFeed(
  feed: FeedFilter,
  opts?: { groupId?: string; authorId?: string },
): CommunityPost[] | null {
  const key = communityFeedKey(feed, opts);
  return (
    peekGetCache<CommunityPost[]>(key, COMMUNITY_FEED_TTL_MS) ??
    peekStaleGetCache<CommunityPost[]>(key, COMMUNITY_FEED_STALE_MS)
  );
}

export function peekCommunityStories(): StoryAuthorBundle[] | null {
  const key = communityStoriesKey();
  return (
    peekGetCache<StoryAuthorBundle[]>(key, COMMUNITY_STORIES_TTL_MS) ??
    peekStaleGetCache<StoryAuthorBundle[]>(key, COMMUNITY_STORIES_STALE_MS)
  );
}

export function peekCommunityComments(postId: string): CommunityComment[] | null {
  const key = communityCommentsKey(postId);
  return (
    peekGetCache<CommunityComment[]>(key, COMMUNITY_COMMENTS_TTL_MS) ??
    peekStaleGetCache<CommunityComment[]>(key, COMMUNITY_COMMENTS_STALE_MS)
  );
}

export function peekCommunityInbox(folder: 'primary' | 'requests'): CommunityConversation[] | null {
  const key = communityInboxKey(folder);
  return (
    peekGetCache<CommunityConversation[]>(key, COMMUNITY_INBOX_TTL_MS) ??
    peekStaleGetCache<CommunityConversation[]>(key, COMMUNITY_INBOX_STALE_MS)
  );
}

export function peekCommunityMessages(conversationId: string): InboxMessagesResponse | null {
  const key = communityMessagesKey(conversationId);
  return (
    peekGetCache<InboxMessagesResponse>(key, COMMUNITY_MESSAGES_TTL_MS) ??
    peekStaleGetCache<InboxMessagesResponse>(key, COMMUNITY_MESSAGES_STALE_MS)
  );
}

export function setCommunityMessagesCache(conversationId: string, data: InboxMessagesResponse): void {
  setGetCache(communityMessagesKey(conversationId), data);
}

/** Move conversation to top of inbox lists after a new message (local only). */
export function patchConversationAfterSend(
  conversationId: string,
  lastMessage: NonNullable<CommunityConversation['lastMessage']>,
): void {
  for (const folder of ['primary', 'requests'] as const) {
    const key = communityInboxKey(folder);
    const hit = peekStaleGetCache<CommunityConversation[]>(key, COMMUNITY_INBOX_STALE_MS);
    if (!hit?.length) continue;
    const idx = hit.findIndex((c) => c.id === conversationId);
    if (idx < 0) continue;
    const updated = { ...hit[idx], lastMessage, unreadCount: 0, updatedAt: lastMessage.createdAt };
    const rest = hit.filter((c) => c.id !== conversationId);
    const starred = rest.filter((c) => c.isStarred);
    const normal = rest.filter((c) => !c.isStarred);
    const next = updated.isStarred ? [updated, ...starred, ...normal] : [...starred, updated, ...normal];
    setGetCache(key, next);
  }
}

export function appendMessageToCache(conversationId: string, message: CommunityMessage): void {
  const key = communityMessagesKey(conversationId);
  const hit = peekStaleGetCache<InboxMessagesResponse>(key, COMMUNITY_MESSAGES_STALE_MS);
  if (!hit) return;
  const exists = hit.messages.some((m) => m.id === message.id);
  const messages = exists
    ? hit.messages.map((m) => (m.id === message.id ? message : m))
    : [...hit.messages, message].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  setGetCache(key, { ...hit, messages });
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

const FEED_PATCH_KEYS: FeedFilter[] = ['for_you', 'following', 'coaches', 'athletes', 'gyms', 'trending'];

/** Keep in-memory feed caches in sync after a like/comment/repost on this device. */
export function patchPostInAllFeedCaches(postId: string, patch: Partial<CommunityPost>): void {
  for (const feed of FEED_PATCH_KEYS) {
    const key = communityFeedKey(feed);
    const hit = peekStaleGetCache<CommunityPost[]>(key, COMMUNITY_FEED_STALE_MS);
    if (!hit?.length) continue;
    setGetCache(
      key,
      hit.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
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

export function prefetchCommunityBrowseDiscover(): void {
  void import('../services/communityService').then((m) => {
    m.default.discoverUsers();
  });
}

export function prefetchCommunityProfile(userId: string): void {
  void import('../services/communityService').then((m) => {
    m.default.getUserProfile(userId);
    m.default.getPosts('for_you', { authorId: userId });
  });
}

export function prefetchCommunityInbox(): void {
  void import('../services/communityService').then((m) => {
    m.default.getConversations('primary');
    m.default.getConversations('requests');
  });
}

export function prefetchCommunityMessages(conversationId: string): void {
  void import('../services/communityService').then((m) => {
    m.default.getMessages(conversationId);
  });
}

export function setCommunityProfileCache(userId: string, profile: CommunityUserProfile): void {
  setGetCache(communityProfileKey(userId), profile);
}

export { cachedGet, revalidateGet };
