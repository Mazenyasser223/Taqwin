import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { buttonPress } from '../../lib/motion';
import { useI18n } from '../../lib/i18n/useI18n';
import nutritionService from '../../services/nutritionService';
import { mapNutritionApiError } from './nutritionApiErrors';
import type { NutritionFoodRow } from './NutritionFoodList';
import {
  appendDraftItemToMealSlot,
  appendLogToMealSlot,
  rowToPlanItem,
  type MealAddContext,
} from '../dashboard/mealAddContext';
import {
  buildServingUnitOptions,
  computeLogGrams,
  isPieceUnitOption,
  type ServingUnitOption,
  type WebtebServingUnit,
} from './nutritionServingUnits';
import { NUTRITION_MACRO_COLORS } from './nutritionMacroTheme';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=400';

type Props = {
  row: NutritionFoodRow | null;
  mealAddContext?: MealAddContext | null;
  onClose: () => void;
  onLogged: (message: string) => void;
};

export const NutritionLogModal: React.FC<Props> = ({ row, mealAddContext, onClose, onLogged }) => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const servingLocale = useMemo(() => ({ t, language }), [t, language]);
  const [units, setUnits] = useState<ServingUnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitIndex, setUnitIndex] = useState(0);
  const [quantityText, setQuantityText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const unitMenuRef = useRef<HTMLDivElement>(null);

  const selectedUnit = units[unitIndex] ?? null;

  const formatUnitLabel = (u: ServingUnitOption) =>
    u.hint ? `${u.label} · ${u.hint}` : u.label;
  const isPieceUnit = selectedUnit ? isPieceUnitOption(selectedUnit) : false;

  const parsedQuantity = useMemo(() => {
    const raw = quantityText.trim();
    if (raw === '') return null;
    const n = isPieceUnit ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isFinite(n)) return null;
    return n;
  }, [quantityText, isPieceUnit]);

  const effectiveGrams = useMemo(() => {
    if (!selectedUnit || parsedQuantity == null || parsedQuantity < 1) return 0;
    return computeLogGrams(parsedQuantity, selectedUnit);
  }, [parsedQuantity, selectedUnit]);

  const quantityValid = parsedQuantity != null && parsedQuantity >= 1;

  const logMacrosScaled = useMemo(() => {
    if (!row || !quantityValid || effectiveGrams <= 0) return null;
    const factor = effectiveGrams / 100;
    return {
      calories: Math.round(row.calories * factor),
      carbs: Math.round(row.carbs * factor * 10) / 10,
      fat: Math.round(row.fat * factor * 10) / 10,
      protein: Math.round(row.protein * factor * 10) / 10,
    };
  }, [row, effectiveGrams, quantityValid]);

  useEffect(() => {
    if (!row) {
      setUnits([]);
      setUnitIndex(0);
      setQuantityText('');
      setUnitMenuOpen(false);
      return;
    }

    const webtebId = row.fdcPreview?.webtebId;
    if (!webtebId) {
      const fallback = buildServingUnitOptions([], servingLocale);
      setUnits(fallback);
      setUnitIndex(0);
      setQuantityText('');
      return;
    }

    let cancelled = false;
    const cached = nutritionService.peekFoodDetails(Number(webtebId));
    if (cached?.servingUnits?.length) {
      const built = buildServingUnitOptions(cached.servingUnits as WebtebServingUnit[], servingLocale);
      setUnits(built);
      setUnitIndex(0);
      setQuantityText('');
      setUnitsLoading(false);
    } else {
      setUnitsLoading(true);
    }
    nutritionService
      .getFoodDetails(Number(webtebId))
      .then((res) => {
        if (cancelled) return;
        const raw = (res.data?.servingUnits ?? []) as WebtebServingUnit[];
        const built = buildServingUnitOptions(raw, servingLocale);
        setUnits(built);
        setUnitIndex(0);
        setQuantityText('');
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = buildServingUnitOptions([], servingLocale);
        setUnits(fallback);
        setUnitIndex(0);
        setQuantityText('');
      })
      .finally(() => {
        if (!cancelled) setUnitsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [row, language, t]);

  useEffect(() => {
    setUnitMenuOpen(false);
  }, [row]);

  useEffect(() => {
    if (!unitMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (unitMenuRef.current && !unitMenuRef.current.contains(e.target as Node)) {
        setUnitMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [unitMenuOpen]);

  const handleUnitChange = (index: number) => {
    const next = units[index];
    if (!next) return;
    setUnitIndex(index);
    setQuantityText('');
    setUnitMenuOpen(false);
  };

  const normalizeQuantityText = () => {
    if (!selectedUnit) return;
    const raw = quantityText.trim();
    if (raw === '') return;
    const n = isPieceUnit ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isFinite(n) || n < 1) {
      setQuantityText('');
      return;
    }
    setQuantityText(String(isPieceUnit ? Math.max(1, Math.round(n)) : Math.max(1, Math.round(n))));
  };

  const handleQuantityChange = (value: string) => {
    if (isPieceUnit) {
      if (value === '' || /^\d+$/.test(value)) setQuantityText(value);
      return;
    }
    if (value === '' || /^\d*\.?\d*$/.test(value)) setQuantityText(value);
  };

  const submitLog = async () => {
    if (!row || !selectedUnit || !quantityValid || parsedQuantity == null) return;
    setSubmitting(true);
    const grams = effectiveGrams;

    if (mealAddContext) {
      const item = rowToPlanItem(row, grams);
      if (mealAddContext.isLogged) {
        const planRes = await nutritionService.logPlanMeal({
          date: mealAddContext.date,
          slotId: mealAddContext.slotId,
          items: [item],
        });
        setSubmitting(false);
        if (planRes.error || !planRes.data?.logIds.length) {
          onLogged(planRes.error || t('dashboard.editMealSaveFailed'));
          return;
        }
        appendLogToMealSlot(
          mealAddContext.userId,
          mealAddContext.date,
          mealAddContext.slotId,
          planRes.data.logIds
        );
      } else {
        appendDraftItemToMealSlot(
          mealAddContext.userId,
          mealAddContext.date,
          mealAddContext.slotId,
          item,
          mealAddContext.existingDraftItems
        );
        setSubmitting(false);
      }

      onLogged(t('nutrition.addedToMeal', { meal: mealAddContext.slotLabel }));
      onClose();
      navigate('/dashboard');
      return;
    }

    let foodId = row.foodItem?.id;

    if (!foodId && row.fdcPreview) {
      const resolved = await nutritionService.resolveFoodForLog(row.fdcPreview);
      if (resolved.error || !resolved.data) {
        setSubmitting(false);
        onLogged(mapNutritionApiError(resolved.error, t) || t('nutrition.errorImportFailed'));
        return;
      }
      foodId = resolved.data.id;
    }

    if (!foodId) {
      setSubmitting(false);
      return;
    }

    const res = await nutritionService.logFood({ foodItemId: foodId, grams });
    setSubmitting(false);
    if (res.error) {
      onLogged(res.error);
    } else {
      const count = Math.round(parsedQuantity);
      const unitLabel = selectedUnit.hint
        ? `${count} ${selectedUnit.label} (${selectedUnit.hint})`
        : `${count} ${selectedUnit.label}`;
      onLogged(`${t('nutrition.logMeal')}: ${unitLabel} · ${row.name}`);
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-6 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-md rounded-3xl border border-subtle p-8 space-y-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-4">
              <img
                src={row.imageUrl || FALLBACK_IMG}
                className="size-16 rounded-2xl object-cover"
                alt={row.name}
              />
              <div className="min-w-0">
                <h3 className="text-xl font-black break-words">{row.name}</h3>
                <p className="text-xs uppercase text-accent font-black tracking-widest">{row.category}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted tracking-wide">
                  {t('nutrition.quantity')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantityText}
                  disabled={unitsLoading || !selectedUnit}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  onBlur={normalizeQuantityText}
                  placeholder={
                    isPieceUnit
                      ? t('nutrition.quantityPlaceholderPiece')
                      : t('nutrition.quantityPlaceholderGram')
                  }
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50 placeholder:text-faint placeholder:font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted tracking-wide">
                  {t('nutrition.weightUnit')}
                </label>
                {unitsLoading ? (
                  <div className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm text-faint font-bold animate-pulse">
                    {t('nutrition.loading')}
                  </div>
                ) : (
                  <div ref={unitMenuRef} className="relative">
                    <button
                      type="button"
                      disabled={units.length === 0}
                      aria-expanded={unitMenuOpen}
                      aria-haspopup="listbox"
                      onClick={() => setUnitMenuOpen((open) => !open)}
                      className="w-full flex items-center justify-between gap-3 bg-elevated text-foreground border border-subtle rounded-xl px-4 py-3.5 text-base font-bold focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
                    >
                      <span className="truncate text-start flex-1">
                        {selectedUnit ? formatUnitLabel(selectedUnit) : '—'}
                      </span>
                      <span
                        className={`text-muted text-xs shrink-0 transition-transform ${unitMenuOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                      >
                        ▼
                      </span>
                    </button>
                    {unitMenuOpen && units.length > 0 && (
                      <ul
                        role="listbox"
                        className="absolute z-20 mt-2 w-full max-h-52 overflow-y-auto rounded-xl border border-subtle bg-surface shadow-2xl shadow-black/50 py-1"
                      >
                        {units.map((u, i) => {
                          const selected = i === unitIndex;
                          return (
                            <li key={u.id} role="option" aria-selected={selected}>
                              <button
                                type="button"
                                onClick={() => handleUnitChange(i)}
                                className={`w-full px-4 py-3 text-base font-bold text-start transition-colors ${
                                  selected
                                    ? 'bg-accent/20 text-accent'
                                    : 'text-foreground hover:bg-elevated'
                                }`}
                              >
                                {formatUnitLabel(u)}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {selectedUnit && !unitsLoading && (
                <div
                  className={`rounded-2xl border px-5 py-5 text-center transition-colors ${
                    quantityValid && effectiveGrams > 0
                      ? 'border-accent/40 bg-accent/15 shadow-[0_0_24px_rgba(234,88,12,0.12)]'
                      : 'border-subtle bg-elevated/60'
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
                    {t('nutrition.totalGramsLabel')}
                  </p>
                  {quantityValid && effectiveGrams > 0 ? (
                    <>
                      <p className="text-5xl font-black tabular-nums leading-none text-accent">
                        {effectiveGrams}
                      </p>
                      <p className="text-base font-black text-foreground mt-2">
                        {t('nutrition.gramsUnit')}
                      </p>
                      {isPieceUnit && parsedQuantity != null && (
                        <p className="text-sm font-bold text-muted mt-3">
                          {t('nutrition.totalGramsBreakdown', {
                            count: String(Math.round(parsedQuantity)),
                            unit: selectedUnit.label,
                            perUnit: String(selectedUnit.weightGrams),
                          })}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-black text-faint leading-none">—</p>
                      <p className="text-sm font-bold text-muted mt-3 leading-relaxed">
                        {isPieceUnit
                          ? t('nutrition.totalGramsEmptyPiece', {
                              unit: selectedUnit.label,
                              grams: String(selectedUnit.weightGrams),
                            })
                          : t('nutrition.totalGramsEmptyGram')}
                      </p>
                    </>
                  )}
                </div>
              )}

              {logMacrosScaled && (
                <div className="rounded-xl bg-elevated/80 border border-subtle px-4 py-3 space-y-2 text-sm">
                  {(
                    [
                      { label: t('nutrition.logCal'), value: logMacrosScaled.calories, suffix: '', color: NUTRITION_MACRO_COLORS.calories },
                      { label: t('nutrition.logCarb'), value: logMacrosScaled.carbs, suffix: 'g', color: NUTRITION_MACRO_COLORS.carbs },
                      { label: t('nutrition.logFat'), value: logMacrosScaled.fat, suffix: 'g', color: NUTRITION_MACRO_COLORS.fat },
                      { label: t('nutrition.logProtein'), value: logMacrosScaled.protein, suffix: 'g', color: NUTRITION_MACRO_COLORS.protein },
                    ] as const
                  ).map((macro) => (
                    <div key={macro.label} className="flex items-center justify-between gap-4">
                      <span className="text-muted font-bold">{macro.label}:</span>
                      <span className="font-black tabular-nums" style={{ color: macro.color }}>
                        {macro.value}
                        {macro.suffix}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold"
              >
                {t('common.cancel')}
              </button>
              <motion.button
                variants={buttonPress}
                whileHover="hover"
                whileTap="tap"
                onClick={submitLog}
                disabled={submitting || unitsLoading || !selectedUnit || !quantityValid}
                className="flex-1 bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {submitting ? t('nutrition.logging') : t('nutrition.logFood')}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
