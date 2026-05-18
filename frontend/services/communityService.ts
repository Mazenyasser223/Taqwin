import apiClient, { ApiResponse } from './api';
import type { CommunityPost, CommunityComment } from '../types';

export interface CreatePostData {
  content: string;
  imageUrl?: string;
}

export interface CreateCommentData {
  content: string;
}

class CommunityService {
  async getPosts(): Promise<ApiResponse<CommunityPost[]>> {
    return apiClient.get<CommunityPost[]>('/api/community/posts');
  }

  async getPost(id: string): Promise<ApiResponse<CommunityPost>> {
    return apiClient.get<CommunityPost>(`/api/community/posts/${id}`);
  }

  async createPost(data: CreatePostData): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post<CommunityPost>('/api/community/posts', data);
  }

  async likePost(id: string): Promise<ApiResponse<CommunityPost>> {
    return apiClient.post<CommunityPost>(`/api/community/posts/${id}/like`, {});
  }

  async getComments(postId: string): Promise<ApiResponse<CommunityComment[]>> {
    return apiClient.get<CommunityComment[]>(`/api/community/posts/${postId}/comments`);
  }

  async addComment(postId: string, data: CreateCommentData): Promise<ApiResponse<CommunityComment>> {
    return apiClient.post<CommunityComment>(`/api/community/posts/${postId}/comments`, data);
  }

  async deletePost(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/community/posts/${id}`);
  }
}

export const communityService = new CommunityService();
export default communityService;
