/**
 * Block C9 — Weekly adaptation review API.
 */
import apiClient from './api';
import { unwrapApiData } from './adaptationApiHelpers';

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
      `/api/adaptation/weekly-review${q}`,
    );
    const data = unwrapApiData(res, 'Could not load weekly review');
    if (!data.review) throw new Error('Could not load weekly review');
    return data.review;
  },

  async getReadinessHistory(days = 7) {
    const res = await apiClient.get<{ readiness: unknown[] }>(
      `/api/adaptation/readiness?days=${days}`,
    );
    return unwrapApiData(res, 'Could not load readiness history').readiness ?? [];
  },

  async submitReadiness(payload: ReadinessPayload) {
    const res = await apiClient.post<{ readiness: unknown }>(
      '/api/adaptation/readiness',
      payload,
    );
    const data = unwrapApiData(res, 'Could not save readiness');
    if (!data.readiness) throw new Error('Could not save readiness');
    return data.readiness;
  },

  async submitBodyMetric(weightKg: number, bodyFatPct?: number) {
    const res = await apiClient.post<{ bodyMetric: unknown }>(
      '/api/adaptation/body-metric',
      { weightKg, bodyFatPct },
    );
    const data = unwrapApiData(res, 'Could not save weight');
    if (!data.bodyMetric) throw new Error('Could not save weight');
    return data.bodyMetric;
  },

  async submitFeedback(rating: 'up' | 'down' | 'thumbs_up' | 'thumbs_down', reason?: string, weekStart?: string) {
    const res = await apiClient.post<{ feedback: unknown }>('/api/adaptation/feedback', {
      rating,
      reason,
      weekStart,
    });
    const data = unwrapApiData(res, 'Could not save feedback');
    if (!data.feedback) throw new Error('Could not save feedback');
    return data.feedback;
  },

  async reportManualChange(changeType: string, reason?: string, date?: string) {
    const res = await apiClient.post<{ change: unknown }>('/api/adaptation/report-change', {
      changeType,
      reason,
      source: 'manual',
      date,
    });
    const data = unwrapApiData(res, 'Could not report change');
    if (!data.change) throw new Error('Could not report change');
    return data.change;
  },

  async weeklyCheckin(opts?: {
    weekStart?: string;
    confirmMacro?: boolean;
    feedback?: { rating: 'up' | 'down' | 'thumbs_up' | 'thumbs_down'; reason?: string };
  }) {
    const res = await apiClient.post<{ adaptation: unknown }>(
      '/api/adaptation/weekly-checkin',
      opts ?? {},
    );
    const data = unwrapApiData(res, 'Weekly check-in failed');
    if (!data.adaptation) throw new Error('Weekly check-in failed');
    return data.adaptation;
  },

  async confirmMacro(weekStart?: string) {
    const res = await apiClient.post<{ adaptation: unknown }>('/api/adaptation/confirm-macro', {
      weekStart,
    });
    const data = unwrapApiData(res, 'Could not confirm plan update');
    if (!data.adaptation) throw new Error('Could not confirm plan update');
    return data.adaptation;
  },
};

export default adaptationService;
