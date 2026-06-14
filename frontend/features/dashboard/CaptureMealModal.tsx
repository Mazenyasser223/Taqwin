import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { useI18n } from '../../lib/i18n/useI18n';
import nutritionService from '../../services/nutritionService';
import type { PlanMealLogItem } from '../../services/nutritionService';
import { applyCapturedItemsToSlot, type MealCaptureApplyResult } from './mealCaptureApply';
import {
  MEAL_CAPTURE_ANGLE_HINTS,
  MEAL_CAPTURE_REF_OPTIONS,
  MEAL_CAPTURE_REF_VALUES,
  MAX_MEAL_CAPTURE_IMAGES,
  type MealCaptureFoodItem,
  type MealCaptureResult,
} from './mealCaptureTypes';
import {
  validateMealCaptureImage,
  validateMealCaptureSet,
  compressMealCaptureFiles,
  isSoftMealCaptureQualityNote,
  type ImageQualityCheck,
} from './mealCaptureImageValidation';

type Props = {
  open: boolean;
  slotId: string;
  slotLabel: string;
  date: string;
  userId: string;
  isLogged: boolean;
  existingDraftItems?: PlanMealLogItem[];
  onClose: () => void;
  onApplied: (result?: MealCaptureApplyResult) => void | Promise<void>;
};

type LocalImage = {
  id: string;
  file: File;
  previewUrl: string;
  quality?: ImageQualityCheck;
};

function qualityBorderClass(q?: ImageQualityCheck) {
  if (!q) return '';
  if (q.blocking) return 'border-error-500 ring-1 ring-error-500/40';
  if (!q.full_plate_visible) return 'border-amber-500 ring-2 ring-amber-500/50';
  return 'border-gray-200';
}

function partialPlatePhotosFromImages(images: LocalImage[]): number[] {
  return images
    .map((img, i) => (img.quality && !img.quality.full_plate_visible ? i + 1 : null))
    .filter((n): n is number => n !== null);
}

function partialPlatePhotosFromResult(result: MealCaptureResult | null): number[] {
  if (!result?.image_quality?.length) return [];
  return result.image_quality
    .filter((q) => q.full_plate_visible === false)
    .map((q) => q.index);
}

function pctFromScore(score?: number) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return Math.round(score * 100);
}

function confBadgeClass(conf: string) {
  const c = conf.toLowerCase();
  if (c === 'high') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
  if (c === 'low') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return 'bg-gray-500/15 text-gray-600 dark:text-gray-400';
}

