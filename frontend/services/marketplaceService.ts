import apiClient, { ApiResponse } from './api';
import type { Product, Order, OrderItem } from '../types';

export interface CreateOrderData {
  items: { productId: string; quantity: number }[];
}

class MarketplaceService {
  async getProducts(): Promise<ApiResponse<Product[]>> {
    return apiClient.get<Product[]>('/api/marketplace/products');
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return apiClient.get<Product>(`/api/marketplace/products/${id}`);
  }

  async createOrder(data: CreateOrderData): Promise<ApiResponse<Order>> {
    return apiClient.post<Order>('/api/marketplace/orders', data);
  }

  async getMyOrders(): Promise<ApiResponse<Order[]>> {
    return apiClient.get<Order[]>('/api/marketplace/orders/me');
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    return apiClient.get<Order>(`/api/marketplace/orders/${id}`);
  }
}

export const marketplaceService = new MarketplaceService();
export default marketplaceService;
