import apiClient, { ApiResponse } from './api';
import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';
import type { Product, Order, ShopCategory, OrderStatus, PaymentStatus } from '../types';

export interface AdminProductListResponse {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface AdminOrderListResponse {
  items: AdminOrder[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface AdminOrder extends Order {
  user?: { id: string; email: string };
}

export interface AdminShopDashboard {
  revenue: number;
  ordersCount: number;
  productsCount: number;
  pendingOrders: number;
  lowStockThreshold: number;
  lowStockProducts: Array<{
    id: string;
    name: string;
    nameAr?: string | null;
    brand: string;
    stock: number;
    price: number;
    imageUrl?: string | null;
  }>;
  topProducts: Array<{
    productId: string;
    quantitySold: number;
    product: {
      id: string;
      name: string;
      nameAr?: string | null;
      brand: string;
      imageUrl?: string | null;
      price: number;
    } | null;
  }>;
  revenueByMonth: Array<{ month: string; revenue: number; orders: number }>;
  monthRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  conversionRate: number;
  averageOrderValue: number;
  monthPaidOrders: number;
  monthOrders: number;
}

export interface AdminShopSettings {
  lowStockThreshold: number;
}

export interface AiCommerceAnalytics {
  periodDays: number;
  since: string;
  counts: Record<string, number>;
  recommendationsShown: number;
  bundlesAdded: number;
  aiOrders: number;
  aiRevenue: number;
  conversionRate: number;
  bundleConversionRate: number;
  topProducts: Array<{
    id: string;
    name: string;
    nameAr?: string | null;
    price: number;
    imageUrl?: string | null;
    salesCount?: number;
    eventCount: number;
  }>;
  revenueBySource?: {
    totalRevenue: number;
    aiSharePercent: number;
    bySource: Array<{
      source: string;
      labelEn: string;
      labelAr: string;
      revenue: number;
      orders: number;
      sharePercent: number;
    }>;
  };
  abTest?: {
    experimentId: string;
    slug: string;
    name: string;
    status: string;
    winnerVariantKey: string | null;
    minSamples: number;
    variants: Array<{
      variantKey: string;
      variantName: string;
      weight: number;
      isWinner: boolean;
      shown: number;
      clicked: number;
      bundleAdded: number;
      purchased: number;
      revenue: number;
      ctr: number;
      addToCartRate: number;
      purchaseRate: number;
      revenuePerShown: number;
    }>;
  } | null;
  mostWishlisted?: Array<{
    id: string;
    name: string;
    nameAr?: string | null;
    price: number;
    imageUrl?: string | null;
    wishlistCount: number;
    salesCount?: number;
    avgRating?: number | null;
  }>;
  feedbackPositive?: number;
  feedbackNegative?: number;
}

export interface ConversionFunnel {
  periodDays: number;
  since: string;
  steps: Array<{
    step: string;
    sessions: number;
    conversionFromPrev: number;
    conversionFromVisit: number;
  }>;
  visitCount: number;
  paidCount: number;
  overallConversion: number;
  migrationPending?: boolean;
}

export interface DataQualityReport {
  generatedAt: string;
  qualityScore: number;
  summary: {
    activeProducts: number;
    categories: number;
    featuredCount: number;
    featuredIssues: number;
    missingImages: number;
    missingBrand: number;
    missingCategory: number;
    supplementsMissingNutrition: number;
    emptyCategories: number;
  };
  featuredIssues: Array<{ id: string; name: string; brand?: string; imageUrl?: string | null; stock?: number }>;
  missingImages: Array<{ id: string; name: string; brand?: string }>;
  missingBrand: Array<{ id: string; name: string }>;
  missingCategory: Array<{ id: string; name: string; brand?: string }>;
  supplementsMissingNutrition: Array<{ id: string; name: string; brand?: string }>;
  emptyCategories: Array<{ id: string; slug: string; nameEn: string; nameAr?: string | null }>;
  topBrands: Array<{ brand: string; productCount: number }>;
  weeklyChecklist: string[];
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderTotal: number;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number;
  isActive: boolean;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
}

export interface AdminCategory extends ShopCategory {
  productCount?: number;
  children?: AdminCategory[];
}

export interface CreateProductPayload {
  name: string;
  nameAr?: string | null;
  brand: string;
  categoryId?: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  slug?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  stock?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> {}

export type BulkProductAction = 'archive' | 'restore' | 'setStock' | 'setPrice';

export interface CreateCategoryPayload {
  nameEn: string;
  nameAr?: string | null;
  icon?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryPayload extends Partial<CreateCategoryPayload> {}

export interface ProductFilters {
  search?: string;
  brand?: string;
  categoryId?: string;
  active?: 'true' | 'false' | 'all';
  lowStock?: boolean;
  page?: number;
  limit?: number;
}

export interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  page?: number;
  limit?: number;
}

const PAGE_SIZE = 24;

class AdminShopService {
  private adminGet<T>(endpoint: string): Promise<ApiResponse<T>> {
    return apiClient.get<T>(endpoint, { timeoutMs: 45000 });
  }

  private buildQuery(params: URLSearchParams) {
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  async getDashboard(): Promise<ApiResponse<AdminShopDashboard>> {
    return this.adminGet<AdminShopDashboard>('/api/admin/shop/dashboard');
  }

  async getAiCommerce(days = 30): Promise<ApiResponse<AiCommerceAnalytics>> {
    return this.adminGet<AiCommerceAnalytics>(`/api/admin/shop/ai-commerce?days=${days}`);
  }

  async getConversionFunnel(days = 30): Promise<ApiResponse<ConversionFunnel>> {
    return this.adminGet<ConversionFunnel>(`/api/admin/shop/conversion-funnel?days=${days}`);
  }

  async getDataQuality(): Promise<ApiResponse<DataQualityReport>> {
    return this.adminGet<DataQualityReport>('/api/admin/shop/data-quality');
  }

  async getMarketingCoupons(): Promise<ApiResponse<{ items: AdminCoupon[] }>> {
    return this.adminGet<{ items: AdminCoupon[] }>('/api/admin/shop/marketing/coupons');
  }

  async getSettings(): Promise<ApiResponse<AdminShopSettings>> {
    return this.adminGet<AdminShopSettings>('/api/admin/shop/settings');
  }

  async updateSettings(data: { lowStockThreshold: number }): Promise<ApiResponse<AdminShopSettings>> {
    return apiClient.patch<AdminShopSettings>('/api/admin/shop/settings', data);
  }

  async getProducts(filters?: ProductFilters): Promise<ApiResponse<AdminProductListResponse>> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.brand) params.set('brand', filters.brand);
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    if (filters?.active) params.set('active', filters.active);
    if (filters?.lowStock) params.set('lowStock', 'true');
    params.set('page', String(filters?.page ?? 1));
    params.set('limit', String(filters?.limit ?? PAGE_SIZE));
    return this.adminGet<AdminProductListResponse>(`/api/admin/shop/products${this.buildQuery(params)}`);
  }

  async getProductBrands(): Promise<ApiResponse<{ brands: string[] }>> {
    return this.adminGet<{ brands: string[] }>('/api/admin/shop/products/brands');
  }

  async createProduct(data: CreateProductPayload): Promise<ApiResponse<Product>> {
    return apiClient.post<Product>('/api/admin/shop/products', data);
  }

  async updateProduct(id: string, data: UpdateProductPayload): Promise<ApiResponse<Product>> {
    return apiClient.put<Product>(`/api/admin/shop/products/${id}`, data);
  }

  async archiveProduct(id: string): Promise<ApiResponse<Product>> {
    return apiClient.delete<Product>(`/api/admin/shop/products/${id}`);
  }

  async bulkProducts(
    ids: string[],
    action: BulkProductAction,
    value?: number,
  ): Promise<ApiResponse<{ updated: number }>> {
    return apiClient.patch<{ updated: number }>('/api/admin/shop/products/bulk', { ids, action, value });
  }

  async getOrders(filters?: OrderFilters): Promise<ApiResponse<AdminOrderListResponse>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
    if (filters?.search) params.set('search', filters.search);
    params.set('page', String(filters?.page ?? 1));
    params.set('limit', String(filters?.limit ?? PAGE_SIZE));
    return this.adminGet<AdminOrderListResponse>(`/api/admin/shop/orders${this.buildQuery(params)}`);
  }

  async getOrder(id: string): Promise<ApiResponse<AdminOrder>> {
    return this.adminGet<AdminOrder>(`/api/admin/shop/orders/${id}`);
  }

  async updateOrderStatus(
    id: string,
    data: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      carrier?: string;
      trackingNumber?: string;
    },
  ): Promise<ApiResponse<AdminOrder>> {
    return apiClient.patch<AdminOrder>(`/api/admin/shop/orders/${id}/status`, data);
  }

