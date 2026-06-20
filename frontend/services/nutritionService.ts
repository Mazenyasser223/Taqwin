import apiClient, { ApiResponse } from './api';
import { emitDashboardRefresh, emitLiveDietChanged } from '../features/dashboard/wellnessWidgets';
import {
  fetchFoodDetailsDeduped,
  peekFoodDetails as peekCachedFoodDetails,
  prefetchFoodDetails as prefetchCachedFoodDetails,
} from './nutritionDetailsCache';
import {
  peekNutritionSearchCached,
  setNutritionSearchCached,
} from './nutritionSearchSessionCache';
import { peekGetCache, peekStaleGetCache, revalidateGet, setGetCache, invalidateGetCache, invalidateGetCachePrefix, cachedGet } from '../lib/apiGetCache';
import type {
  FoodItem,
  FoodLog,
  FdcCategory,
  FdcFoodPreview,
  FdcFoodDetails,
  FdcSearchResult,
  FoodSort,
} from '../types';
import type { MealCaptureResult } from '../features/dashboard/mealCaptureTypes';
import { sanitizePlanMealLogItems } from './planMealLogSanitize';
import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';

export interface LogFoodData {
  foodItemId: string;
  grams: number;
  loggedAt?: string;
  mealSlotId?: string;
}

export interface KitchenFoodInput {
  name: string;
  category?: string;
  calories?: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat?: number | null;
  transFat?: number | null;
  cholesterol?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  dietaryFiber?: number | null;
  sugars?: number | null;
  vitaminA?: number | null;
  vitaminC?: number | null;
  calcium?: number | null;
  iron?: number | null;
  imageUrl?: string | null;
}

export interface SavedMealItemInput {
  foodItemId?: string | null;
  name?: string;
  grams: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface SavedMeal {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  defaultSlotId?: string | null;
  createdAt: string;
  updatedAt: string;
  totals?: { calories: number; protein: number; carbs: number; fat: number };
  items: Array<{
    id: string;
    mealId: string;
    foodItemId?: string | null;
    name: string;
    grams: number;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    sortOrder: number;
    foodItem?: FoodItem | null;
  }>;
}

export interface SavedMealInput {
  name: string;
  description?: string | null;
  defaultSlotId?: string | null;
  items: SavedMealItemInput[];
}

export interface PlanMealLogItem {
  name: string;
  grams: number;
  role?: 'protein' | 'carb' | 'fat' | 'fruit' | 'dairy' | 'mixed';
  webtebId?: number | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  macrosPer100?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  kitchenFood?: boolean;
}

export interface BarcodeLookupResult {
  barcode: string;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  gramsDefault: number;
  macrosPer100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  webtebId?: number | null;
  kitchenFood: boolean;
  dbMatchScore?: number | null;
  source: 'open_food_facts';
}

export interface PlanMealLogPayload {
  date?: string;
  slotId: string;
  items: PlanMealLogItem[];
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

const CATEGORIES_CACHE_KEY = 'nutrition:webteb:categories:v2';
const CATEGORIES_TTL_MS = 60 * 60 * 1000;
const CATEGORIES_STALE_MS = 24 * 60 * 60 * 1000;

const PERSONAL_KITCHEN_KEY = 'nutrition:personal:kitchen';
const PERSONAL_MEALS_KEY = 'nutrition:personal:meals';
const PERSONAL_TTL_MS = 5 * 60 * 1000;
const PERSONAL_STALE_MS = 30 * 60 * 1000;
const ATHLETE_HOME_CACHE_KEY = 'dashboard:athlete:home';
const DAY_FOOD_LOGS_PREFIX = 'nutrition:logs:';
const DAY_FOOD_LOGS_TTL_MS = 45 * 1000;
const DAY_FOOD_LOGS_STALE_MS = 5 * 60 * 1000;

function dayFoodLogsKey(date?: string): string {
  return `${DAY_FOOD_LOGS_PREFIX}${date ?? 'all'}`;
}

function invalidateDayFoodLogsCache(date?: string): void {
  if (date) invalidateGetCache(dayFoodLogsKey(date));
  else invalidateGetCachePrefix(DAY_FOOD_LOGS_PREFIX);
}

function removeLogsFromDayCache(date: string, logIds: string[]): void {
  const key = dayFoodLogsKey(date);
  const cached =
    peekGetCache<ApiResponse<FoodLog[]>>(key, DAY_FOOD_LOGS_TTL_MS) ??
    peekStaleGetCache<ApiResponse<FoodLog[]>>(key, DAY_FOOD_LOGS_STALE_MS);
  if (!cached?.data) return;
  const removeSet = new Set(logIds);
  setGetCache(key, { ...cached, data: cached.data.filter((log) => !removeSet.has(log.id)) });
}

function revalidateMyLogsForDate(date: string): void {
  const key = dayFoodLogsKey(date);
  revalidateGet(key, async () => {
    const query = `?date=${date}`;
    const res = await apiClient.get<FoodLog[]>(`/api/nutrition/logs/me${query}`);
    if (!res.error) setGetCache(key, res);
    return res;
  });
}

let nutritionDashboardRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function notifyNutritionDashboardChanged(): void {
  invalidateGetCache(ATHLETE_HOME_CACHE_KEY);
  invalidateDayFoodLogsCache();
  emitDashboardRefresh();
}

/** Plan meal log/delete — keep warm cache, patch deletes, background revalidate; debounce heavy home reload. */
function notifyPlanMealLogsChanged(
  date?: string,
  opts?: { removedLogIds?: string[] }
): void {
  if (date && opts?.removedLogIds?.length) {
    removeLogsFromDayCache(date, opts.removedLogIds);
  }
  emitLiveDietChanged();
  if (date) revalidateMyLogsForDate(date);
  if (nutritionDashboardRefreshTimer) clearTimeout(nutritionDashboardRefreshTimer);
  nutritionDashboardRefreshTimer = setTimeout(() => {
    invalidateGetCache(ATHLETE_HOME_CACHE_KEY);
    emitDashboardRefresh();
    nutritionDashboardRefreshTimer = null;
  }, 30000);
}

class NutritionService {
  private async cachedPersonalGet<T>(
    key: string,
    fetcher: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    const fresh = peekGetCache<ApiResponse<T>>(key, PERSONAL_TTL_MS);
    if (fresh) return fresh;

    const stale = peekStaleGetCache<ApiResponse<T>>(key, PERSONAL_STALE_MS);
    if (stale && !stale.error) {
      revalidateGet(key, async () => {
        const res = await fetcher();
        if (!res.error) setGetCache(key, res);
        return res;
      });
      return stale;
    }

    const res = await fetcher();
    if (!res.error) setGetCache(key, res);
    return res;
  }

