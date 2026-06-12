/**
 * Block C9 — Weekly adaptation review API.
 */
import apiClient from './api';

export interface WeeklyAdaptationReview {
  due: boolean;
  canSubmit: boolean;
  weekEnded: boolean;
  weekStart: string;
  weekEnd: string;
  missing: string[];
  requiredReadinessDays: number;
  readinessDaysLogged: number;
  hasWeight: boolean;
  hasFeedback: boolean;
  submitted: boolean;
  macroPendingConfirm?: boolean;
  lastSnapshot?: {
    decision: string;
    adherencePct: number | null;
    aiSummary: string | null;
    createdAt: string;
  } | null;
  preview?: {
    decision: string;
    requiresConfirmation: boolean;
    reasons: string[];
    reasonCodes: string[];
  };
  adherence?: {
    overall: number;
    workoutAdherence: number;
    nutritionAdherence: number;
  };
}

export interface ReadinessPayload {
  date?: string;
  sleepQuality?: number;
  soreness?: number;
  rpe?: number;
  notes?: string;
}

const adaptationService = {
  async getWeeklyReview(weekStart?: string): Promise<WeeklyAdaptationReview> {
    const q = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : '';
    const res = await apiClient.get<{ review: WeeklyAdaptationReview }>(
      `/adaptation/weekly-review${q}`,
    );
    return res.data!.review;
  },

  async getReadinessHistory(days = 7) {
    const res = await apiClient.get<{ readiness: unknown[] }>(
      `/adaptation/readiness?days=${days}`,
    );
    return res.data?.readiness ?? [];
  },

  async submitReadiness(payload: ReadinessPayload) {
    const res = await apiClient.post<{ readiness: unknown }>(
      '/adaptation/readiness',
      payload,
    );
    return res.data!.readiness;
  },

  async submitBodyMetric(weightKg: number, bodyFatPct?: number) {
    const res = await apiClient.post<{ bodyMetric: unknown }>(
      '/adaptation/body-metric',
      { weightKg, bodyFatPct },
    );
    return res.data!.bodyMetric;
  },

  async submitFeedback(rating: 'up' | 'down' | 'thumbs_up' | 'thumbs_down', reason?: string, weekStart?: string) {
    const res = await apiClient.post<{ feedback: unknown }>('/adaptation/feedback', {
      rating,
      reason,
      weekStart,
    });
    return res.data!.feedback;
  },

  async reportManualChange(changeType: string, reason?: string, date?: string) {
    const res = await apiClient.post<{ change: unknown }>('/adaptation/report-change', {
      changeType,
      reason,
      source: 'manual',
      date,
    });
    return res.data!.change;
  },

  async weeklyCheckin(opts?: {
    weekStart?: string;
    confirmMacro?: boolean;
    feedback?: { rating: 'up' | 'down' | 'thumbs_up' | 'thumbs_down'; reason?: string };
  }) {
    const res = await apiClient.post<{ adaptation: unknown }>(
      '/adaptation/weekly-checkin',
      opts ?? {},
    );
    return res.data!.adaptation;
  },

  async confirmMacro(weekStart?: string) {
    const res = await apiClient.post<{ adaptation: unknown }>('/adaptation/confirm-macro', {
      weekStart,
    });
    return res.data!.adaptation;
  },
};

export default adaptationService;
