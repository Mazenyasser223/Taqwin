import apiClient, { ApiResponse } from './api';
import { cachedGet, setGetCache, revalidateGet, invalidateGetCache, peekStaleGetCache } from '../lib/apiGetCache';
import {
  communityFeedKey,
  communityStoriesKey,
  communityCommentsKey,
  communityInboxKey,
  communityMessagesKey,
  COMMUNITY_FEED_TTL_MS,
  COMMUNITY_STORIES_TTL_MS,
  COMMUNITY_FEED_STALE_MS,
  COMMUNITY_STORIES_STALE_MS,
  COMMUNITY_COMMENTS_TTL_MS,
  COMMUNITY_INBOX_TTL_MS,
  COMMUNITY_MESSAGES_TTL_MS,
  COMMUNITY_BROWSE_SEARCH_TTL_MS,
  COMMUNITY_BROWSE_DISCOVER_TTL_MS,
  COMMUNITY_BROWSE_STALE_MS,
  COMMUNITY_PROFILE_TTL_MS,
  COMMUNITY_PROFILE_TAB_TTL_MS,
  COMMUNITY_PROFILE_STALE_MS,
  communityBrowseSearchKey,
  communityBrowseDiscoverKey,
  communityProfileKey,
  communityProfileMentionsKey,
  communityProfileTabKey,
  communityGroupsListKey,
  communityGroupKey,
  communityGroupsSearchKey,
  COMMUNITY_GROUPS_TTL_MS,
  COMMUNITY_GROUPS_STALE_MS,
  setCommunityMessagesCache,
  appendMessageToCache,
  patchGroupInCaches,
  prependGroupToListCache,
  type ProfileTabCacheKey,
} from '../lib/communityCache';
import type {
  CommunityPost,
  CommunityComment,
  CommunityGroup,
  CommunityGroupMember,
  CommunityConversation,
  CommunityMessage,
  InboxMessagesResponse,
  CommunityAuthor,
  CommunityUserProfile,
  CommunityPrivacySettings,
  StoryAuthorBundle,
  StoryViewer,
  StoryReply,
  ReactionEmoji,
  PrivacyAudience,
  MessageType,
  Profile,
  GroupPostPermission,
  GroupPostsVisibility,
  GroupMembersVisibility,
  GroupInvitePermission,
  GroupJoinPolicy,
  GroupJoinRequestMember,
  PostMediaItem,
  CommunityPostReposter,
} from '../types';

export type FeedFilter = 'for_you' | 'following' | 'coaches' | 'athletes' | 'gyms' | 'trending';

export interface CreatePostData {
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video' | 'mixed';
  mediaItems?: PostMediaItem[];
  groupId?: string;
  commentsLocked?: boolean;
  repostsLocked?: boolean;
  visibility?: PrivacyAudience;
  mentionUserIds?: string[];
  mentionGymIds?: string[];
}

export interface CreateCommentData {
  content: string;
  parentId?: string;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface UpdateGroupData {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  postPermission?: GroupPostPermission;
  invitePermission?: GroupInvitePermission;
  joinPolicy?: GroupJoinPolicy;
  postsVisibility?: GroupPostsVisibility;
  membersVisibility?: GroupMembersVisibility;
}

class CommunityService {
  private async fetchPostsFromApi(
    feed: FeedFilter,
    opts?: { groupId?: string; authorId?: string; fresh?: boolean },
  ): Promise<CommunityPost[]> {
    const params = new URLSearchParams({ feed });
    if (opts?.groupId) params.set('groupId', opts.groupId);
    if (opts?.authorId) params.set('authorId', opts.authorId);
    if (opts?.fresh) params.set('refresh', '1');
    const res = await apiClient.request<CommunityPost[]>(`/api/community/posts?${params}`, {
      method: 'GET',
      timeoutMs: 45000,
    });
    if (res.error) throw new Error(res.error);
    return res.data ?? [];
  }

  /** Background refresh while showing cached feed (uses server cache when possible). */
  revalidatePosts(
    feed: FeedFilter,
    onData: (posts: CommunityPost[]) => void,
    opts?: { groupId?: string; authorId?: string },
  ): void {
    const key = communityFeedKey(feed, opts);
    revalidateGet(key, () => this.fetchPostsFromApi(feed, opts), onData);
  }

