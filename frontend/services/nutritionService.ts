import apiClient, { ApiResponse } from './api';
import {
  fetchFoodDetailsDeduped,
  peekFoodDetails as peekCachedFoodDetails,
  prefetchFoodDetails as prefetchCachedFoodDetails,
} from './nutritionDetailsCache';
import {
  peekNutritionSearchCached,
  setNutritionSearchCached,
} from './nutritionSearchSessionCache';
import { peekGetCache, revalidateGet, setGetCache } from '../lib/apiGetCache';
import type {
  FoodItem,
  FoodLog,
  FdcCategory,
  FdcFoodPreview,
  FdcFoodDetails,
  FdcSearchResult,
  FoodSort,
} from '../types';

export interface LogFoodData {
  foodItemId: string;
  grams: number;
  loggedAt?: string;
}

export interface DailyNutritionSummary {
  date: string;
  logCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodListFilters {
  search?: string;
  category?: string;
  minProtein?: number;
  maxCalories?: number;
  minCalories?: number;
  maxCarbs?: number;
  sort?: FoodSort;
}

export interface WebtebSearchParams {
  q?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  minProtein?: number;
  maxProtein?: number;
  minCalories?: number;
  maxCalories?: number;
  minCarbs?: number;
  maxCarbs?: number;
  minFat?: number;
  maxFat?: number;
  sort?: FoodSort;
  sort2?: FoodSort;
}

type CategoriesPayload = { categories: FdcCategory[]; totalFoods?: number };

const CATEGORIES_CACHE_KEY = 'nutrition:webteb:categories';
const CATEGORIES_TTL_MS = 60 * 60 * 1000;
const CATEGORIES_STALE_MS = 24 * 60 * 60 * 1000;

class NutritionService {
  peekSearchFoods(params: WebtebSearchParams): ApiResponse<FdcSearchResult> | null {
    const path = this.buildSearchPath(params);
    return peekNutritionSearchCached(params, path);
  }

  prefetchSearchFoods(params: WebtebSearchParams): void {
    if (this.peekSearchFoods(params)?.data) return;
    void this.searchFoods(params);
  }

  prefetchFoodDetails(webtebId: number): void {
    if (!webtebId) return;
    prefetchCachedFoodDetails(webtebId, () => this.fetchFoodDetailsFromApi(webtebId));
  }

  peekFoodDetails(webtebId: number): FdcFoodDetails | null {
    return peekCachedFoodDetails(webtebId);
  }

  private buildSearchPath(params: WebtebSearchParams): string {
    const q = new URLSearchParams();
    if (params.q?.trim()) q.set('q', params.q.trim());
    if (params.categoryId) q.set('categoryId', params.categoryId);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.minProtein != null) q.set('minProtein', String(params.minProtein));
    if (params.maxProtein != null) q.set('maxProtein', String(params.maxProtein));
    if (params.minCalories != null) q.set('minCalories', String(params.minCalories));
    if (params.maxCalories != null) q.set('maxCalories', String(params.maxCalories));
    if (params.minCarbs != null) q.set('minCarbs', String(params.minCarbs));
    if (params.maxCarbs != null) q.set('maxCarbs', String(params.maxCarbs));
    if (params.minFat != null) q.set('minFat', String(params.minFat));
    if (params.maxFat != null) q.set('maxFat', String(params.maxFat));
    if (params.sort && params.sort !== 'name') q.set('sort', params.sort);
    if (params.sort2 && params.sort2 !== 'name') q.set('sort2', params.sort2);
    return `/api/nutrition/webteb/search?${q}`;
  }

  private async fetchFoodDetailsFromApi(webtebId: number): Promise<ApiResponse<FdcFoodDetails>> {
    return apiClient.get<FdcFoodDetails>(`/api/nutrition/webteb/${webtebId}`);
  }

