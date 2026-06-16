import apiClient, { ApiResponse } from './api';

export type CoachPlanSource = 'rules' | 'ai' | 'manual';

export type CoachPlanExercise = {
  exerciseId?: string;
  name: string;
  nameAr?: string;
  sets: number;
  reps: number;
  category?: string;
  difficulty?: string;
};

export type CoachPlanPayload = {
  version: 1;
  source: CoachPlanSource;
  generatedAt: string;
  locale: 'en' | 'ar';
  aiSummary?: string | null;
  workout: {
    title: string;
    durationMin: number;
    weeklySchedule: Array<{
      dayOfWeek: number;
      isTrainingDay: boolean;
      splitLabel?: string | null;
      exercises: CoachPlanExercise[];
    }>;
  };
  diet: {
    mealsPerDay: number;
    mainMeals?: number;
    snacks?: number;
    planTotalCalories?: number;
    slots: Array<Record<string, unknown>>;
    planSource?: CoachPlanSource;
  };
  overrides?: {
    workoutByDate?: Record<string, CoachPlanExercise[]>;
    dietByDate?: Record<string, { slots: Array<Record<string, unknown>> }>;
    dietSlots?: Array<Record<string, unknown>>;
  };
};

export type CoachPlanMeta = {
  hasPlan: boolean;
  source: CoachPlanSource | null;
  generatedAt: string | null;
  aiSummary?: string | null;
  editable?: boolean;
};

export type CoachPlanPatch = {
  locale?: 'en' | 'ar';
  workoutDayOverride?: { date: string; exercises: CoachPlanExercise[] };
  dietDayOverride?: { date: string; slots: Array<Record<string, unknown>> };
  dietSlots?: Array<Record<string, unknown>>;
  aiSummary?: string | null;
};

class CoachPlanService {
  async getMyPlan(): Promise<ApiResponse<{ plan: CoachPlanPayload | null; meta: CoachPlanMeta }>> {
    return apiClient.get<{ plan: CoachPlanPayload | null; meta: CoachPlanMeta }>('/api/ai/plan/me');
  }

  async generate(opts?: { locale?: 'en' | 'ar'; force?: boolean }): Promise<
    ApiResponse<{ plan: CoachPlanPayload; meta: CoachPlanMeta }>
  > {
    return apiClient.post<{ plan: CoachPlanPayload; meta: CoachPlanMeta }>('/api/ai/plan/generate', opts ?? {});
  }

  async regenerate(locale?: 'en' | 'ar'): Promise<ApiResponse<{ plan: CoachPlanPayload; meta: CoachPlanMeta }>> {
    return apiClient.post<{ plan: CoachPlanPayload; meta: CoachPlanMeta }>('/api/ai/plan/regenerate', {
      locale,
      force: true,
    });
  }

  async patch(patch: CoachPlanPatch): Promise<ApiResponse<{ plan: CoachPlanPayload; meta: CoachPlanMeta }>> {
    return apiClient.patch<{ plan: CoachPlanPayload; meta: CoachPlanMeta }>('/api/ai/plan', patch);
  }
}

export const coachPlanService = new CoachPlanService();
export default coachPlanService;

/** @deprecated Plans are generated manually from Profile (AIPlanCard). Kept for legacy call sites. */
export async function maybeGenerateCoachPlanAfterQuestionnaire(
  _onboardingData: Record<string, unknown> | undefined,
  _locale: 'en' | 'ar' = 'ar'
): Promise<void> {
  /* no-op — athlete taps "Generate my plan" on Profile when dossier is 100% */
}
