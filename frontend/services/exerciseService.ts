import apiClient, { ApiResponse } from './api';
import type { Exercise, ExerciseListResponse, ExerciseLog } from '../types';
import type { MuscleZone } from '../features/muscle-wiki/types';

export interface ExerciseListParams {
  category?: string;
  muscle?: MuscleZone;
  search?: string;
  page?: number;
  pageSize?: number;
  locale?: 'en' | 'ar';
}

class ExerciseService {
  async list(params: ExerciseListParams = {}): Promise<ApiResponse<ExerciseListResponse>> {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.muscle) q.set('muscle', params.muscle);
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.page && params.page > 1) q.set('page', String(params.page));
    if (params.locale) q.set('locale', params.locale);
    // Omit pageSize — backend defaults to 24; explicit pageSize breaks on some deployments.
    const query = q.toString();
    return apiClient.get<ExerciseListResponse>(`/api/exercises${query ? `?${query}` : ''}`);
  }

  async getCategories(): Promise<ApiResponse<{ category: string; count: number }[]>> {
    return apiClient.get<{ category: string; count: number }[]>('/api/exercises/categories');
  }

  async getMuscleCounts(): Promise<ApiResponse<Record<string, number>>> {
    return apiClient.get<Record<string, number>>('/api/exercises/muscle-counts');
  }

  async getExercise(id: string, locale?: 'en' | 'ar'): Promise<ApiResponse<Exercise>> {
    const q = locale ? `?locale=${locale}` : '';
    return apiClient.get<Exercise>(`/api/exercises/${id}${q}`);
  }

  async logExercise(exerciseId: string, notes?: string): Promise<ApiResponse<ExerciseLog>> {
    return apiClient.post<ExerciseLog>('/api/exercises/logs', { exerciseId, notes });
  }

  async getMyLogs(): Promise<ApiResponse<ExerciseLog[]>> {
    return apiClient.get<ExerciseLog[]>('/api/exercises/logs/me');
  }
}

export const exerciseService = new ExerciseService();
export default exerciseService;
