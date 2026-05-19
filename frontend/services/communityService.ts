import apiClient, { ApiResponse } from './api';
import type {
  CommunityPost,
  CommunityComment,
  CommunityGroup,
  CommunityConversation,
  CommunityMessage,
  CommunityAuthor,
  CommunityUserProfile,
  ReactionEmoji,
  Profile,
} from '../types';

export type FeedFilter = 'for_you' | 'following' | 'coaches' | 'athletes' | 'trending';

export interface CreatePostData {
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  groupId?: string;
}

export interface CreateCommentData {
  content: string;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  imageUrl?: string;
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

  async getGroups(): Promise<ApiResponse<CommunityGroup[]>> {
    return apiClient.get<CommunityGroup[]>('/api/community/groups');
  }

  async createGroup(data: CreateGroupData): Promise<ApiResponse<CommunityGroup>> {
    return apiClient.post<CommunityGroup>('/api/community/groups', data);
  }

  async joinGroup(id: string): Promise<ApiResponse<{ joined: boolean }>> {
    return apiClient.post<{ joined: boolean }>(`/api/community/groups/${id}/join`, {});
  }

  async leaveGroup(id: string): Promise<ApiResponse<{ joined: boolean }>> {
    return apiClient.post<{ joined: boolean }>(`/api/community/groups/${id}/leave`, {});
  }

  async getConversations(): Promise<ApiResponse<CommunityConversation[]>> {
    return apiClient.get<CommunityConversation[]>('/api/community/inbox/conversations');
  }

  async startConversation(participantId: string): Promise<ApiResponse<CommunityConversation>> {
    return apiClient.post<CommunityConversation>('/api/community/inbox/conversations', { participantId });
  }

  async getMessages(conversationId: string): Promise<ApiResponse<CommunityMessage[]>> {
    return apiClient.get<CommunityMessage[]>(`/api/community/inbox/conversations/${conversationId}/messages`);
  }

  async sendMessage(conversationId: string, content: string): Promise<ApiResponse<CommunityMessage>> {
    return apiClient.post<CommunityMessage>(`/api/community/inbox/conversations/${conversationId}/messages`, {
      content,
    });
  }

  async markConversationRead(conversationId: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.post<{ ok: boolean }>(`/api/community/inbox/conversations/${conversationId}/read`, {});
  }
}

export const communityService = new CommunityService();
export default communityService;