  invalidatePersonalLibraryCache(): void {
    invalidateGetCache(PERSONAL_KITCHEN_KEY);
    invalidateGetCache(PERSONAL_MEALS_KEY);
  }

  peekKitchenFoods(): ApiResponse<FoodItem[]> | null {
    return (
      peekGetCache<ApiResponse<FoodItem[]>>(PERSONAL_KITCHEN_KEY, PERSONAL_TTL_MS) ??
      peekStaleGetCache<ApiResponse<FoodItem[]>>(PERSONAL_KITCHEN_KEY, PERSONAL_STALE_MS)
    );
  }

  peekSavedMeals(): ApiResponse<SavedMeal[]> | null {
    return (
      peekGetCache<ApiResponse<SavedMeal[]>>(PERSONAL_MEALS_KEY, PERSONAL_TTL_MS) ??
      peekStaleGetCache<ApiResponse<SavedMeal[]>>(PERSONAL_MEALS_KEY, PERSONAL_STALE_MS)
    );
  }

  prefetchPersonalLibrary(): void {
    void this.getKitchenFoods();
    void this.getSavedMeals();
  }
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
    return apiClient.get<FdcFoodDetails>(`/api/nutrition/webteb/${webtebId}`, { timeoutMs: 45000 });
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

  async getKitchenFoods(filters?: FoodListFilters): Promise<ApiResponse<FoodItem[]>> {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.minProtein != null) params.set('minProtein', String(filters.minProtein));
    if (filters?.maxCalories != null) params.set('maxCalories', String(filters.maxCalories));
    if (filters?.minCalories != null) params.set('minCalories', String(filters.minCalories));
    if (filters?.maxCarbs != null) params.set('maxCarbs', String(filters.maxCarbs));
    if (filters?.sort) params.set('sort', filters.sort);
    const query = params.toString() ? `?${params}` : '';
    if (query) {
      return apiClient.get<FoodItem[]>(`/api/nutrition/kitchen/foods${query}`);
    }
    return this.cachedPersonalGet(PERSONAL_KITCHEN_KEY, () =>
      apiClient.get<FoodItem[]>('/api/nutrition/kitchen/foods')
    );
  }

  async createKitchenFood(data: KitchenFoodInput): Promise<ApiResponse<FoodItem>> {
    const res = await apiClient.post<FoodItem>('/api/nutrition/kitchen/foods', data);
    if (!res.error) this.invalidatePersonalLibraryCache();
    return res;
  }

