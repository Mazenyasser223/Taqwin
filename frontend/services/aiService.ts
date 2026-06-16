import apiClient, { ApiResponse } from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AiChatOptions {
  locale?: 'en' | 'ar';
  conversationId?: string;
}

export interface AiToolCall {
  name: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface AiFoodDisambiguationCandidate {
  foodItemId?: string;
  webtebId?: number;
  foodName: string;
  nameAr?: string | null;
  grams: number;
}

export interface AiChatResponse {
  reply: string;
  conversationId?: string;
  offTopic?: boolean;
  confirmationRequired?: boolean;
  confirmationPreview?: string | null;
  disambiguationRequired?: boolean;
  disambiguationKind?: 'food' | null;
  candidates?: AiFoodDisambiguationCandidate[];
  disambiguationQuery?: string;
  actionId?: string | null;
  expiresAt?: string | null;
  stepUpRequired?: boolean;
  stepUpEligible?: boolean;
  stepUpPhrase?: string | null;
  stepUpMethods?: Array<'phrase' | 'password'>;
  stepUpIdleMs?: number;
  pendingCreatedAt?: string | null;
  stepUpStaleAt?: string | null;
  toolCalls?: AiToolCall[];
  intent?: string;
}

export interface CoachConfirmOptions extends AiChatOptions {
  confirmationPhrase?: string;
  password?: string;
}

export interface AiPendingActionView {
  actionId: string;
  phase: 'confirm' | 'disambiguation';
  preview?: string;
  tools?: string[];
  expiresAt?: string | null;
  locale?: 'en' | 'ar';
  confirmationRequired?: boolean;
  confirmationPreview?: string | null;
  disambiguationRequired?: boolean;
  disambiguationKind?: 'food';
  candidates?: AiFoodDisambiguationCandidate[];
  disambiguationQuery?: string;
  stepUpRequired?: boolean;
  stepUpEligible?: boolean;
  stepUpPhrase?: string | null;
  stepUpMethods?: Array<'phrase' | 'password'>;
  stepUpIdleMs?: number;
  pendingCreatedAt?: string | null;
  stepUpStaleAt?: string | null;
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
  meta?: {
    confirmationRequired?: boolean;
    disambiguationRequired?: boolean;
    actionId?: string | null;
    candidates?: AiFoodDisambiguationCandidate[];
    disambiguationQuery?: string;
    confirmationPreview?: string | null;
  };
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
  explainabilityText?: string;
  coachNotes?: string;
  regenerationReason?: string;
  dailyTargets: PlanDailyTargets;
  dietDays: PlanDietDay[];
  workoutWeeks: PlanWorkoutWeek[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanGenerationResult {
  plan?: AiPlan;
  source?: 'ai' | 'fallback';
  attempts?: number;
  validationErrors?: string[];
  mode?: 'sync';
  storage?: string;
}

export interface PlanGenerateQueuedResult {
  status: 'queued' | 'already_queued';
  jobId: string;
  state?: string;
  poll?: string;
}

export interface PlanGenerateJobStatus {
  jobId: string;
  state: string;
  progress?: number;
  attemptsMade?: number;
  failedReason?: string | null;
  result?: unknown;
  enqueuedAt?: string;
}

export type PlanGenerateResponse = PlanGenerationResult | PlanGenerateQueuedResult;

class AiService {
  async chat(messages: ChatMessage[], options?: AiChatOptions): Promise<ApiResponse<AiChatResponse>> {
    return apiClient.post<AiChatResponse>('/api/ai/chat', {
      messages,
      locale: options?.locale,
      conversationId: options?.conversationId,
    });
  }

  /** Confirm a pending action by server-stored actionId (preferred over free-text "yes"). */
  async confirmChatAction(
    actionId: string,
    options?: CoachConfirmOptions,
  ): Promise<ApiResponse<AiChatResponse>> {
    return apiClient.post<AiChatResponse>('/api/ai/chat/confirm', {
      actionId,
      conversationId: options?.conversationId,
      locale: options?.locale,
      confirmationPhrase: options?.confirmationPhrase,
      password: options?.password,
    });
  }

  async cancelChatAction(
    actionId: string,
    options?: AiChatOptions,
  ): Promise<ApiResponse<AiChatResponse>> {
    return apiClient.post<AiChatResponse>('/api/ai/chat/cancel', {
      actionId,
      conversationId: options?.conversationId,
      locale: options?.locale,
    });
  }

  async getChatPending(
    conversationId: string,
  ): Promise<ApiResponse<{ pending: AiPendingActionView | null }>> {
    return apiClient.get<{ pending: AiPendingActionView | null }>(
      `/api/ai/chat/pending?conversationId=${encodeURIComponent(conversationId)}`,
    );
  }

  async disambiguateFood(
    actionId: string,
    pick: { foodItemId?: string; webtebId?: number },
    options?: AiChatOptions,
  ): Promise<ApiResponse<AiChatResponse>> {
    return apiClient.post<AiChatResponse>('/api/ai/chat/disambiguate', {
      actionId,
      foodItemId: pick.foodItemId,
      webtebId: pick.webtebId,
      conversationId: options?.conversationId,
      locale: options?.locale,
    });
  }

  /** @deprecated Prefer confirmChatAction(actionId) — free-text confirm is fragile. */
  async confirmChatTool(
    messages: ChatMessage[],
    options?: AiChatOptions,
  ): Promise<ApiResponse<AiChatResponse>> {
    const confirmText = options?.locale === 'ar' ? 'نعم، أكد' : 'Yes, confirm';
    return this.chat([...messages, { role: 'user', content: confirmText }], options);
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

  async getPlanJobStatus(
    jobId: string,
  ): Promise<ApiResponse<{ job: PlanGenerateJobStatus }>> {
    return apiClient.get<{ job: PlanGenerateJobStatus }>(
      `/api/ai/plan/jobs/${encodeURIComponent(jobId)}`,
    );
  }

  async generatePlan(
    options: { locale?: 'en' | 'ar'; reason?: string; sync?: boolean } = {},
    request?: { timeoutMs?: number },
  ): Promise<ApiResponse<PlanGenerateResponse>> {
    return apiClient.post<PlanGenerateResponse>('/api/ai/plan/generate', options, request ?? {});
  }

  async regeneratePlan(
    options: { locale?: 'en' | 'ar'; reason?: string; sync?: boolean } = {},
    request?: { timeoutMs?: number },
  ): Promise<ApiResponse<PlanGenerateResponse>> {
    return apiClient.post<PlanGenerateResponse>('/api/ai/plan/regenerate', options, request ?? {});
  }
}

export const aiService = new AiService();
export default aiService;
