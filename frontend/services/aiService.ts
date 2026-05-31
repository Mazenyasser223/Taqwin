import apiClient, { ApiResponse } from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AiChatOptions {
  locale?: 'en' | 'ar';
  conversationId?: string;
}

export interface AiChatResponse {
  reply: string;
  conversationId?: string;
  offTopic?: boolean;
}

export interface ConversationSummary {
  _id: string;
  userId: string;
  title?: string;
  locale: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface PersistedMessage {
  _id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface PlanMeal {
  slot: string;
  foodItemId?: string | null;
  webtebId?: number | null;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export interface PlanDietDay {
  dayIndex: number;
  label?: string;
  meals: PlanMeal[];
}

export interface PlanExerciseEntry {
  exerciseId?: string | null;
  name: string;
  sets: number;
  reps: number;
  restSec?: number;
  notes?: string;
}

export interface PlanWorkoutDay {
  dayIndex: number;
  type: string;
  label?: string;
  isRest?: boolean;
  exercises: PlanExerciseEntry[];
}

export interface PlanWorkoutWeek {
  weekIndex: number;
  days: PlanWorkoutDay[];
}

export interface PlanDailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

export interface AiPlan {
  _id: string;
  userId: string;
  version: number;
  isActive: boolean;
  source: 'ai' | 'fallback' | 'manual';
  locale: string;
  coachNotes?: string;
  regenerationReason?: string;
  dailyTargets: PlanDailyTargets;
  dietDays: PlanDietDay[];
  workoutWeeks: PlanWorkoutWeek[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanGenerationResult {
  plan: AiPlan;
  source: 'ai' | 'fallback';
  attempts: number;
  validationErrors?: string[];
}

class AiService {
  async chat(messages: ChatMessage[], options?: AiChatOptions): Promise<ApiResponse<AiChatResponse>> {
    return apiClient.post<AiChatResponse>('/api/ai/chat', {
      messages,
      locale: options?.locale,
      conversationId: options?.conversationId,
    });
  }

  async listConversations(): Promise<ApiResponse<{ conversations: ConversationSummary[] }>> {
    return apiClient.get<{ conversations: ConversationSummary[] }>('/api/ai/conversations');
  }

  async getConversationMessages(
    id: string,
  ): Promise<ApiResponse<{ conversation: ConversationSummary; messages: PersistedMessage[] }>> {
    return apiClient.get<{ conversation: ConversationSummary; messages: PersistedMessage[] }>(
      `/api/ai/conversations/${encodeURIComponent(id)}/messages`,
    );
  }

  async getActivePlan(): Promise<ApiResponse<{ plan: AiPlan }>> {
    return apiClient.get<{ plan: AiPlan }>('/api/ai/plan/me');
  }

  async generatePlan(
    options: { locale?: 'en' | 'ar'; reason?: string } = {},
  ): Promise<ApiResponse<PlanGenerationResult>> {
    return apiClient.post<PlanGenerationResult>('/api/ai/plan/generate', options);
  }

  async regeneratePlan(
    options: { locale?: 'en' | 'ar'; reason?: string } = {},
  ): Promise<ApiResponse<PlanGenerationResult>> {
    return apiClient.post<PlanGenerationResult>('/api/ai/plan/regenerate', options);
  }
}

export const aiService = new AiService();
export default aiService;