export function CaptureMealModal({
  open,
  slotId,
  slotLabel,
  date,
  userId,
  isLogged,
  existingDraftItems,
  onClose,
  onApplied,
}: Props) {
  const { t } = useI18n();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [refOption, setRefOption] = useState<string>('none');
  const [customRef, setCustomRef] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MealCaptureResult | null>(null);
  const [editableItems, setEditableItems] = useState<MealCaptureFoodItem[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [softValidationWarnings, setSoftValidationWarnings] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [followUpAnswers, setFollowUpAnswers] = useState('');

  const referenceInfo = useMemo(() => {
    if (refOption === 'custom') return customRef.trim() || MEAL_CAPTURE_REF_VALUES.none;
    return MEAL_CAPTURE_REF_VALUES[refOption] || MEAL_CAPTURE_REF_VALUES.none;
  }, [refOption, customRef]);

  const resetState = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
    setRefOption('none');
    setCustomRef('');
    setAnalyzing(false);
    setApplying(false);
    setError(null);
    setResult(null);
    setEditableItems([]);
    setValidationWarnings([]);
    setSoftValidationWarnings([]);
    setFollowUpAnswers('');
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [images]);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next: LocalImage[] = [];
    for (let i = 0; i < fileList.length; i += 1) {
      if (images.length + next.length >= MAX_MEAL_CAPTURE_IMAGES) break;
      const file = fileList[i];
      if (!file.type.startsWith('image/')) continue;
      let quality: ImageQualityCheck | undefined;
      try {
        quality = await validateMealCaptureImage(file);
      } catch {
        /* skip quality on load failure */
      }
      next.push({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
        quality,
      });
    }
    if (next.length) {
      setImages((prev) => {
        const merged = [...prev, ...next].slice(0, MAX_MEAL_CAPTURE_IMAGES);
        const warnings: string[] = [];
        const soft: string[] = [];
        if (merged.length === 1) soft.push(t('dashboard.captureAngleHint'));
        merged.forEach((img, idx) => {
          img.quality?.notes.forEach((n) => {
            const line = `Photo ${idx + 1}: ${n}`;
            if (isSoftMealCaptureQualityNote(n) || /blurry/i.test(n)) soft.push(line);
            else warnings.push(line);
          });
        });
        setValidationWarnings(warnings);
        setSoftValidationWarnings(soft);
        return merged;
      });
    }
    setResult(null);
    setEditableItems([]);
    setError(null);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((img) => img.id !== id);
      const warnings: string[] = [];
      const soft: string[] = [];
      if (next.length === 1) soft.push(t('dashboard.captureAngleHint'));
      next.forEach((img, idx) => {
        img.quality?.notes.forEach((n) => {
          const line = `Photo ${idx + 1}: ${n}`;
          if (isSoftMealCaptureQualityNote(n) || /blurry/i.test(n)) soft.push(line);
          else warnings.push(line);
        });
      });
      setValidationWarnings(warnings);
      setSoftValidationWarnings(soft);
      return next;
    });
    setResult(null);
    setEditableItems([]);
  };

  const runAnalyze = async (followUpContext?: string) => {
    if (!images.length) {
      setError(t('dashboard.captureNoImages'));
      return;
    }
    setValidating(true);
    setError(null);
    const validation = await validateMealCaptureSet(images.map((img) => img.file));
    setValidating(false);
    if (validation.blocking) {
      setError(t('dashboard.captureQualityBlock'));
      setValidationWarnings(validation.warnings);
      setSoftValidationWarnings(validation.softWarnings);
      return;
    }
    setValidationWarnings(validation.warnings);
    setSoftValidationWarnings(validation.softWarnings);

    const compressed = await compressMealCaptureFiles(images.map((img) => img.file));
    setAnalyzing(true);
    setResult(null);

    const controller = new AbortController();
    const timeoutMs = 240_000;
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    const res = await nutritionService.analyzeMealCapture(
      compressed,
      referenceInfo,
      { followUpContext, signal: controller.signal }
    );
    window.clearTimeout(timer);

    setAnalyzing(false);
    if (res.error || !res.data) {
      const code = res.data?.error || res.error;
      if (code === 'AbortError' || res.error === 'aborted') {
        setError(t('dashboard.captureAnalyzeTimeout'));
      } else if (code === 'API_KEY_INVALID') setError(t('dashboard.captureApiKeyError'));
      else if (code === 'QUOTA_EXCEEDED') setError(t('dashboard.captureQuotaError'));
      else if (code === 'SAME_MEAL_MISMATCH') setError(t('dashboard.captureSameMealError'));
      else setError(res.error || t('dashboard.captureAnalyzeFailed'));
      return;
    }

    const data = res.data;
    if (data.error) {
      if (data.error === 'SAME_MEAL_MISMATCH') setError(t('dashboard.captureSameMealError'));
      else setError(data.message || data.error);
      return;
    }

    setResult(data);
    setEditableItems(
      (data.food_items || []).map((item) => ({
        ...item,
        estimated_weight_grams: item.estimated_weight_grams || 100,
      }))
    );
  };

  const analyze = async () => runAnalyze();

  const updateItemGrams = (index: number, grams: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const oldGrams = item.estimated_weight_grams || 100;
      const newGrams = Math.max(1, Math.round(grams));
      const factor = oldGrams > 0 ? newGrams / oldGrams : 1;
      item.estimated_weight_grams = newGrams;
      item.estimated_calories = Math.round((item.estimated_calories || 0) * factor);
      item.macros = {
        protein: Math.round((item.macros?.protein || 0) * factor * 10) / 10,
        carbs: Math.round((item.macros?.carbs || 0) * factor * 10) / 10,
        fat: Math.round((item.macros?.fat || 0) * factor * 10) / 10,
      };
      next[index] = item;
      return next;
    });
  };

  const removeItem = (index: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
  };

  const applyToSlot = async () => {
    if (!editableItems.length) {
      setError(t('dashboard.captureNoItems'));
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const applyRes = await applyCapturedItemsToSlot({
        userId,
        date,
        slotId,
        isLogged,
        items: editableItems,
        existingDraftItems,
      });
      if (applyRes.error) throw new Error(applyRes.error);
      await onApplied(applyRes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.captureApplyFailed'));
    } finally {
      setApplying(false);
    }
  };

  const summary = result?.meal_summary;
  const totalKcal = editableItems.reduce((s, i) => s + (i.estimated_calories || 0), 0);

  const partialPlatePhotos = useMemo(() => {
    const merged = [
      ...partialPlatePhotosFromImages(images),
      ...partialPlatePhotosFromResult(result),
    ];
    return [...new Set(merged)].sort((a, b) => a - b);
  }, [images, result]);

  const showFullPlateAlert = partialPlatePhotos.length > 0;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[210] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-meal-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 id="capture-meal-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('dashboard.captureMealTitle')}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.captureMealSubtitle', { meal: slotLabel })}
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

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {error ? (
                <p className="rounded-lg border border-error-500/30 bg-error-500/10 px-3 py-2 text-xs font-medium text-error-600 dark:text-error-400">
                  {error}
                </p>
              ) : null}

              {showFullPlateAlert ? (
                <div
                  role="alert"
                  className="rounded-xl border-2 border-amber-500 bg-amber-500/15 px-4 py-3 shadow-sm dark:border-amber-400 dark:bg-amber-500/10"
                >
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined shrink-0 text-2xl text-amber-600 dark:text-amber-400">
                      warning
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        {t('dashboard.captureFullPlateAlertTitle')}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                        {t('dashboard.captureFullPlateAlertBody')}
                      </p>
                      <p className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {t('dashboard.captureFullPlatePhotos', {
                          photos: partialPlatePhotos.join(', '),
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!result ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {t('dashboard.capturePhotosLabel')}
                    </label>
                    <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                      {t('dashboard.capturePhotosHint', { max: String(MAX_MEAL_CAPTURE_IMAGES) })}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      {t('dashboard.captureAngleHint')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {MEAL_CAPTURE_ANGLE_HINTS.map((hint) => (
                        <span
                          key={hint.id}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400"
                        >
                          {t(hint.labelKey)}
                        </span>
                      ))}
                    </div>

                    {softValidationWarnings.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-white/[0.03]">
                        <ul className="space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          {softValidationWarnings.map((w, i) => (
                            <li key={i}>
                              • {/blurry/i.test(w) ? t('dashboard.captureBlurNote') : w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {validationWarnings.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          {t('dashboard.captureQualityWarn')}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                          {validationWarnings.map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void addFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        void addFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {images.map((img, idx) => (
                        <div
                          key={img.id}
                          className={cn(
                            'relative aspect-square overflow-hidden rounded-xl border dark:border-gray-700',
                            qualityBorderClass(img.quality) || 'border-gray-200'
                          )}
                        >
                          <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                          <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[9px] font-bold text-white">
                            {idx + 1}
                          </span>
                          {img.quality && !img.quality.full_plate_visible ? (
                            <span className="absolute bottom-1 left-1 right-1 rounded bg-amber-600/90 px-1 py-0.5 text-center text-[8px] font-bold uppercase tracking-wide text-white">
                              {t('dashboard.captureFullPlateBadge')}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            className="absolute right-1 top-1 rounded-full bg-black/55 p-0.5 text-white"
                            aria-label={t('common.close')}
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      ))}
                      {images.length < MAX_MEAL_CAPTURE_IMAGES ? (
                        <div className="flex aspect-square flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-brand-500/40 bg-brand-500/5 px-1 text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
                          >
                            <span className="material-symbols-outlined text-xl">photo_library</span>
                            <span className="text-center text-[9px] font-semibold leading-tight">
                              {t('dashboard.captureAddPhotos')}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 py-1 text-[9px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                          >
                            <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                            {t('dashboard.captureTakePhoto')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="capture-ref" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {t('dashboard.captureRefLabel')}
                    </label>
                    <select
                      id="capture-ref"
                      value={refOption}
                      onChange={(e) => setRefOption(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-white/[0.04] dark:text-white"
                    >
                      {MEAL_CAPTURE_REF_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {t(opt.labelKey)}
                        </option>
                      ))}
                    </select>
                    {refOption === 'custom' ? (
                      <input
                        type="text"
                        value={customRef}
                        onChange={(e) => setCustomRef(e.target.value)}
                        placeholder={t('dashboard.captureRefCustomPlaceholder')}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-white/[0.04] dark:text-white"
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-500/10 px-3 py-2.5">
                    <span className="material-symbols-outlined text-brand-600 dark:text-brand-400">check_circle</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {t('dashboard.captureAnalysisDone', { kcal: String(summary?.estimated_calories ?? totalKcal) })}
                      </p>
                      {summary?.calorie_range ? (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {t('dashboard.captureCalorieRange', {
                            min: String(summary.calorie_range.min),
                            max: String(summary.calorie_range.max),
                          })}
                        </p>
                      ) : null}
                      {typeof summary?.overall_confidence === 'number' ? (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {t('dashboard.captureOverallConfidence', {
                            pct: String(pctFromScore(summary.overall_confidence)),
                          })}
                        </p>
                      ) : null}
                      {typeof summary?.possible_hidden_calories === 'number' &&
                      summary.possible_hidden_calories > 0 ? (
                        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          {t('dashboard.captureHiddenCalories', {
                            kcal: String(summary.possible_hidden_calories),
                          })}
                        </p>
                      ) : null}
                    </div>
                    {summary?.confidence ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          confBadgeClass(summary.confidence)
                        )}
                      >
                        {summary.confidence}
                      </span>
                    ) : null}
                  </div>

                  {result.reference_found === false && refOption !== 'none' ? (
                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      {t('dashboard.captureRefNotFound')}
                    </p>
                  ) : null}

                  {result.same_meal_validation && !result.same_meal_validation.passed ? (
                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      {result.same_meal_validation.issues.join(' · ')}
                    </p>
                  ) : null}

                  {(result.follow_up_questions || []).length > 0 ? (
                    <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-3">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {t('dashboard.captureFollowUpTitle')}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {t('dashboard.captureFollowUpHint')}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                        {(result.follow_up_questions || []).map((q, i) => (
                          <li key={i}>• {q}</li>
                        ))}
                      </ul>
                      <textarea
                        value={followUpAnswers}
                        onChange={(e) => setFollowUpAnswers(e.target.value)}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-white/[0.04] dark:text-white"
                        placeholder={t('dashboard.captureFollowUpHint')}
                      />
                      <button
                        type="button"
                        disabled={analyzing || !followUpAnswers.trim()}
                        onClick={() => void runAnalyze(followUpAnswers)}
                        className="mt-2 rounded-lg bg-brand-500/15 px-3 py-1.5 text-[10px] font-bold text-brand-700 disabled:opacity-50 dark:text-brand-300"
                      >
                        {t('dashboard.captureReanalyze')}
                      </button>
                    </div>
                  ) : null}

                  {(result.analysis_notes || []).length > 0 ? (
                    <details className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
                      <summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-400">
                        {t('dashboard.captureAnalysisNotes')}
                      </summary>
                      <ul className="mt-2 space-y-1 text-[10px] text-gray-500 dark:text-gray-400">
                        {(result.analysis_notes || []).map((note, i) => (
                          <li key={i}>• {note}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {t('dashboard.captureItemsLabel')}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {editableItems.map((item, index) => (
                        <li
                          key={`${item.name}-${index}`}
                          className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {(item.hidden_calorie_sources?.length ? '⚠ ' : '') + item.name}
                              </p>
                              {(item.category || item.cooking_style) ? (
                                <p className="mt-0.5 text-[10px] text-gray-400">
                                  {item.category ? t('dashboard.captureCategory', { category: item.category }) : ''}
                                  {item.category && item.cooking_style ? ' · ' : ''}
                                  {item.cooking_style || ''}
                                </p>
                              ) : null}
                              <p className="mt-0.5 text-[10px] text-gray-500">
                                {item.estimated_calories} kcal · P {item.macros?.protein ?? 0} · C{' '}
                                {item.macros?.carbs ?? 0} · F {item.macros?.fat ?? 0}
                                {typeof item.confidence_score === 'number' ? (
                                  <>
                                    {' '}
                                    ·{' '}
                                    {t('dashboard.captureItemConfidence', {
                                      pct: String(pctFromScore(item.confidence_score)),
                                    })}
                                  </>
                                ) : null}
                                {item.dbMatched && item.webtebId
                                  ? ` · ${t('dashboard.captureDbMatched')}`
                                  : ''}
                                {!item.dbMatched || !item.webtebId ? (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    {' '}
                                    · {t('dashboard.captureDbUnmatched')}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                              aria-label={t('common.close')}
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-[10px] font-medium text-gray-500">{t('dashboard.captureGrams')}</label>
                            <input
                              type="number"
                              min={1}
                              max={5000}
                              value={item.estimated_weight_grams}
                              onChange={(e) => updateItemGrams(index, Number(e.target.value))}
                              className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-white/[0.04]"
                            />
                            <span className="text-[10px] text-gray-400">g</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {!editableItems.length ? (
                      <p className="mt-2 text-xs text-gray-500">{t('dashboard.captureNoItems')}</p>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              {!result ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={!images.length || analyzing || validating}
                    onClick={() => void analyze()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {validating ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        {t('dashboard.captureValidating')}
                      </>
                    ) : analyzing ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        {t('dashboard.captureAnalyzing')}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">auto_awesome</span>
                        {t('dashboard.captureAnalyze')}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setEditableItems([]);
                    }}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  >
                    {t('dashboard.captureRetake')}
                  </button>
                  <button
                    type="button"
                    disabled={!editableItems.length || applying}
                    onClick={() => void applyToSlot()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {applying ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        {t('dashboard.captureApplying')}
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">restaurant</span>
                        {t('dashboard.captureAddToMeal', { meal: slotLabel })}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
