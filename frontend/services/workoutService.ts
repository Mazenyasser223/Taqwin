import apiClient, { ApiResponse } from './api';
import type { Workout, WorkoutLog } from '../types';

export interface CreateWorkoutLogData {
  workoutId: string;
  durationMin?: number;
  notes?: string;
}

class WorkoutService {
  async getWorkouts(category?: string): Promise<ApiResponse<Workout[]>> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiClient.get<Workout[]>(`/api/workouts${query}`);
  }

  async getWorkout(id: string): Promise<ApiResponse<Workout>> {
    return apiClient.get<Workout>(`/api/workouts/${id}`);
  }

  async logWorkout(data: CreateWorkoutLogData): Promise<ApiResponse<WorkoutLog>> {
    return apiClient.post<WorkoutLog>('/api/workouts/logs', data);
  }

  async getMyLogs(): Promise<ApiResponse<WorkoutLog[]>> {
    return apiClient.get<WorkoutLog[]>('/api/workouts/logs/me');
  }

  // Trainer endpoints
  async createWorkout(data: Partial<Workout>): Promise<ApiResponse<Workout>> {
    return apiClient.post<Workout>('/api/workouts', data);
  }

  async updateWorkout(id: string, data: Partial<Workout>): Promise<ApiResponse<Workout>> {
    return apiClient.patch<Workout>(`/api/workouts/${id}`, data);
  }
}

export const workoutService = new WorkoutService();
export default workoutService;
