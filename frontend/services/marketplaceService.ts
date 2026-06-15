import apiClient, { ApiResponse } from './api';
import type {
  Product,
  Order,
  ShopCategory,
  ProductListResponse,
  CheckoutPreview,
  ShippingAddress,
  PaymentMethod,
  CheckoutConfig,
  StripeCheckoutSession,
} from '../types';
import type { ShippingRules } from '../lib/shopShipping';

export interface CreateOrderData {
  items: { productId: string; quantity: number }[];
  shipping: ShippingAddress;
  paymentMethod?: PaymentMethod;
  aiBundle?: {
    productIds: string[];
    sessionId?: string;
    abVariant?: string;
    experimentId?: string;
  };
  commerceSource?:
    | 'ai_bundle'
    | 'ai_recommendation'
    | 'search'
    | 'category'
    | 'featured'
    | 'direct';
  couponCode?: string;
  loyaltyPointsUsed?: number;
  funnelSessionId?: string;
}

export interface PaymentSessionResponse {
  orderId: string;
  checkoutUrl: string;
  paymentReference?: string;
  paymobOrderId?: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  currency: string;
  paymobAmountCents: number;
}

export interface ProductFilters {
  search?: string;
  brand?: string;
  category?: string;
  categoryId?: string;
  excludeId?: string;
  onSale?: boolean;
  page?: number;
  limit?: number;
}

class MarketplaceService {
  async getCategories(): Promise<ApiResponse<ShopCategory[]>> {
    return apiClient.get<ShopCategory[]>('/api/marketplace/categories');
  }

  async getSearchSuggestions(limit = 6): Promise<
    ApiResponse<
      Array<{ labelEn: string; labelAr: string; query: string }>
    >
  > {
    return apiClient.get(`/api/marketplace/search/suggestions?limit=${limit}`);
  }

  async getProducts(filters?: ProductFilters): Promise<ApiResponse<ProductListResponse>> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.brand) params.set('brand', filters.brand);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    if (filters?.excludeId) params.set('excludeId', filters.excludeId);
    if (filters?.onSale) params.set('onSale', 'true');
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return apiClient.get<ProductListResponse>(`/api/marketplace/products${qs ? `?${qs}` : ''}`);
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return apiClient.get<Product>(`/api/marketplace/products/${id}`);
  }

  async getProductBySlug(slug: string): Promise<ApiResponse<Product>> {
    return apiClient.get<Product>(`/api/marketplace/products/by-slug/${encodeURIComponent(slug)}`);
  }

  async getShippingRules(): Promise<ApiResponse<ShippingRules>> {
    return apiClient.get<ShippingRules>('/api/marketplace/shipping-rules');
  }

  async previewCheckout(data: {
    items: { productId: string; quantity: number }[];
    governorate: string;
  }): Promise<ApiResponse<CheckoutPreview>> {
    return apiClient.post<CheckoutPreview>('/api/marketplace/checkout/preview', data);
  }

  async getCheckoutConfig(): Promise<ApiResponse<CheckoutConfig>> {
    return apiClient.get<CheckoutConfig>('/api/marketplace/checkout/config');
  }

  async createOrder(data: CreateOrderData & { paymentMethod: PaymentMethod }): Promise<ApiResponse<Order>> {
    return apiClient.post<Order>('/api/marketplace/orders', data);
  }

  async createPaymentSession(data: CreateOrderData): Promise<ApiResponse<PaymentSessionResponse>> {
    return apiClient.post<PaymentSessionResponse>('/api/marketplace/payments/create', data);
  }

  async validateCoupon(
    code: string,
    items: { productId: string; quantity: number }[],
  ): Promise<
    ApiResponse<{
      valid: boolean;
      code?: string;
      discountAmount?: number;
      subtotalAfter?: number;
      error?: string;
    }>
  > {
    return apiClient.post('/api/marketplace/marketing/coupons/validate', { code, items });
  }

  async confirmPayment(orderId: string): Promise<ApiResponse<Order>> {
    return apiClient.post<Order>(`/api/marketplace/orders/${orderId}/confirm-payment`, {});
  }

  async createStripeSession(orderId: string): Promise<ApiResponse<StripeCheckoutSession>> {
    return apiClient.post<StripeCheckoutSession>(`/api/marketplace/orders/${orderId}/stripe-session`, {});
  }

  async syncStripePayment(orderId: string, sessionId: string): Promise<ApiResponse<Order>> {
    return apiClient.post<Order>(`/api/marketplace/orders/${orderId}/stripe-sync`, { sessionId });
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