  async updateKitchenFood(id: string, data: Partial<KitchenFoodInput>): Promise<ApiResponse<FoodItem>> {
    const res = await apiClient.patch<FoodItem>(`/api/nutrition/kitchen/foods/${id}`, data);
    if (!res.error) this.invalidatePersonalLibraryCache();
    return res;
  }

  async deleteKitchenFood(id: string): Promise<ApiResponse<void>> {
    const res = await apiClient.delete<void>(`/api/nutrition/kitchen/foods/${id}`);
    if (!res.error) this.invalidatePersonalLibraryCache();
    return res;
  }

  async getSavedMeals(): Promise<ApiResponse<SavedMeal[]>> {
    return this.cachedPersonalGet(PERSONAL_MEALS_KEY, () =>
      apiClient.get<SavedMeal[]>('/api/nutrition/kitchen/meals')
    );
  }

  async createSavedMeal(data: SavedMealInput): Promise<ApiResponse<SavedMeal>> {
    const res = await apiClient.post<SavedMeal>('/api/nutrition/kitchen/meals', data);
    if (!res.error) this.invalidatePersonalLibraryCache();
    return res;
  }

  async updateSavedMeal(id: string, data: Partial<SavedMealInput>): Promise<ApiResponse<SavedMeal>> {
    const res = await apiClient.patch<SavedMeal>(`/api/nutrition/kitchen/meals/${id}`, data);
    if (!res.error) this.invalidatePersonalLibraryCache();
    return res;
  }

  async deleteSavedMeal(id: string): Promise<ApiResponse<void>> {
    const res = await apiClient.delete<void>(`/api/nutrition/kitchen/meals/${id}`);
    if (!res.error) this.invalidatePersonalLibraryCache();
    return res;
  }

  async logSavedMeal(
    id: string,
    payload?: { date?: string; slotId?: string }
  ): Promise<ApiResponse<{ mealId: string; slotId?: string | null; logIds: string[] }>> {
    const res = await apiClient.post(`/api/nutrition/kitchen/meals/${id}/log`, payload ?? {});
    if (!res.error) notifyNutritionDashboardChanged();
    return res;
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
    return { error: 'Food not found in the nutrition library' };
  }

  async resolveFoodForLog(preview: FdcFoodPreview): Promise<ApiResponse<FoodItem>> {
    if (preview.id) return this.getFoodItem(preview.id);
    if (preview.webtebId) return this.importWebtebFood(Number(preview.webtebId));
    return { error: 'Could not import food' };
  }

  async getFoodItem(id: string): Promise<ApiResponse<FoodItem>> {
    return apiClient.get<FoodItem>(`/api/nutrition/foods/${id}`);
  }

