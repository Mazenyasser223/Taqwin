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

/** After questionnaires finish, build coach plan when workout + diet flows are complete. */
export async function maybeGenerateCoachPlanAfterQuestionnaire(
  onboardingData: Record<string, unknown> | undefined,
  locale: 'en' | 'ar' = 'ar'
): Promise<void> {
  if (!onboardingData?.workoutPlanCompletedAt || !onboardingData?.dietPlanCompletedAt) return;
  try {
    await coachPlanService.generate({ locale });
  } catch {
    /* dashboard will auto-generate on next load */
  }
}
