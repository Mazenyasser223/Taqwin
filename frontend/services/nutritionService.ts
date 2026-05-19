import apiClient, { ApiResponse } from './api';
import type {
  FoodItem,
  FoodLog,
  FdcCategory,
  FdcFoodPreview,
  FdcSearchResult,
  FoodSort,
  FdcDataType,
} from '../types';
import type { MacroPreset } from '../features/nutrition/nutritionFilters';

export interface LogFoodData {
  foodItemId: string;
  grams: number;
  loggedAt?: string; // ISO date, defaults to now
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

export interface FdcSearchParams {
  q?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  dataType?: FdcDataType[];
  lang?: 'en' | 'ar';
  usdaStartPage?: number;
  minProtein?: number;
  maxProtein?: number;
  minCalories?: number;
  maxCalories?: number;
  minCarbs?: number;
  maxCarbs?: number;
  minFat?: number;
  maxFat?: number;
  brandQuery?: string;
  macroPreset?: MacroPreset;
  sort?: FoodSort;
}

class NutritionService {
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

  async getFdcCategories(): Promise<ApiResponse<{ categories: FdcCategory[] }>> {
    return apiClient.get<{ categories: FdcCategory[] }>('/api/nutrition/fdc/categories');
  }

  async searchFdc(params: FdcSearchParams): Promise<ApiResponse<FdcSearchResult>> {
    const q = new URLSearchParams();
    if (params.q?.trim()) q.set('q', params.q.trim());
    if (params.categoryId) q.set('categoryId', params.categoryId);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.dataType?.length) q.set('dataType', params.dataType.join(','));
    if (params.lang) q.set('lang', params.lang);
    if (params.usdaStartPage) q.set('usdaStartPage', String(params.usdaStartPage));
    if (params.minProtein != null) q.set('minProtein', String(params.minProtein));
    if (params.maxProtein != null) q.set('maxProtein', String(params.maxProtein));
    if (params.minCalories != null) q.set('minCalories', String(params.minCalories));
    if (params.maxCalories != null) q.set('maxCalories', String(params.maxCalories));
    if (params.minCarbs != null) q.set('minCarbs', String(params.minCarbs));
    if (params.maxCarbs != null) q.set('maxCarbs', String(params.maxCarbs));
    if (params.minFat != null) q.set('minFat', String(params.minFat));
    if (params.maxFat != null) q.set('maxFat', String(params.maxFat));
    if (params.brandQuery) q.set('brandQuery', params.brandQuery);
    if (params.macroPreset && params.macroPreset !== 'none') q.set('macroPreset', params.macroPreset);
    if (params.sort && params.sort !== 'name') q.set('sort', params.sort);
    return apiClient.get<FdcSearchResult>(`/api/nutrition/fdc/search?${q}`);
  }

  async importFdcFood(fdcId: number): Promise<ApiResponse<FoodItem>> {
    return apiClient.post<FoodItem>('/api/nutrition/fdc/import', { fdcId });
  }

  /** Resolve a USDA preview to a loggable FoodItem (import if needed). */
  async resolveFoodForLog(preview: FdcFoodPreview): Promise<ApiResponse<FoodItem>> {
    if (preview.id) return this.getFoodItem(preview.id);
    return this.importFdcFood(preview.fdcId);
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

  async deleteLog(logId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/nutrition/logs/${logId}`);
  }
}

export const nutritionService = new NutritionService();
export default nutritionService;