  async getCategories(): Promise<ApiResponse<AdminCategory[]>> {
    return this.adminGet<AdminCategory[]>('/api/admin/shop/categories');
  }

  async createCategory(data: CreateCategoryPayload): Promise<ApiResponse<AdminCategory>> {
    return apiClient.post<AdminCategory>('/api/admin/shop/categories', data);
  }

  async updateCategory(id: string, data: UpdateCategoryPayload): Promise<ApiResponse<AdminCategory>> {
    return apiClient.put<AdminCategory>(`/api/admin/shop/categories/${id}`, data);
  }

  async deleteCategory(id: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.delete<{ ok: boolean }>(`/api/admin/shop/categories/${id}`);
  }

  async reorderCategories(items: Array<{ id: string; sortOrder: number }>): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.put<{ ok: boolean }>('/api/admin/shop/categories/reorder', { items });
  }

  async downloadExport(endpoint: string, filename: string): Promise<{ error?: string }> {
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (!res.ok) {
        let msg = 'Export failed';
        try {
          const body = await res.json();
          if (body && typeof body.error === 'string') msg = body.error;
        } catch {
          /* non-json */
        }
        return { error: msg };
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Export failed' };
    }
  }

  exportProductsCsv(filters?: ProductFilters) {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.brand) params.set('brand', filters.brand);
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    if (filters?.active) params.set('active', filters.active);
    if (filters?.lowStock) params.set('lowStock', 'true');
    return this.downloadExport(`/api/admin/shop/products/export${this.buildQuery(params)}`, 'products.csv');
  }

  exportOrdersCsv(filters?: OrderFilters) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
    if (filters?.search) params.set('search', filters.search);
    return this.downloadExport(`/api/admin/shop/orders/export${this.buildQuery(params)}`, 'orders.csv');
  }
}

export const adminShopService = new AdminShopService();
export default adminShopService;
