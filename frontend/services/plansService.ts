/**
 * Block C6 — Athlete plan APIs (today + week).
 */
import apiClient, { ApiResponse } from './api';

export interface PlanDailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

export interface PlanExercise {
  exerciseId: string;
  name: string;
  nameAr?: string | null;
  category?: string | null;
  sets: number;
  reps: number;
  restSec: number;
  notes: string;
}

export interface SavedRoutineExercise {
  id: string;
  exerciseId: string;
  name: string;
  nameAr?: string | null;
  category?: string | null;
  sets: number;
  reps: string;
  restSec: number;
  notes: string;
  sortOrder: number;
}

export interface SavedWorkoutRoutine {
  id: string;
  userId: string;
  sourceDayId?: string | null;
  name: string;
  focus?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  exerciseCount: number;
  exercises: SavedRoutineExercise[];
}

export type RoutineApplyMode = 'replace' | 'append';

export interface RoutineExerciseInput {
  exerciseId: string;
  sets?: number | null;
  reps?: string | number | null;
  restSec?: number | null;
  notes?: string | null;
}

export interface RoutineInput {
  name: string;
  focus?: string | null;
  notes?: string | null;
  sourceDayId?: string | null;
  sourceDate?: string;
  exercises?: RoutineExerciseInput[];
}

export interface RoutineAdvice {
  routineId: string;
  date: string;
  recommendMode: RoutineApplyMode;
  duplicateCount: number;
  newCount: number;
  targetExerciseCount: number;
  reason: string;
}

export interface PlanMeal {
  slot: string;
  foodItemId?: string | null;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}

export interface TodayPlanPayload {
  date: string;
  dayIndex: number;
  timezone: string;
  status: string;
  lifeMode: string;
  readinessScore: number | null;
  explainabilityText: string | null;
  dailyTargets: PlanDailyTargets;
  workout: { dayIndex: number | null; isRest: boolean; focus: string | null; exercises: PlanExercise[] };
  diet: { dayIndex: number | null; meals: PlanMeal[] };
  meta: Record<string, unknown>;
}

export interface WeekPlanPayload {
  weekStart: string | null;
  locale: string;
  dailyTargets: PlanDailyTargets;
  explainabilityText: string | null;
  workout: { planId: string | null; status: string | null; source: string | null; days: TodayPlanPayload['workout'][] };
  diet: { planId: string | null; status: string | null; source: string | null; days: TodayPlanPayload['diet'][] };
  dailyPlans: Array<{
    date: string;
    status: string;
    lifeMode: string;
    workout: TodayPlanPayload['workout'];
    diet: TodayPlanPayload['diet'];
  }>;
  meta: Record<string, unknown>;
}

class PlansService {
  async getTodayPlan(): Promise<ApiResponse<{ plan: TodayPlanPayload }>> {
    return apiClient.get<{ plan: TodayPlanPayload }>('/api/plans/today');
  }

  async getWeekPlan(): Promise<ApiResponse<{ week: WeekPlanPayload }>> {
    return apiClient.get<{ week: WeekPlanPayload }>('/api/plans/week');
  }

  async patchDay(body: {
    date?: string;
    status?: 'active' | 'skipped' | 'completed' | 'adapted';
    lifeMode?: 'normal' | 'travel' | 'sick' | 'fasting' | 'injury_flare';
    reason?: string;
  }): Promise<ApiResponse<{ day: Record<string, unknown> }>> {
    return apiClient.patch<{ day: Record<string, unknown> }>('/api/plans/day', body);
  }

  async getRoutines(): Promise<ApiResponse<SavedWorkoutRoutine[]>> {
    return apiClient.get<SavedWorkoutRoutine[]>('/api/plans/routines');
  }

  async createRoutine(body: RoutineInput): Promise<ApiResponse<SavedWorkoutRoutine>> {
    return apiClient.post<SavedWorkoutRoutine>('/api/plans/routines', body);
  }

  async updateRoutine(id: string, body: Partial<RoutineInput>): Promise<ApiResponse<SavedWorkoutRoutine>> {
    return apiClient.patch<SavedWorkoutRoutine>(`/api/plans/routines/${id}`, body);
  }

  async deleteRoutine(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/plans/routines/${id}`);
  }

  async getRoutineAdvice(id: string, date: string): Promise<ApiResponse<RoutineAdvice>> {
    return apiClient.get<RoutineAdvice>(`/api/plans/routines/${id}/advice?date=${date}`);
  }

  async applyRoutine(
    id: string,
    body: { date: string; mode: RoutineApplyMode }
  ): Promise<ApiResponse<{ routineId: string; date: string; mode: RoutineApplyMode; added: number; duplicateExerciseIds: string[] }>> {
    return apiClient.post<{ routineId: string; date: string; mode: RoutineApplyMode; added: number; duplicateExerciseIds: string[] }>(
      `/api/plans/routines/${id}/apply`,
      body
    );
  }
}

export const plansService = new PlansService();
export default plansService;
