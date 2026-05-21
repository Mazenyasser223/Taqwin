import apiClient, { ApiResponse } from './api';
import type {
  CommunityPost,
  CommunityComment,
  CommunityGroup,
  CommunityGroupMember,
  CommunityConversation,
  CommunityMessage,
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
  GroupInvitePermission,
  PostMediaItem,
} from '../types';

export type FeedFilter = 'for_you' | 'following' | 'coaches' | 'athletes' | 'trending';

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
}

class CommunityService {
  async getPosts(
    feed: FeedFilter = 'for_you',
    opts?: { groupId?: string; authorId?: string },
  ): Promise<ApiResponse<CommunityPost[]>> {
    const params = new URLSearchParams({ feed });
    if (opts?.groupId) params.set('groupId', opts.groupId);
    if (opts?.authorId) params.set('authorId', opts.authorId);
    return apiClient.get<CommunityPost[]>(`/api/community/posts?${params}`);
  }

  async getPost(id: string): Promise<ApiResponse<CommunityPost>> {
    return apiClient.get<CommunityPost>(`/api/community/posts/${id}`);
  }

  async createPost(data: CreatePostData): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post<CommunityPost>('/api/community/posts', data);
  }

  async deletePost(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/community/posts/${id}`);
  }

  async likePost(id: string): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post<CommunityPost>(`/api/community/posts/${id}/like`, {});
  }

  async reactPost(id: string, emoji: ReactionEmoji): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post<CommunityPost>(`/api/community/posts/${id}/react`, { emoji });
  }

  async getUserProfile(userId: string): Promise<ApiResponse<CommunityUserProfile>> {
    return apiClient.get<CommunityUserProfile>(`/api/community/users/${userId}/profile`);
  }

  async updateMyProfile(data: {
    bio?: string;
    displayName?: string;
    avatarUrl?: string;
    coverUrl?: string;
  }): Promise<ApiResponse<Profile>> {
    return apiClient.patch<Profile>('/api/community/users/me/profile', data);
  }

  async getFollowers(userId: string): Promise<ApiResponse<CommunityAuthor[]>> {
    return apiClient.get<CommunityAuthor[]>(`/api/community/users/${userId}/followers`);
  }

  async getFollowing(userId: string): Promise<ApiResponse<CommunityAuthor[]>> {
    return apiClient.get<CommunityAuthor[]>(`/api/community/users/${userId}/following`);
  }

  async repostPost(id: string): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post<CommunityPost>(`/api/community/posts/${id}/repost`, {});
  }

  async getComments(postId: string): Promise<ApiResponse<CommunityComment[]>> {
    return apiClient.get<CommunityComment[]>(`/api/community/posts/${postId}/comments`);
  }

  async addComment(postId: string, data: CreateCommentData): Promise<ApiResponse<CommunityComment>> {
    return apiClient.post<CommunityComment>(`/api/community/posts/${postId}/comments`, data);
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
    ApiResponse<{ following: boolean; followStatus: string; requestSent?: boolean }>
  > {
    return apiClient.post(`/api/community/follow/${userId}`, {});
  }

  async acceptFollowRequest(followerId: string): Promise<ApiResponse<{ following: boolean; followStatus: string }>> {
    return apiClient.post(`/api/community/follow-requests/${followerId}/accept`, {});
  }

  async declineFollowRequest(followerId: string): Promise<ApiResponse<{ following: boolean; followStatus: string }>> {
    return apiClient.post(`/api/community/follow-requests/${followerId}/decline`, {});
  }

  async searchUsers(q: string): Promise<ApiResponse<CommunityAuthor[]>> {
    return apiClient.get<CommunityAuthor[]>(`/api/community/users/search?q=${encodeURIComponent(q)}`);
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
    return apiClient.get<CommunityGroup[]>('/api/community/groups');
  }

  async getGroup(id: string): Promise<ApiResponse<CommunityGroup>> {
    return apiClient.get<CommunityGroup>(`/api/community/groups/${id}`);
  }

  async createGroup(data: CreateGroupData): Promise<ApiResponse<CommunityGroup>> {
    return apiClient.post<CommunityGroup>('/api/community/groups', data);
  }

  async updateGroup(id: string, data: UpdateGroupData): Promise<ApiResponse<CommunityGroup>> {
    return apiClient.patch<CommunityGroup>(`/api/community/groups/${id}`, data);
  }

  async deleteGroup(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete<{ deleted: boolean }>(`/api/community/groups/${id}`);
  }

  async getGroupMembers(id: string): Promise<ApiResponse<CommunityGroupMember[]>> {
    return apiClient.get<CommunityGroupMember[]>(`/api/community/groups/${id}/members`);
  }

  async addGroupMember(groupId: string, userId: string): Promise<ApiResponse<CommunityGroupMember>> {
    return apiClient.post<CommunityGroupMember>(`/api/community/groups/${groupId}/members`, { userId });
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

  async joinGroup(id: string): Promise<ApiResponse<CommunityGroup>> {
    return apiClient.post<CommunityGroup>(`/api/community/groups/${id}/join`, {});
  }

  async leaveGroup(id: string): Promise<ApiResponse<CommunityGroup>> {
    return apiClient.post<CommunityGroup>(`/api/community/groups/${id}/leave`, {});
  }

  async getConversations(folder: 'primary' | 'requests' = 'primary'): Promise<ApiResponse<CommunityConversation[]>> {
    const q = folder === 'requests' ? '?folder=requests' : '';
    return apiClient.get<CommunityConversation[]>(`/api/community/inbox/conversations${q}`);
  }

  async startConversation(participantId: string): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.post<CommunityConversation>('/api/community/inbox/conversations', { participantId });
  }

  async getMessages(conversationId: string): Promise<ApiResponse<CommunityMessage[]>> {
    return apiClient.get<CommunityMessage[]>(`/api/community/inbox/conversations/${conversationId}/messages`);
  }

  async sendMessage(
    conversationId: string,
    payload: { content?: string; messageType?: MessageType; mediaUrl?: string },
  ): Promise<ApiResponse<CommunityMessage>> {
    return apiClient.post<CommunityMessage>(`/api/community/inbox/conversations/${conversationId}/messages`, payload);
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
    return apiClient.get<CommunityPost[]>(`/api/community/users/${userId}/reposts`);
  }

  async getUserSaved(userId: string): Promise<ApiResponse<CommunityPost[]>> {
    return apiClient.get<CommunityPost[]>(`/api/community/users/${userId}/saved`);
  }

  async getMutualWith(userId: string): Promise<ApiResponse<CommunityAuthor[]>> {
    return apiClient.get<CommunityAuthor[]>(`/api/community/users/${userId}/mutual`);
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

  async getStoriesFeed(): Promise<ApiResponse<StoryAuthorBundle[]>> {
    return apiClient.get<StoryAuthorBundle[]>('/api/community/stories/feed');
  }

  async createStory(mediaUrl: string, mediaType: 'image' | 'video' = 'image'): Promise<ApiResponse<{ id: string }>> {
    return apiClient.post('/api/community/stories', { mediaUrl, mediaType });
  }

  async viewStory(storyId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.post(`/api/community/stories/${storyId}/view`, {});
  }

  async deleteStory(storyId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.delete(`/api/community/stories/${storyId}`);
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
