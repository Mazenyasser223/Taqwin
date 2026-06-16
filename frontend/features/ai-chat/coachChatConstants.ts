import type { TranslationKey } from '../../lib/i18n/translations';

/** Single storage key for widget + full-page coach chat. */
export const COACH_CONVERSATION_KEY = 'taqwin.coach.conversationId';

export const COACH_DISCLAIMER_KEY = 'taqwin.coach.disclaimerAccepted';

export function readCoachDisclaimerAccepted(): boolean {
  try {
    return localStorage.getItem(COACH_DISCLAIMER_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistCoachDisclaimerAccepted(): void {
  try {
    localStorage.setItem(COACH_DISCLAIMER_KEY, '1');
  } catch {
    /* ignore */
  }
}

const LEGACY_KEYS = ['taqwin.ai.conversationId', 'taqwin_chat_conversation_id'] as const;

export function readCoachConversationId(): string | undefined {
  try {
    const current = localStorage.getItem(COACH_CONVERSATION_KEY);
    if (current) return current;

    for (const key of LEGACY_KEYS) {
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) {
        localStorage.setItem(COACH_CONVERSATION_KEY, fromLocal);
        return fromLocal;
      }
      const fromSession = sessionStorage.getItem(key);
      if (fromSession) {
        localStorage.setItem(COACH_CONVERSATION_KEY, fromSession);
        return fromSession;
      }
    }
  } catch {
    /* storage blocked */
  }
  return undefined;
}

export function persistCoachConversationId(id: string): void {
  try {
    localStorage.setItem(COACH_CONVERSATION_KEY, id);
  } catch {
    /* ignore */
  }
}

export const TOOL_LABEL_KEYS: Record<string, TranslationKey> = {
  log_food: 'ai.tool.logFood',
  replace_exercise_today: 'ai.tool.replaceExercise',
  set_life_mode: 'ai.tool.setLifeMode',
  adapt_plan: 'ai.tool.adaptPlan',
  update_fitness_goal: 'ai.tool.updateFitnessGoal',
  generate_weekly_workout: 'ai.tool.generateWeeklyWorkout',
  generate_weekly_diet: 'ai.tool.generateWeeklyDiet',
  get_nutrition_today: 'ai.tool.nutritionToday',
  get_workout_today: 'ai.tool.workoutToday',
  recommend_plan_products: 'ai.tool.recommendPlanProducts',
};
