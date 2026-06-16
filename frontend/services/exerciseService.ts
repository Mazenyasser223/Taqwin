import apiClient, { ApiResponse } from './api';
import type { Exercise, ExerciseListResponse, ExerciseLog } from '../types';
import type { MuscleRegion } from '../features/muscle-wiki/types';

export interface ExerciseListParams {
  category?: string;
  muscle?: MuscleRegion;
  search?: string;
  sort?: 'name' | 'random';
  seed?: string;
  page?: number;
  pageSize?: number;
  locale?: 'en' | 'ar';
}

export interface TodayWorkoutExercise {
  exerciseId?: string;
  name: string;
  nameAr?: string;
  sets: number;
  reps: number;
  detail?: string;
  category?: string;
  difficulty?: string;
}

export interface PlanWorkoutExercise {
  exerciseId?: string;
  name: string;
  nameAr?: string;
  sets: number;
  reps: number;
  category?: string;
  difficulty?: string;
  setDetails?: WorkoutSetDetail[];
  userNotes?: string;
  durationSec?: number;
}

export interface WorkoutSetDetail {
  kg: number | null;
  reps: number | null;
  completed: boolean;
}

export interface WorkoutLogUpdatePayload {
  sets: number;
  reps: number;
  setDetails?: WorkoutSetDetail[];
  userNotes?: string;
  durationSec?: number;
}

export interface PlanWorkoutLogPayload {
  date?: string;
  items: PlanWorkoutExercise[];
}

class ExerciseService {
  async list(params: ExerciseListParams = {}): Promise<ApiResponse<ExerciseListResponse>> {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.categories?.length) q.set('categories', params.categories.join(','));
    if (params.categoryGroup) q.set('categoryGroup', params.categoryGroup);
    if (params.muscle) q.set('muscle', params.muscle);
    if (params.difficulty) q.set('difficulty', params.difficulty);
    if (params.goals?.length) q.set('goals', params.goals.join(','));
    if (params.set) q.set('set', params.set);
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.sort) q.set('sort', params.sort);
    if (params.seed) q.set('seed', params.seed);
    if (params.page && params.page > 1) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.locale) q.set('locale', params.locale);
    const query = q.toString();
    return withTransientRetry(() =>
      apiClient.get<ExerciseListResponse>(`/api/exercises${query ? `?${query}` : ''}`),
    );
  }

  async getCategories(): Promise<ApiResponse<{ category: string; count: number }[]>> {
    return apiClient.get<{ category: string; count: number }[]>('/api/exercises/categories');
  }

  async getCategoryGroups(): Promise<ApiResponse<Record<string, number>>> {
    return apiClient.get<Record<string, number>>('/api/exercises/category-groups');
  }

  async getGoalCounts(): Promise<ApiResponse<Record<string, number>>> {
    return apiClient.get<Record<string, number>>('/api/exercises/goal-counts');
  }

  async getDifficulties(): Promise<ApiResponse<{ difficulty: string; count: number }[]>> {
    return apiClient.get<{ difficulty: string; count: number }[]>('/api/exercises/difficulties');
  }

  async getMuscleCounts(set: 'browse' | 'wiki' = 'browse'): Promise<ApiResponse<Record<string, number>>> {
    const q = set === 'wiki' ? '?set=wiki' : '?set=browse';
    return apiClient.get<Record<string, number>>(`/api/exercises/muscle-counts${q}`);
  }

  /** Filter bar metadata — uses sessionStorage cache between visits. */
  async getBrowseMetadata(opts?: { force?: boolean }): Promise<
    ApiResponse<ExerciseBrowseMetadata>
  > {
    if (!opts?.force) {
      const cached = getCachedExerciseBrowseMetadata();
      if (cached) return { data: cached };
    }

    const [cats, muscles, diffs, goals] = await Promise.all([
      withTransientRetry(() => this.getCategories()),
      withTransientRetry(() => this.getMuscleCounts('browse')),
      withTransientRetry(() => this.getDifficulties()),
      withTransientRetry(() => this.getGoalCounts()),
    ]);

    if (cats.error) return { error: cats.error };
    if (muscles.error) return { error: muscles.error };
    if (diffs.error) return { error: diffs.error };
    if (goals.error) return { error: goals.error };

    const payload: ExerciseBrowseMetadata = {
      categories: cats.data ?? [],
      muscleCounts: muscles.data ?? {},
      difficulties: diffs.data ?? [],
      goalCounts: goals.data ?? {},
      fetchedAt: Date.now(),
    };
    setCachedExerciseBrowseMetadata(payload);
    return { data: payload };
  }

  async getFavoriteIds(): Promise<ApiResponse<{ exerciseIds: string[] }>> {
    return apiClient.get<{ exerciseIds: string[] }>('/api/exercises/favorites/me');
  }

  async saveFavorite(exerciseId: string): Promise<ApiResponse<{ saved: boolean; exerciseId: string }>> {
    return apiClient.post<{ saved: boolean; exerciseId: string }>(`/api/exercises/favorites/${exerciseId}`, {});
  }

  async removeFavorite(exerciseId: string): Promise<ApiResponse<{ saved: boolean; exerciseId: string }>> {
    return apiClient.delete<{ saved: boolean; exerciseId: string }>(`/api/exercises/favorites/${exerciseId}`);
  }

  async listFavorites(params: ExerciseListParams = {}): Promise<ApiResponse<ExerciseListResponse>> {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.categories?.length) q.set('categories', params.categories.join(','));
    if (params.muscle) q.set('muscle', params.muscle);
    if (params.difficulty) q.set('difficulty', params.difficulty);
    if (params.goals?.length) q.set('goals', params.goals.join(','));
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.page && params.page > 1) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.locale) q.set('locale', params.locale);
    const query = q.toString();
    return withTransientRetry(() =>
      apiClient.get<ExerciseListResponse>(`/api/exercises/favorites/list${query ? `?${query}` : ''}`),
    );
  }

  async getExercise(id: string, locale?: 'en' | 'ar'): Promise<ApiResponse<Exercise>> {
    const q = locale ? `?locale=${locale}` : '';
    return apiClient.get<Exercise>(`/api/exercises/${id}${q}`);
  }

  async logExercise(
    exerciseId: string,
    opts?: { notes?: string; sets?: number; reps?: number; date?: string }
  ): Promise<ApiResponse<ExerciseLog>> {
    return apiClient.post<ExerciseLog>('/api/exercises/logs', {
      exerciseId,
      notes: opts?.notes,
      sets: opts?.sets,
      reps: opts?.reps,
      date: opts?.date,
    });
  }

  async updateLog(logId: string, payload: WorkoutLogUpdatePayload): Promise<ApiResponse<ExerciseLog>> {
    return apiClient.patch<ExerciseLog>(`/api/exercises/logs/${logId}`, payload);
  }

  async deleteLog(logId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/exercises/logs/${logId}`);
  }

  async getMyLogs(date?: string): Promise<ApiResponse<ExerciseLog[]>> {
    const query = date ? `?date=${date}` : '';
    return apiClient.get<ExerciseLog[]>(`/api/exercises/logs/me${query}`);
  }

  async logPlanExercises(payload: PlanWorkoutLogPayload): Promise<ApiResponse<{ logIds: string[] }>> {
    return apiClient.post<{ logIds: string[] }>('/api/exercises/plan/log', payload);
  }

  async deletePlanLogs(logIds: string[]): Promise<void> {
    await Promise.all(logIds.map((id) => this.deleteLog(id)));
  }
}

export const exerciseService = new ExerciseService();
export default exerciseService;