  async getPosts(
    feed: FeedFilter = 'for_you',
    opts?: { groupId?: string; authorId?: string },
  ): Promise<ApiResponse<CommunityPost[]>> {
    const key = communityFeedKey(feed, opts);
    try {
      const data = await cachedGet(key, COMMUNITY_FEED_TTL_MS, () => this.fetchPostsFromApi(feed, opts));
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityPost[]>(key, COMMUNITY_FEED_STALE_MS);
      if (stale?.length) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  /** Network refresh; updates cache via setGetCache in caller or revalidateGet. */
  async refreshPosts(
    feed: FeedFilter = 'for_you',
    opts?: { groupId?: string; authorId?: string },
  ): Promise<ApiResponse<CommunityPost[]>> {
    const key = communityFeedKey(feed, opts);
    try {
      const data = await this.fetchPostsFromApi(feed, { ...opts, fresh: true });
      setGetCache(key, data);
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityPost[]>(key, COMMUNITY_FEED_STALE_MS);
      if (stale?.length) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async getPost(id: string): Promise<ApiResponse<CommunityPost>> {
    return apiClient.get<CommunityPost>(`/api/community/posts/${id}`);
  }

  async createPost(data: CreatePostData): Promise<ApiResponse<CommunityPost>> {
    const hasVideo =
      Boolean(data.videoUrl) ||
      (data.mediaItems?.some((m) => m.mediaType === 'video') ?? false);
    return apiClient.post<CommunityPost>('/api/community/posts', data, {
      timeoutMs: hasVideo ? 120_000 : 45_000,
    });
  }

  async deletePost(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/community/posts/${id}`);
  }

  async likePost(id: string): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post<CommunityPost>(`/api/community/posts/${id}/like`, {});
  }

  async reactPost(id: string, emoji: ReactionEmoji): Promise<ApiResponse<Partial<CommunityPost>>> {
    return apiClient.post<Partial<CommunityPost>>(`/api/community/posts/${id}/react`, { emoji });
  }

  async getUserProfile(userId: string): Promise<ApiResponse<CommunityUserProfile>> {
    const key = communityProfileKey(userId);
    try {
      const data = await cachedGet(key, COMMUNITY_PROFILE_TTL_MS, async () => {
        const res = await apiClient.get<CommunityUserProfile>(`/api/community/users/${userId}/profile`);
        if (res.error) throw new Error(res.error);
        if (!res.data) throw new Error('Profile not found');
        return { ...res.data, posts: [], mentionedPosts: [] };
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityUserProfile>(key, COMMUNITY_PROFILE_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  revalidateProfileShell(userId: string, onData: (profile: CommunityUserProfile) => void): void {
    const key = communityProfileKey(userId);
    revalidateGet(
      key,
      async () => {
        const res = await apiClient.get<CommunityUserProfile>(`/api/community/users/${userId}/profile`);
        if (res.error) throw new Error(res.error);
        if (!res.data) throw new Error('Profile not found');
        return { ...res.data, posts: [], mentionedPosts: [] };
      },
      onData,
    );
  }

  async getProfileMentions(userId: string): Promise<ApiResponse<CommunityPost[]>> {
    const key = communityProfileMentionsKey(userId);
    try {
      const data = await cachedGet(key, COMMUNITY_PROFILE_TAB_TTL_MS, async () => {
        const res = await apiClient.get<CommunityPost[]>(`/api/community/users/${userId}/profile/mentions`);
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityPost[]>(key, COMMUNITY_PROFILE_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  private async cachedProfileAuthors(
    userId: string,
    tab: Extract<ProfileTabCacheKey, 'followers' | 'following' | 'mutual'>,
    path: string,
  ): Promise<ApiResponse<CommunityAuthor[]>> {
    const key = communityProfileTabKey(userId, tab);
    try {
      const data = await cachedGet(key, COMMUNITY_PROFILE_TAB_TTL_MS, async () => {
        const res = await apiClient.get<CommunityAuthor[]>(path);
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityAuthor[]>(key, COMMUNITY_PROFILE_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  private async cachedProfilePosts(
    userId: string,
    tab: Extract<ProfileTabCacheKey, 'reposts' | 'saved'>,
    path: string,
  ): Promise<ApiResponse<CommunityPost[]>> {
    const key = communityProfileTabKey(userId, tab);
    try {
      const data = await cachedGet(key, COMMUNITY_PROFILE_TAB_TTL_MS, async () => {
        const res = await apiClient.get<CommunityPost[]>(path);
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityPost[]>(key, COMMUNITY_PROFILE_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async sendPresenceHeartbeat(): Promise<
    ApiResponse<{ ok: boolean; lastSeenAt: string; isOnline: boolean }>
  > {
    return apiClient.post<{ ok: boolean; lastSeenAt: string; isOnline: boolean }>(
      '/api/community/presence/heartbeat',
      {},
    );
  }

  async getPresence(
    userIds: string[],
  ): Promise<ApiResponse<Record<string, { isOnline: boolean; lastSeenAt: string | null }>>> {
    if (!userIds.length) return { data: {} };
    const q = encodeURIComponent([...new Set(userIds)].slice(0, 100).join(','));
    const res = await apiClient.get<{ presence: Record<string, { isOnline: boolean; lastSeenAt: string | null }> }>(
      `/api/community/presence?userIds=${q}`,
    );
    if (res.error) return { error: res.error };
    return { data: res.data?.presence ?? {} };
  }

  async updateMyProfile(data: {
    bio?: string;
    displayName?: string;
    communityAvatarUrl?: string | null;
    coverUrl?: string | null;
  }): Promise<ApiResponse<Profile>> {
    return apiClient.patch<Profile>('/api/community/users/me/profile', data);
  }

  async getFollowers(userId: string): Promise<ApiResponse<CommunityAuthor[]>> {
    return this.cachedProfileAuthors(userId, 'followers', `/api/community/users/${userId}/followers`);
  }

  async getFollowing(userId: string): Promise<ApiResponse<CommunityAuthor[]>> {
    return this.cachedProfileAuthors(userId, 'following', `/api/community/users/${userId}/following`);
  }

  async repostPost(id: string): Promise<ApiResponse<Partial<CommunityPost>>> {
    return apiClient.post<Partial<CommunityPost>>(`/api/community/posts/${id}/repost`, {});
  }

  async getPostReposters(postId: string): Promise<ApiResponse<CommunityPostReposter[]>> {
    return apiClient.get<CommunityPostReposter[]>(`/api/community/posts/${postId}/reposts`);
  }

  async refreshComments(postId: string): Promise<ApiResponse<CommunityComment[]>> {
    const res = await apiClient.get<CommunityComment[]>(`/api/community/posts/${postId}/comments`);
    if (!res.error && res.data) setGetCache(communityCommentsKey(postId), res.data);
    return res;
  }

  async getComments(postId: string): Promise<ApiResponse<CommunityComment[]>> {
    const key = communityCommentsKey(postId);
    try {
      const data = await cachedGet(key, COMMUNITY_COMMENTS_TTL_MS, async () => {
        const res = await apiClient.get<CommunityComment[]>(`/api/community/posts/${postId}/comments`);
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async addComment(postId: string, data: CreateCommentData): Promise<ApiResponse<CommunityComment>> {
    const res = await apiClient.post<CommunityComment>(`/api/community/posts/${postId}/comments`, data);
    if (!res.error && res.data) invalidateGetCache(communityCommentsKey(postId));
    return res;
  }

  revalidateComments(postId: string, onData: (comments: CommunityComment[]) => void): void {
    const key = communityCommentsKey(postId);
    revalidateGet(
      key,
      async () => {
        const res = await apiClient.get<CommunityComment[]>(`/api/community/posts/${postId}/comments`);
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      },
      onData,
    );
  }

  async updateComment(commentId: string, content: string): Promise<ApiResponse<CommunityComment>> {
    return apiClient.patch<CommunityComment>(`/api/community/comments/${commentId}`, { content });
  }

  async deleteComment(commentId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.delete<{ ok: boolean }>(`/api/community/comments/${commentId}`);
  }

  async reactComment(commentId: string, emoji: ReactionEmoji): Promise<ApiResponse<CommunityComment>> {
    return apiClient.post<CommunityComment>(`/api/community/comments/${commentId}/react`, { emoji });
  }

  async followUser(userId: string): Promise<
    ApiResponse<{
      following: boolean;
      followStatus: string;
      requestSent?: boolean;
      targetCounts?: { followersCount: number; followingCount: number };
      viewerCounts?: { followersCount: number; followingCount: number };
    }>
  > {
    return apiClient.post(`/api/community/follow/${userId}`, {});
  }

  async acceptFollowRequest(followerId: string): Promise<
    ApiResponse<{
      following: boolean;
      followStatus: string;
      profileCounts?: { followersCount: number; followingCount: number };
    }>
  > {
    return apiClient.post(`/api/community/follow-requests/${followerId}/accept`, {});
  }

  async declineFollowRequest(followerId: string): Promise<
    ApiResponse<{
      following: boolean;
      followStatus: string;
      profileCounts?: { followersCount: number; followingCount: number };
    }>
  > {
    return apiClient.post(`/api/community/follow-requests/${followerId}/decline`, {});
  }

  async searchUsers(q: string): Promise<ApiResponse<CommunityAuthor[]>> {
    const trimmed = q.trim();
    if (!trimmed.length) return { data: [] };
    const key = communityBrowseSearchKey(trimmed);
    try {
      const data = await cachedGet(key, COMMUNITY_BROWSE_SEARCH_TTL_MS, async () => {
        const res = await apiClient.get<CommunityAuthor[]>(
          `/api/community/users/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityAuthor[]>(key, COMMUNITY_BROWSE_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async discoverUsers(): Promise<ApiResponse<CommunityAuthor[]>> {
    const key = communityBrowseDiscoverKey();
    try {
      const data = await cachedGet(key, COMMUNITY_BROWSE_DISCOVER_TTL_MS, async () => {
        const res = await apiClient.get<CommunityAuthor[]>('/api/community/users/browse/discover');
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityAuthor[]>(key, COMMUNITY_BROWSE_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  revalidateBrowseDiscover(onData: (users: CommunityAuthor[]) => void): void {
    const key = communityBrowseDiscoverKey();
    revalidateGet(
      key,
      async () => {
        const res = await apiClient.get<CommunityAuthor[]>('/api/community/users/browse/discover');
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      },
      onData,
    );
  }

  async searchMentions(q: string): Promise<
    ApiResponse<{
      users: CommunityAuthor[];
      gyms: { id: string; name: string; imageUrl?: string | null; ownerId: string }[];
    }>
  > {
    return apiClient.get(`/api/community/mentions/search?q=${encodeURIComponent(q)}`);
  }

  async getGroups(): Promise<ApiResponse<CommunityGroup[]>> {
    const key = communityGroupsListKey();
    try {
      const data = await cachedGet(key, COMMUNITY_GROUPS_TTL_MS, async () => {
        const res = await apiClient.get<CommunityGroup[]>('/api/community/groups');
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityGroup[]>(key, COMMUNITY_GROUPS_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async refreshGroups(): Promise<ApiResponse<CommunityGroup[]>> {
    const res = await apiClient.get<CommunityGroup[]>('/api/community/groups');
    if (!res.error && res.data) setGetCache(communityGroupsListKey(), res.data);
    return res;
  }

  async searchGroups(q: string): Promise<ApiResponse<CommunityGroup[]>> {
    const trimmed = q.trim();
    if (!trimmed) return this.getGroups();
    const key = communityGroupsSearchKey(trimmed);
    try {
      const data = await cachedGet(key, COMMUNITY_GROUPS_TTL_MS, async () => {
        const res = await apiClient.get<CommunityGroup[]>(
          `/api/community/groups?q=${encodeURIComponent(trimmed)}`,
        );
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityGroup[]>(key, COMMUNITY_GROUPS_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async getGroup(id: string, opts?: { fresh?: boolean }): Promise<ApiResponse<CommunityGroup>> {
    const key = communityGroupKey(id);
    if (opts?.fresh) {
      const res = await apiClient.get<CommunityGroup>(`/api/community/groups/${id}`);
      if (!res.error && res.data) setGetCache(key, res.data);
      return res;
    }
    try {
      const data = await cachedGet(key, COMMUNITY_GROUPS_TTL_MS, async () => {
        const res = await apiClient.get<CommunityGroup>(`/api/community/groups/${id}`);
        if (res.error) throw new Error(res.error);
        if (!res.data) throw new Error('Group not found');
        return res.data;
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<CommunityGroup>(key, COMMUNITY_GROUPS_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  revalidateGroups(onData: (groups: CommunityGroup[]) => void): void {
    const key = communityGroupsListKey();
    revalidateGet(
      key,
      async () => {
        const res = await apiClient.get<CommunityGroup[]>('/api/community/groups');
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      },
      onData,
    );
  }

  async createGroup(data: CreateGroupData): Promise<ApiResponse<CommunityGroup>> {
    const res = await apiClient.post<CommunityGroup>('/api/community/groups', data);
    if (!res.error && res.data) prependGroupToListCache(res.data);
    return res;
  }

  async updateGroup(id: string, data: UpdateGroupData): Promise<ApiResponse<CommunityGroup>> {
    const res = await apiClient.patch<CommunityGroup>(`/api/community/groups/${id}`, data);
    if (!res.error && res.data) patchGroupInCaches(res.data);
    return res;
  }

  async deleteGroup(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    const res = await apiClient.delete<{ deleted: boolean }>(`/api/community/groups/${id}`);
    if (!res.error) {
      invalidateGetCache(communityGroupKey(id));
      const list = peekStaleGetCache<CommunityGroup[]>(communityGroupsListKey(), COMMUNITY_GROUPS_STALE_MS);
      if (list) setGetCache(communityGroupsListKey(), list.filter((g) => g.id !== id));
    }
    return res;
  }

  async getGroupMembers(id: string): Promise<ApiResponse<CommunityGroupMember[]>> {
    return apiClient.get<CommunityGroupMember[]>(`/api/community/groups/${id}/members`);
  }

  async addGroupMember(
    groupId: string,
    userId: string,
  ): Promise<ApiResponse<{ invited: boolean; pending: boolean; groupId: string }>> {
    return apiClient.post(`/api/community/groups/${groupId}/members`, { userId });
  }

  async acceptGroupInvite(groupId: string): Promise<ApiResponse<CommunityGroup>> {
    const res = await apiClient.post<CommunityGroup>(`/api/community/groups/${groupId}/invite/accept`, {});
    if (!res.error && res.data) patchGroupInCaches(res.data);
    return res;
  }

  async declineGroupInvite(groupId: string): Promise<ApiResponse<{ declined: boolean }>> {
    return apiClient.post<{ declined: boolean }>(`/api/community/groups/${groupId}/invite/decline`, {});
  }

  async updateGroupMemberRole(
    groupId: string,
    userId: string,
    role: 'admin' | 'member',
  ): Promise<ApiResponse<CommunityGroupMember>> {
    return apiClient.patch<CommunityGroupMember>(`/api/community/groups/${groupId}/members/${userId}`, { role });
  }

  async removeGroupMember(groupId: string, userId: string): Promise<ApiResponse<{ removed: boolean }>> {
    return apiClient.delete<{ removed: boolean }>(`/api/community/groups/${groupId}/members/${userId}`);
  }

  async joinGroup(
    id: string,
  ): Promise<ApiResponse<CommunityGroup & { joinRequested?: boolean; joinPending?: boolean }>> {
    const res = await apiClient.post<CommunityGroup & { joinRequested?: boolean; joinPending?: boolean }>(
      `/api/community/groups/${id}/join`,
      {},
    );
    if (!res.error && res.data) patchGroupInCaches(res.data);
    return res;
  }

  async getGroupJoinRequests(groupId: string): Promise<ApiResponse<GroupJoinRequestMember[]>> {
    return apiClient.get(`/api/community/groups/${groupId}/join-requests`);
  }

  async approveGroupJoinRequest(
    groupId: string,
    userId: string,
  ): Promise<ApiResponse<{ approved: boolean; groupId: string; groupName: string }>> {
    return apiClient.post(`/api/community/groups/${groupId}/join-requests/${userId}/accept`, {});
  }

  async declineGroupJoinRequest(
    groupId: string,
    userId: string,
  ): Promise<ApiResponse<{ declined: boolean }>> {
    return apiClient.post(`/api/community/groups/${groupId}/join-requests/${userId}/decline`, {});
  }

  async leaveGroup(id: string): Promise<ApiResponse<CommunityGroup>> {
    const res = await apiClient.post<CommunityGroup>(`/api/community/groups/${id}/leave`, {});
    if (!res.error && res.data) patchGroupInCaches(res.data);
    return res;
  }

  async refreshConversations(
    folder: 'primary' | 'requests' = 'primary',
  ): Promise<ApiResponse<CommunityConversation[]>> {
    const q = folder === 'requests' ? '?folder=requests' : '';
    const res = await apiClient.get<CommunityConversation[]>(`/api/community/inbox/conversations${q}`);
    if (!res.error && res.data) setGetCache(communityInboxKey(folder), res.data);
    return res;
  }

  async getConversations(folder: 'primary' | 'requests' = 'primary'): Promise<ApiResponse<CommunityConversation[]>> {
    const q = folder === 'requests' ? '?folder=requests' : '';
    const url = `/api/community/inbox/conversations${q}`;
    const key = communityInboxKey(folder);
    try {
      const data = await cachedGet(key, COMMUNITY_INBOX_TTL_MS, async () => {
        const res = await apiClient.get<CommunityConversation[]>(url);
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async startConversation(participantId: string): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.post<CommunityConversation>('/api/community/inbox/conversations', { participantId });
  }

  async startGroupConversation(name: string, participantIds: string[]): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.post<CommunityConversation>('/api/community/inbox/conversations/group', { name, participantIds });
  }

  async updateGroupConversation(
    conversationId: string,
    data: { name?: string; bio?: string | null; avatarUrl?: string | null; canAddMembers?: 'all' | 'admins'; canSendMessages?: 'all' | 'admins' },
  ): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.patch<CommunityConversation>(`/api/community/inbox/conversations/${conversationId}/group`, data);
  }

  async addGroupMembers(conversationId: string, userIds: string[]): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.post<CommunityConversation>(`/api/community/inbox/conversations/${conversationId}/group/members`, { userIds });
  }

  async removeGroupConversationMember(conversationId: string, userId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.delete<{ ok: boolean }>(`/api/community/inbox/conversations/${conversationId}/group/members/${userId}`);
  }

  async setGroupMemberRole(conversationId: string, userId: string, role: 'admin' | 'member'): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.patch<CommunityConversation>(`/api/community/inbox/conversations/${conversationId}/group/members/${userId}/role`, { role });
  }

  async getConversation(conversationId: string): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.get<CommunityConversation>(`/api/community/inbox/conversations/${conversationId}`);
  }

  async getMessages(
    conversationId: string,
    opts?: { since?: string; fresh?: boolean },
  ): Promise<ApiResponse<InboxMessagesResponse>> {
    const q = opts?.since ? `?since=${encodeURIComponent(opts.since)}` : '';
    const url = `/api/community/inbox/conversations/${conversationId}/messages${q}`;

    if (opts?.since) {
      const res = await apiClient.get<InboxMessagesResponse | CommunityMessage[]>(url, {
        cache: 'no-store',
      });
      if (res.data && Array.isArray(res.data)) {
        return { data: { messages: res.data, otherLastReadAt: null } };
      }
      return res as ApiResponse<InboxMessagesResponse>;
    }

    const key = communityMessagesKey(conversationId);
    const fetchFromApi = async () => {
      const res = await apiClient.get<InboxMessagesResponse | CommunityMessage[]>(url, {
        cache: 'no-store',
      });
      if (res.error) throw new Error(res.error);
      if (res.data && Array.isArray(res.data)) {
        return { messages: res.data, otherLastReadAt: null };
      }
      return (res.data as InboxMessagesResponse) ?? { messages: [], otherLastReadAt: null };
    };

    if (opts?.fresh) {
      try {
        const data = await fetchFromApi();
        setCommunityMessagesCache(conversationId, data);
        return { data };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        return { error: msg };
      }
    }

    try {
      const data = await cachedGet(key, COMMUNITY_MESSAGES_TTL_MS, fetchFromApi);
      return { data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async sendMessage(
    conversationId: string,
    payload: { content?: string; messageType?: MessageType; mediaUrl?: string },
  ): Promise<ApiResponse<CommunityMessage>> {
    const res = await apiClient.post<CommunityMessage>(
      `/api/community/inbox/conversations/${conversationId}/messages`,
      payload,
    );
    if (!res.error && res.data) {
      appendMessageToCache(conversationId, res.data);
    }
    return res;
  }

  async refreshMessages(conversationId: string): Promise<ApiResponse<InboxMessagesResponse>> {
    const url = `/api/community/inbox/conversations/${conversationId}/messages`;
    const res = await apiClient.get<InboxMessagesResponse | CommunityMessage[]>(url);
    if (res.error) return res as ApiResponse<InboxMessagesResponse>;
    const data =
      res.data && Array.isArray(res.data)
        ? { messages: res.data, otherLastReadAt: null }
        : ((res.data as InboxMessagesResponse) ?? { messages: [], otherLastReadAt: null });
    setCommunityMessagesCache(conversationId, data);
    return { data };
  }

  async markConversationRead(conversationId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.post<{ ok: boolean }>(`/api/community/inbox/conversations/${conversationId}/read`, {});
  }

  async acceptMessageRequest(conversationId: string): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.post<CommunityConversation>(
      `/api/community/inbox/conversations/${conversationId}/accept`,
      {},
    );
  }

  async declineMessageRequest(conversationId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.post<{ ok: boolean }>(
      `/api/community/inbox/conversations/${conversationId}/decline`,
      {},
    );
  }

  async blockUser(userId: string): Promise<ApiResponse<{ blocked: boolean }>> {
    return apiClient.post<{ blocked: boolean }>(`/api/community/users/${userId}/block`, {});
  }

  async unblockUser(userId: string): Promise<ApiResponse<{ blocked: boolean }>> {
    return apiClient.delete<{ blocked: boolean }>(`/api/community/users/${userId}/block`);
  }

  async getPrivacySettings(): Promise<ApiResponse<CommunityPrivacySettings>> {
    return apiClient.get<CommunityPrivacySettings>('/api/community/settings/privacy');
  }

  async updatePrivacySettings(data: Partial<CommunityPrivacySettings>): Promise<ApiResponse<CommunityPrivacySettings>> {
    return apiClient.patch<CommunityPrivacySettings>('/api/community/settings/privacy', data);
  }

  async getUserReposts(userId: string): Promise<ApiResponse<CommunityPost[]>> {
    return this.cachedProfilePosts(userId, 'reposts', `/api/community/users/${userId}/reposts`);
  }

  async getUserSaved(userId: string): Promise<ApiResponse<CommunityPost[]>> {
    return this.cachedProfilePosts(userId, 'saved', `/api/community/users/${userId}/saved`);
  }

  async getMutualWith(userId: string): Promise<ApiResponse<CommunityAuthor[]>> {
    return this.cachedProfileAuthors(userId, 'mutual', `/api/community/users/${userId}/mutual`);
  }

  async toggleSavePost(postId: string): Promise<ApiResponse<{ saved: boolean }>> {
    return apiClient.post<{ saved: boolean }>(`/api/community/posts/${postId}/save`, {});
  }

  async isPostSaved(postId: string): Promise<ApiResponse<{ saved: boolean }>> {
    return apiClient.get<{ saved: boolean }>(`/api/community/posts/${postId}/saved`);
  }

  async toggleRing(userId: string): Promise<ApiResponse<{ ringing: boolean }>> {
    return apiClient.post<{ ringing: boolean }>(`/api/community/users/${userId}/ring`, {});
  }

  async isRinging(userId: string): Promise<ApiResponse<{ ringing: boolean }>> {
    return apiClient.get<{ ringing: boolean }>(`/api/community/users/${userId}/ring`);
  }

  async updatePost(postId: string, data: Partial<CreatePostData>): Promise<ApiResponse<CommunityPost>> {
    return apiClient.patch<CommunityPost>(`/api/community/posts/${postId}`, data);
  }

  async refreshStoriesFeed(): Promise<ApiResponse<StoryAuthorBundle[]>> {
    const key = communityStoriesKey();
    const res = await apiClient.request<StoryAuthorBundle[]>('/api/community/stories/feed?refresh=1', {
      method: 'GET',
      timeoutMs: 30000,
    });
    if (!res.error) setGetCache(key, res.data ?? []);
    else {
      const stale = peekStaleGetCache<StoryAuthorBundle[]>(key, COMMUNITY_STORIES_STALE_MS);
      if (stale) return { data: stale };
    }
    return res;
  }

  revalidateStoriesFeed(onData: (bundles: StoryAuthorBundle[]) => void): void {
    const key = communityStoriesKey();
    revalidateGet(
      key,
      async () => {
        const res = await apiClient.request<StoryAuthorBundle[]>('/api/community/stories/feed', {
          method: 'GET',
          timeoutMs: 30000,
        });
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      },
      onData,
    );
  }

  async getStoriesFeed(): Promise<ApiResponse<StoryAuthorBundle[]>> {
    const key = communityStoriesKey();
    try {
      const data = await cachedGet(key, COMMUNITY_STORIES_TTL_MS, async () => {
        const res = await apiClient.request<StoryAuthorBundle[]>('/api/community/stories/feed', {
          method: 'GET',
          timeoutMs: 30000,
        });
        if (res.error) throw new Error(res.error);
        return res.data ?? [];
      });
      return { data };
    } catch (e) {
      const stale = peekStaleGetCache<StoryAuthorBundle[]>(key, COMMUNITY_STORIES_STALE_MS);
      if (stale) return { data: stale };
      const msg = e instanceof Error ? e.message : 'Request failed';
      return { error: msg };
    }
  }

  async getUserStories(userId: string): Promise<ApiResponse<StoryAuthorBundle | null>> {
    return apiClient.get<StoryAuthorBundle | null>(`/api/community/users/${userId}/stories`);
  }

  async createStory(mediaUrl: string, mediaType: 'image' | 'video' = 'image'): Promise<ApiResponse<{ id: string }>> {
    const res = await apiClient.post(
      '/api/community/stories',
      { mediaUrl, mediaType },
      { timeoutMs: mediaType === 'video' ? 120_000 : 45_000 },
    );
    if (!res.error) invalidateGetCache(communityStoriesKey());
    return res;
  }

  async viewStory(storyId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.post(`/api/community/stories/${storyId}/view`, {});
  }

  async deleteStory(storyId: string): Promise<ApiResponse<{ ok: boolean }>> {
    const res = await apiClient.delete(`/api/community/stories/${storyId}`);
    if (!res.error) invalidateGetCache(communityStoriesKey());
    return res;
  }

  async getStoryViewers(storyId: string): Promise<ApiResponse<StoryViewer[]>> {
    return apiClient.get<StoryViewer[]>(`/api/community/stories/${storyId}/viewers`);
  }

  async reactStory(storyId: string, emoji: ReactionEmoji = 'like'): Promise<ApiResponse<{ ok: boolean; emoji: string }>> {
    return apiClient.post(`/api/community/stories/${storyId}/react`, { emoji });
  }

  async unreactStory(storyId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.delete(`/api/community/stories/${storyId}/react`);
  }

  async getStoryReplies(storyId: string): Promise<ApiResponse<StoryReply[]>> {
    return apiClient.get<StoryReply[]>(`/api/community/stories/${storyId}/replies`);
  }

  async replyToStory(storyId: string, content: string): Promise<ApiResponse<StoryReply>> {
    return apiClient.post<StoryReply>(`/api/community/stories/${storyId}/replies`, { content });
  }
}

export const communityService = new CommunityService();
export default communityService;
