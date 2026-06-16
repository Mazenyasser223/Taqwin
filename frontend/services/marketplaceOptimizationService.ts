import apiClient, { ApiResponse } from './api';
import type { Product } from '../types';

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title?: string | null;
  body: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  user?: { id: string; name: string | null; avatarUrl?: string | null };
}

export interface ReviewListResponse {
  items: ProductReview[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ReviewEligibility {
  canReview: boolean;
  reason?: string;
  orderId?: string;
  reviewId?: string;
}

export interface WishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: Product;
}

export interface ReorderSuggestion {
  productId: string;
  product: Product;
  lastOrderId: string;
  lastPurchasedAt: string;
  daysSincePurchase: number;
  suggestedQuantity: number;
}

export interface ProductSubscription {
  id: string;
  productId: string;
  quantity: number;
  intervalDays: number;
  status: 'active' | 'paused' | 'cancelled';
  nextDeliveryAt: string;
  lastOrderId?: string | null;
  pausedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  product: Product;
}

class MarketplaceOptimizationService {
  async getReviews(productId: string, page = 1): Promise<ApiResponse<ReviewListResponse>> {
    return apiClient.get<ReviewListResponse>(
      `/api/marketplace/products/${productId}/reviews?page=${page}&limit=10`,
    );
  }

  async getReviewEligibility(productId: string): Promise<ApiResponse<ReviewEligibility>> {
    return apiClient.get<ReviewEligibility>(
      `/api/marketplace/products/${productId}/reviews/eligibility`,
    );
  }

  async submitReview(
    productId: string,
    data: { rating: number; title?: string; body: string },
  ): Promise<ApiResponse<ProductReview>> {
    return apiClient.post<ProductReview>(`/api/marketplace/products/${productId}/reviews`, data);
  }

  async voteReview(reviewId: string, helpful = true): Promise<ApiResponse<{ reviewId: string; helpfulCount: number }>> {
    return apiClient.post(`/api/marketplace/reviews/${reviewId}/vote`, { helpful });
  }

  async getWishlist(): Promise<ApiResponse<{ items: WishlistItem[] }>> {
    return apiClient.get<{ items: WishlistItem[] }>('/api/marketplace/wishlist');
  }

  async checkWishlist(productId: string): Promise<ApiResponse<{ saved: boolean }>> {
    return apiClient.get<{ saved: boolean }>(`/api/marketplace/wishlist/check/${productId}`);
  }

  async addToWishlist(productId: string): Promise<ApiResponse<{ id: string; productId: string; alreadySaved: boolean }>> {
    return apiClient.post(`/api/marketplace/wishlist/${productId}`, {});
  }

  async removeFromWishlist(productId: string): Promise<ApiResponse<{ removed: boolean }>> {
    return apiClient.delete(`/api/marketplace/wishlist/${productId}`);
  }

  async getReorderSuggestions(): Promise<ApiResponse<{ suggestions: ReorderSuggestion[] }>> {
    return apiClient.get<{ suggestions: ReorderSuggestion[] }>('/api/marketplace/reorder/suggestions');
  }

  async getSubscriptions(): Promise<ApiResponse<{ items: ProductSubscription[] }>> {
    return apiClient.get<{ items: ProductSubscription[] }>('/api/marketplace/subscriptions');
  }

  async createSubscription(data: {
    productId: string;
    quantity?: number;
    intervalDays?: number;
  }): Promise<ApiResponse<ProductSubscription>> {
    return apiClient.post<ProductSubscription>('/api/marketplace/subscriptions', data);
  }

  async updateSubscription(
    id: string,
    data: { quantity?: number; intervalDays?: number; status?: 'active' | 'paused' },
  ): Promise<ApiResponse<ProductSubscription>> {
    return apiClient.patch<ProductSubscription>(`/api/marketplace/subscriptions/${id}`, data);
  }

  async cancelSubscription(id: string): Promise<ApiResponse<{ cancelled: boolean }>> {
    return apiClient.delete(`/api/marketplace/subscriptions/${id}`);
  }
}

export const marketplaceOptimizationService = new MarketplaceOptimizationService();
export default marketplaceOptimizationService;
