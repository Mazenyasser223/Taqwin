import React, { useCallback, useEffect, useState } from 'react';
import adaptationService, { type WeeklyAdaptationReview } from '../../services/adaptationService';
import { appendLocalWeightLog } from './weightLogStore';
import { invalidateAthleteHomeCache } from '../../services/dashboardService';
import { cn } from '../../lib/cn';

const BRAND = '#158b8d';

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: WeeklyAdaptationReview | null;
  language: 'ar' | 'en';
  userId?: string;
  today?: string;
  onCompleted: () => void;
};

async function persistWeightLog(userId: string | undefined, today: string | undefined, weight: number) {
  if (!userId || !today) return;
  appendLocalWeightLog(userId, today, weight);
  invalidateAthleteHomeCache();
}

export function WeeklyAdaptationReviewModal({
  open,
  onClose,
  initial,
  language,
  userId,
  today,
  onCompleted,
}: Props) {
  const isAr = language === 'ar';
  const [review, setReview] = useState<WeeklyAdaptationReview | null>(initial ?? null);
  const [weightKg, setWeightKg] = useState('');
  const [sleepQuality, setSleepQuality] = useState(3);
  const [soreness, setSoreness] = useState(3);
  const [rpe, setRpe] = useState(3);
  const [rating, setRating] = useState<'up' | 'down'>('up');
  const [feedbackReason, setFeedbackReason] = useState('');
  const [blocker, setBlocker] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ decision?: string; pending?: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const r = await adaptationService.getWeeklyReview();
    setReview(r);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    if (initial) setReview(initial);
    else void refresh().catch((e) => setError(String(e)));
  }, [open, initial, refresh]);

  if (!open) return null;

  const missing = review?.missing ?? [];
  const preview = review?.preview;

  async function handleSaveProgress() {
    setBusy(true);
    setError(null);
    try {
      const w = Number(weightKg);
      if (Number.isFinite(w) && w > 0) {
        await adaptationService.submitBodyMetric(w);
        await persistWeightLog(userId, today, w);
      }
      await adaptationService.submitReadiness({
        sleepQuality,
        soreness,
        rpe,
        notes: blocker || undefined,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const w = Number(weightKg);
      if (Number.isFinite(w) && w > 0) {
        await adaptationService.submitBodyMetric(w);
        await persistWeightLog(userId, today, w);
      }
      await adaptationService.submitReadiness({ sleepQuality, soreness, rpe, notes: blocker || undefined });
      await adaptationService.submitFeedback(rating, feedbackReason || blocker || undefined, review?.weekStart);
      const out = (await adaptationService.weeklyCheckin({
        weekStart: review?.weekStart,
        feedback: { rating, reason: feedbackReason || blocker },
      })) as {
        evaluation?: { decision?: string };
        apply?: { pendingConfirmation?: boolean; decision?: string };
      };
      const decision = out?.evaluation?.decision || out?.apply?.decision;
      const pending = out?.apply?.pendingConfirmation;
      setResult({ decision, pending });
      if (!pending) {
        onCompleted();
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmMacro() {
    setBusy(true);
    try {
      await adaptationService.confirmMacro(review?.weekStart);
      setResult({ decision: 'macro', pending: false });
      onCompleted();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {isAr ? 'مراجعة الأسبوع للذكاء الاصطناعي' : 'Weekly AI review'}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {isAr
            ? `الأسبوع ${review?.weekStart ?? ''} → ${review?.weekEnd ?? ''}. البيانات تحدد خطة الأسبوع القادم.`
            : `Week ${review?.weekStart ?? ''} → ${review?.weekEnd ?? ''}. This drives next week's plan.`}
        </p>

        {preview && (
          <div
            className="mt-3 rounded-xl border p-3 text-sm"
            style={{ borderColor: `${BRAND}55`, backgroundColor: `${BRAND}12` }}
          >
            <p className="font-semibold" style={{ color: BRAND }}>
              {isAr ? 'معاينة القرار' : 'Decision preview'}: {preview.decision}
            </p>
            <ul className="mt-2 list-disc ps-5 text-gray-700 dark:text-gray-300">
              {preview.reasons?.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {missing.length > 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
            {isAr ? 'مطلوب:' : 'Required:'} {missing.join(', ')}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">
            {isAr ? 'الوزن (كجم)' : 'Weight (kg)'}
            <input
              type="number"
              step="0.1"
              className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              { key: 'sleep', label: isAr ? 'النوم' : 'Sleep', value: sleepQuality, onChange: setSleepQuality },
              { key: 'soreness', label: isAr ? 'الإجهاد' : 'Soreness', value: soreness, onChange: setSoreness },
              { key: 'rpe', label: 'RPE', value: rpe, onChange: setRpe },
            ].map((row) => (
              <label key={row.key} className="block">
                {row.label} (1–5)
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={row.value}
                  onChange={(e) => row.onChange(Number(e.target.value))}
                  className="w-full"
                />
              </label>
            ))}
          </div>

          <label className="block text-sm font-medium">
            {isAr ? 'تقييم الخطة' : 'Plan rating'}
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              value={rating}
              onChange={(e) => setRating(e.target.value as 'up' | 'down')}
            >
              <option value="up">{isAr ? '👍 مناسبة' : '👍 Good'}</option>
              <option value="down">{isAr ? '👎 تحتاج تعديل' : '👎 Needs change'}</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            {isAr ? 'ما الذي عطّل التزامك؟ (اختياري)' : 'What blocked adherence? (optional)'}
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-800"
              rows={2}
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {result && (
          <p className="mt-3 text-sm font-medium text-brand-600">
            {result.pending
              ? isAr
                ? 'مطلوب تأكيد خطة جديدة (macro) من الزر أدناه.'
                : 'Confirm full plan regeneration (macro) below.'
              : isAr
                ? `تم التطبيق: ${result.decision}`
                : `Applied: ${result.decision}`}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSaveProgress()}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            {isAr ? 'حفظ التقدم' : 'Save progress'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: BRAND }}
          >
            {isAr ? 'إرسال المراجعة' : 'Submit review'}
          </button>
          {(review?.macroPendingConfirm || result?.pending) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirmMacro()}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
            >
              {isAr ? 'تأكيد خطة جديدة' : 'Confirm new plan'}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600">
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