  async getFoodItems(filters?: FoodListFilters): Promise<ApiResponse<FoodItem[]>> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.minProtein != null) params.set('minProtein', String(filters.minProtein));
    if (filters?.maxCalories != null) params.set('maxCalories', String(filters.maxCalories));
    if (filters?.minCalories != null) params.set('minCalories', String(filters.minCalories));
    if (filters?.maxCarbs != null) params.set('maxCarbs', String(filters.maxCarbs));
    if (filters?.sort) params.set('sort', filters.sort);
    const query = params.toString() ? `?${params}` : '';
    return apiClient.get<FoodItem[]>(`/api/nutrition/foods${query}`);
  }

  async getCategories(): Promise<ApiResponse<CategoriesPayload>> {
    const cached = peekGetCache<ApiResponse<CategoriesPayload>>(CATEGORIES_CACHE_KEY, CATEGORIES_TTL_MS);
    if (cached) return cached;

    const stale = peekGetCache<ApiResponse<CategoriesPayload>>(CATEGORIES_CACHE_KEY, CATEGORIES_STALE_MS);
    if (stale && !stale.error) {
      revalidateGet(CATEGORIES_CACHE_KEY, async () => {
        const res = await apiClient.get<CategoriesPayload>('/api/nutrition/webteb/categories');
        if (!res.error && res.data) setGetCache(CATEGORIES_CACHE_KEY, res);
        return res;
      });
      return stale;
    }

    const res = await apiClient.get<CategoriesPayload>('/api/nutrition/webteb/categories');
    if (!res.error && res.data) setGetCache(CATEGORIES_CACHE_KEY, res);
    return res;
  }

  async searchFoods(
    params: WebtebSearchParams,
    signal?: AbortSignal
  ): Promise<ApiResponse<FdcSearchResult>> {
    const path = this.buildSearchPath(params);
    const res = await apiClient.get<FdcSearchResult>(path, { signal });
    if (!res.error && res.data) setNutritionSearchCached(params, path, res);
    return res;
  }

  async getFoodDetails(webtebId: number): Promise<ApiResponse<FdcFoodDetails>> {
    return fetchFoodDetailsDeduped(webtebId, () => this.fetchFoodDetailsFromApi(webtebId));
  }

  async importWebtebFood(webtebId: number): Promise<ApiResponse<FoodItem>> {
    return apiClient.post<FoodItem>('/api/nutrition/webteb/import', { webtebId });
  }

  async getNutritionDetails(preview: FdcFoodPreview): Promise<ApiResponse<FdcFoodDetails>> {
    const webtebId =
      preview.webtebId != null && Number(preview.webtebId) > 0 ? Number(preview.webtebId) : 0;
    if (webtebId) return this.getFoodDetails(webtebId);
    return { error: 'Food not found in the database' };
  }

  async resolveFoodForLog(preview: FdcFoodPreview): Promise<ApiResponse<FoodItem>> {
    if (preview.id) return this.getFoodItem(preview.id);
    if (preview.webtebId) return this.importWebtebFood(Number(preview.webtebId));
    return { error: 'Could not import food' };
  }

  async getFoodItem(id: string): Promise<ApiResponse<FoodItem>> {
    return apiClient.get<FoodItem>(`/api/nutrition/foods/${id}`);
  }

  async logFood(data: LogFoodData): Promise<ApiResponse<FoodLog>> {
    return apiClient.post<FoodLog>('/api/nutrition/logs', data);
  }

  async getDailySummary(date?: string): Promise<ApiResponse<DailyNutritionSummary>> {
    const query = date ? `?date=${date}` : '';
    return apiClient.get<DailyNutritionSummary>(`/api/nutrition/summary${query}`);
  }

  async getMyLogs(date?: string): Promise<ApiResponse<FoodLog[]>> {
    const query = date ? `?date=${date}` : '';
    return apiClient.get<FoodLog[]>(`/api/nutrition/logs/me${query}`);
  }

  async resolveWebtebFoodNames(
    webtebIds: number[],
  ): Promise<ApiResponse<{ names: Record<string, { nameAr: string; nameEn?: string | null; displayName: string }>; locale: string }>> {
    return apiClient.post('/api/nutrition/webteb/resolve-names', { webtebIds });
  }

  async deleteLog(logId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/nutrition/logs/${logId}`);
  }
}

export const nutritionService = new NutritionService();
export default nutritionService;