  async resolveFoodItemWebteb(
    foodItemId: string,
    options?: { timeoutMs?: number }
  ): Promise<
    ApiResponse<{
      webtebId: number;
      displayName: string;
      nameAr: string;
      nameEn?: string | null;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>
  > {
    return apiClient.post(
      '/api/nutrition/food-items/resolve-webteb',
      { foodItemId },
      { timeoutMs: options?.timeoutMs ?? 45000 }
    );
  }

  async getFoodLog(logId: string): Promise<ApiResponse<FoodLog>> {
    return apiClient.get<FoodLog>(`/api/nutrition/logs/${logId}`, { timeoutMs: 15000 });
  }

  async logFood(data: LogFoodData): Promise<ApiResponse<FoodLog>> {
    const res = await apiClient.post<FoodLog>('/api/nutrition/logs', data);
    if (!res.error) notifyNutritionDashboardChanged();
    return res;
  }

  async updateLog(logId: string, grams: number): Promise<ApiResponse<FoodLog>> {
    const res = await apiClient.patch<FoodLog>(`/api/nutrition/logs/${logId}`, { grams });
    if (!res.error) notifyNutritionDashboardChanged();
    return res;
  }

  async getDailySummary(date?: string): Promise<ApiResponse<DailyNutritionSummary>> {
    const query = date ? `?date=${date}` : '';
    return apiClient.get<DailyNutritionSummary>(`/api/nutrition/summary${query}`);
  }

  peekMyLogs(date?: string): FoodLog[] | null {
    const key = dayFoodLogsKey(date);
    const hit =
      peekGetCache<ApiResponse<FoodLog[]>>(key, DAY_FOOD_LOGS_TTL_MS) ??
      peekStaleGetCache<ApiResponse<FoodLog[]>>(key, DAY_FOOD_LOGS_STALE_MS);
    return hit?.error ? null : hit?.data ?? null;
  }

  async getMyLogs(date?: string): Promise<ApiResponse<FoodLog[]>> {
    const key = dayFoodLogsKey(date);
    const fetcher = () => {
      const query = date ? `?date=${date}` : '';
      return apiClient.get<FoodLog[]>(`/api/nutrition/logs/me${query}`);
    };

    const fresh = peekGetCache<ApiResponse<FoodLog[]>>(key, DAY_FOOD_LOGS_TTL_MS);
    if (fresh) return fresh;

    const stale = peekStaleGetCache<ApiResponse<FoodLog[]>>(key, DAY_FOOD_LOGS_STALE_MS);
    if (stale) {
      revalidateGet(key, async () => {
        const res = await fetcher();
        if (!res.error) setGetCache(key, res);
        return res;
      });
      return stale;
    }

    return cachedGet(key, DAY_FOOD_LOGS_TTL_MS, async () => {
      const res = await fetcher();
      if (res.error) invalidateGetCache(key);
      return res;
    });
  }

  async resolveWebtebFoodNames(
    webtebIds: number[],
  ): Promise<ApiResponse<{ names: Record<string, { nameAr: string; nameEn?: string | null; displayName: string }>; locale: string }>> {
    return apiClient.post('/api/nutrition/webteb/resolve-names', { webtebIds });
  }

  async deleteLog(logId: string, options?: { silent?: boolean }): Promise<ApiResponse<void>> {
    const res = await apiClient.delete<void>(`/api/nutrition/logs/${logId}`);
    if (!res.error && !options?.silent) notifyNutritionDashboardChanged();
    return res;
  }

  async logPlanMeal(payload: PlanMealLogPayload): Promise<ApiResponse<{ slotId: string; logIds: string[] }>> {
    const items = sanitizePlanMealLogItems(payload.items);
    if (!items.length) {
      return { error: 'Add at least one food before logging this meal' };
    }
    const res = await apiClient.post<{ slotId: string; logIds: string[] }>('/api/nutrition/plan-meals/log', {
      ...payload,
      items,
    });
    if (!res.error) {
      notifyPlanMealLogsChanged(payload.date);
      if (payload.items.some((item) => item.kitchenFood)) {
        this.invalidatePersonalLibraryCache();
      }
    }
    return res;
  }

  async lookupBarcode(code: string): Promise<ApiResponse<{ product: BarcodeLookupResult }>> {
    const normalized = encodeURIComponent(code.trim());
    return apiClient.get<{ product: BarcodeLookupResult }>(
      `/api/nutrition/barcode/${normalized}`,
      { timeoutMs: 20000 }
    );
  }

  async deletePlanMealLogs(logIds: string[], date?: string): Promise<void> {
    if (!logIds.length) return;
    const results = await Promise.all(logIds.map((id) => this.deleteLog(id, { silent: true })));
    const failed = results.find((res) => res.error);
    if (failed?.error) throw new Error(failed.error);
    notifyPlanMealLogsChanged(date, { removedLogIds: logIds });
  }

  async analyzeMealCapture(
    files: File[],
    referenceInfo: string,
    options?: { followUpContext?: string; signal?: AbortSignal }
  ): Promise<ApiResponse<MealCaptureResult>> {
    if (!files.length) return { error: 'Upload at least one meal photo' };

    const form = new FormData();
    for (const file of files) form.append('images', file);
    const ref = options?.followUpContext?.trim()
      ? `${referenceInfo}\nUser clarifications: ${options.followUpContext.trim()}`
      : referenceInfo;
    form.append('referenceInfo', ref);

    const token = getAuthToken();
    const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('taqwin_lang') : null;
    const acceptLanguage = storedLang === 'en' || storedLang === 'ar' ? storedLang : undefined;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/nutrition/meal-capture/analyze`, {
        method: 'POST',
        headers: {
          ...(acceptLanguage && { 'Accept-Language': acceptLanguage }),
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: form,
        signal: options?.signal,
      });

      let payload: MealCaptureResult | null = null;
      try {
        payload = (await response.json()) as MealCaptureResult;
      } catch {
        /* non-JSON */
      }

      if (!response.ok) {
        return {
          error:
            (payload && 'message' in payload && typeof payload.message === 'string' && payload.message) ||
            (payload && 'error' in payload && typeof payload.error === 'string' && payload.error) ||
            `Request failed (${response.status})`,
          data: payload ?? undefined,
        };
      }

      return { data: payload! };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { error: 'aborted' };
      }
      const msg = err instanceof Error ? err.message : 'Network error';
      return {
        error:
          msg === 'Failed to fetch'
            ? 'Cannot reach the API. Run the backend (backend-node: npm run dev) and reload.'
            : msg === 'The user aborted a request.' || msg.includes('aborted')
              ? 'aborted'
              : msg,
      };
    }
  }
}

export const nutritionService = new NutritionService();
export default nutritionService;
