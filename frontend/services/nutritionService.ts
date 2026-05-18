import apiClient, { ApiResponse } from './api';
import type { FoodItem, FoodLog } from '../types';

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

class NutritionService {
  async getFoodItems(search?: string): Promise<ApiResponse<FoodItem[]>> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient.get<FoodItem[]>(`/api/nutrition/foods${query}`);
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
