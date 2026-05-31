import apiClient, { ApiResponse } from './api';
import type { Product, Order, ShopCategory, ProductListResponse } from '../types';

export interface CreateOrderData {
  items: { productId: string; quantity: number }[];
}

export interface ProductFilters {
  search?: string;
  brand?: string;
  category?: string;
  onSale?: boolean;
  page?: number;
  limit?: number;
}

class MarketplaceService {
  async getCategories(): Promise<ApiResponse<ShopCategory[]>> {
    return apiClient.get<ShopCategory[]>('/api/marketplace/categories');
  }

  async getProducts(filters?: ProductFilters): Promise<ApiResponse<ProductListResponse>> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.brand) params.set('brand', filters.brand);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.onSale) params.set('onSale', 'true');
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return apiClient.get<ProductListResponse>(`/api/marketplace/products${qs ? `?${qs}` : ''}`);
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return apiClient.get<Product>(`/api/marketplace/products/${id}`);
  }

  async createOrder(data: CreateOrderData): Promise<ApiResponse<Order>> {
    return apiClient.post<Order>('/api/marketplace/orders', data);
  }

  async getMyOrders(): Promise<ApiResponse<Order[]>> {
    const res = await apiClient.get<Order[] | Order>('/api/marketplace/orders/me');
    if (res.error) return { error: res.error };
    const raw = res.data;
    if (Array.isArray(raw)) return { data: raw };
    return { data: [] };
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    return apiClient.get<Order>(`/api/marketplace/orders/${id}`);
  }
}

export const marketplaceService = new MarketplaceService();
export default marketplaceService;
