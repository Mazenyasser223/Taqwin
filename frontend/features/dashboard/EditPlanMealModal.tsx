import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import nutritionService from '../../services/nutritionService';
import type { AthleteHomeDashboard } from '../../services/dashboardService';

type MealSlot = NonNullable<NonNullable<AthleteHomeDashboard['analytics']>['todayMealPlan']>['slots'][number];
type MealItem = MealSlot['items'][number];

function scaleItemMacros(item: MealItem, grams: number) {
  if (!item.grams || item.grams <= 0) {
    return {
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
    };
  }
  const factor = grams / item.grams;
  return {
    calories: Math.round((item.calories ?? 0) * factor),
    protein: Math.round((item.protein ?? 0) * factor * 10) / 10,
    carbs: Math.round((item.carbs ?? 0) * factor * 10) / 10,
    fat: Math.round((item.fat ?? 0) * factor * 10) / 10,
  };
}

export interface EditPlanMealModalProps {
  open: boolean;
  slot: MealSlot | null;
  logIds: string[];
  isLogged: boolean;
  onClose: () => void;
  onSaved: (gramsByIndex: number[]) => void;
}

export const EditPlanMealModal: React.FC<EditPlanMealModalProps> = ({
  open,
  slot,
  logIds,
  isLogged,
  onClose,
  onSaved,
}) => {
  const { t } = useI18n();
  const [grams, setGrams] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !slot) return;
    setGrams(slot.items.map((item) => item.grams));
    setError(null);
  }, [open, slot]);

  const totals = useMemo(() => {
    if (!slot) return { calories: 0, protein: 0 };
    return slot.items.reduce(
      (acc, item, index) => {
        const g = grams[index] ?? item.grams;
        const scaled = scaleItemMacros(item, g);
        acc.calories += scaled.calories;
        acc.protein += scaled.protein;
        return acc;
      },
      { calories: 0, protein: 0 }
    );
  }, [slot, grams]);

  if (!open || !slot) return null;

  const save = async () => {
    for (let i = 0; i < grams.length; i += 1) {
      const g = grams[i];
      if (!Number.isFinite(g) || g < 5 || g > 5000) {
        setError(t('dashboard.editMealInvalidGrams'));
        return;
      }
    }

    if (!isLogged) {
      onSaved(grams);
      onClose();
      return;
    }

    if (logIds.length !== slot.items.length) {
      setError(t('dashboard.editMealLogMismatch'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      for (let i = 0; i < logIds.length; i += 1) {
        const res = await nutritionService.updateLog(logIds[i], grams[i]);
        if (res.error) throw new Error(res.error);
      }
      onSaved(grams);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.editMealSaveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-meal-title"
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-[#0c1220]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="edit-meal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('dashboard.editMealTitle', { meal: slot.label })}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {isLogged ? t('dashboard.editMealSubtitle') : t('dashboard.editMealSubtitleDraft')}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                aria-label={t('common.cancel')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              {slot.items.map((item, index) => {
                const g = grams[index] ?? item.grams;
                const scaled = scaleItemMacros(item, g);
                return (
                  <li
                    key={`${item.name}-${index}`}
                    className="rounded-xl border border-gray-200/90 p-3 dark:border-gray-700 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium text-gray-500">
                        {t('dashboard.mealItemPortion', { grams: String(Math.round(g)), kcal: String(scaled.calories) })}
                      </span>
                    </div>
                    <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      {t('dashboard.editMealGramsLabel')}
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={5000}
                      step={5}
                      value={g}
                      onChange={(e) => {
                        const next = [...grams];
                        next[index] = Number(e.target.value);
                        setGrams(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-gray-900 outline-none ring-brand-500/30 focus:border-brand-500 focus:ring-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </li>
                );
              })}
            </ul>

            <p className="mt-3 text-xs font-medium text-gray-600 dark:text-gray-300">
              {t('dashboard.editMealTotals', {
                kcal: String(Math.round(totals.calories)),
                protein: String(Math.round(totals.protein)),
              })}
            </p>

            {error ? <p className="mt-2 text-xs font-medium text-error-500">{error}</p> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                to="/nutrition"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                <span className="material-symbols-outlined text-base">restaurant</span>
                {t('dashboard.editMealOpenNutrition')}
              </Link>
              <div className="flex gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={submitting}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? t('dashboard.editMealSaving') : isLogged ? t('dashboard.editMealSave') : t('dashboard.editMealApply')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
