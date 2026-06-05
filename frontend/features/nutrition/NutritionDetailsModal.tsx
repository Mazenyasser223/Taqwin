import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import nutritionService from '../../services/nutritionService';
import { mapNutritionApiError } from './nutritionApiErrors';
import type { AppLanguage } from '../../services/settingsService';
import type { FdcFoodDetails, FdcNutrientRow } from '../../types';
import type { NutritionFoodRow } from './NutritionFoodList';
import { NutritionMacroDonut } from './NutritionMacroDonut';
import {
  localizeNutrientName,
  localizeServingLabel,
  resolveCategoryLabel,
  resolveFoodDisplayName,
} from './nutritionLocale';

type Props = {
  row: NutritionFoodRow | null;
  onClose: () => void;
};

export function NutrientTable({
  title,
  rows,
  nutrientCol,
  amountCol,
  language,
}: {
  title: string;
  rows: FdcNutrientRow[];
  nutrientCol: string;
  amountCol: string;
  language: AppLanguage;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-faint">{title}</h4>
      <div className="rounded-2xl border border-subtle overflow-x-auto">
        <table className="w-full min-w-[16rem] text-sm">
          <thead>
            <tr className="bg-elevated/80 text-faint text-[10px] uppercase tracking-widest">
              <th className="text-start px-4 py-2 font-black">{nutrientCol}</th>
              <th className="text-end px-4 py-2 font-black">{amountCol}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.id ?? r.name}`} className="border-t border-subtle/60">
                <td className="px-4 py-2.5 text-foreground font-medium break-words">
                  {localizeNutrientName(r.name, language)}
                </td>
                <td className="px-4 py-2.5 text-end text-foreground font-bold tabular-nums whitespace-nowrap">
                  {r.display}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const NutritionDetailsModal: React.FC<Props> = ({ row, onClose }) => {
  const { t, dir, language } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [details, setDetails] = useState<FdcFoodDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = row?.fdcPreview;
  const webtebId =
    preview?.webtebId != null && Number(preview.webtebId) > 0 ? Number(preview.webtebId) : undefined;

  useEffect(() => {
    if (!webtebId) {
      setDetails(null);
      setError(tRef.current('nutrition.errorDetailsFailed'));
      setLoading(false);
      return;
    }
    let cancelled = false;
    const cached = nutritionService.peekFoodDetails(webtebId);
    setError(null);
    setDetails(cached);
    setLoading(!cached);
    nutritionService
      .getNutritionDetails(preview!)
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (res.error || !res.data) {
          if (!cached) {
            setError(
              mapNutritionApiError(res.error, tRef.current) || tRef.current('nutrition.errorDetailsFailed')
            );
          }
          return;
        }
        setDetails(res.data);
        setError(null);
      })
      .catch(() => {
        if (!cancelled && !cached) {
          setLoading(false);
          setError(tRef.current('nutrition.errorDetailsFailed'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [webtebId]);

  if (typeof document === 'undefined') return null;

  const macros =
    details?.macros ??
    (row
      ? { calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat }
      : undefined);
  const breakdown = details?.calorieBreakdown;

  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-background/95 p-0 sm:p-6 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-subtle p-6 sm:p-8 space-y-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrition-details-title"
            dir={dir}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-start">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 mb-1">
                  {t('nutrition.details')}
                </p>
                <h3 id="nutrition-details-title" className="text-xl font-black text-foreground break-words leading-snug">
                  {details
                    ? resolveFoodDisplayName(details.name, details.nameEn, language)
                    : row.name}
                </h3>
                {(details?.foodCategory || row.category || preview?.categoryId) && (
                  <p className="text-xs text-faint mt-1.5">
                    {resolveCategoryLabel(
                      preview?.categoryId,
                      details?.foodCategory ?? row.category,
                      t,
                      language
                    )}
                  </p>
                )}
                <p className="text-[10px] text-faint mt-2 font-bold uppercase tracking-widest">
                  {t('nutrition.per100g')}
                  {details?.servingLabel
                    ? ` · ${localizeServingLabel(details.servingLabel, language)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center text-faint hover:text-foreground"
                aria-label={t('common.cancel')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {error && <p className="text-sm text-red-400 text-center py-4">{error}</p>}

            {macros && (
              <>
                <NutritionMacroDonut
                  protein={macros.protein}
                  carbs={macros.carbs}
                  fat={macros.fat}
                />

                {loading && (
                  <p className="text-sm text-accent animate-pulse text-center py-4">
                    {t('nutrition.detailsLoading')}
                  </p>
                )}

                {breakdown && !loading && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-faint">
                      {t('nutrition.detailsCalories')}
                    </h4>
                    <div className="rounded-2xl bg-elevated/80 border border-subtle px-4 py-3 space-y-2 text-sm">
                      {(
                        [
                          { label: t('nutrition.detailsCalTotal'), value: breakdown.total },
                          { label: t('nutrition.detailsCalCarbs'), value: breakdown.fromCarbs },
                          { label: t('nutrition.detailsCalProtein'), value: breakdown.fromProtein },
                          { label: t('nutrition.detailsCalFat'), value: breakdown.fromFat },
                        ] as const
                      ).map((line) => (
                        <div key={line.label} className="flex items-center justify-between gap-4">
                          <span className="text-faint font-bold">{line.label}</span>
                          <span className="font-black tabular-nums text-foreground">
                            {line.value} {t('nutrition.unitKcal')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {details && !loading && (
                  <div className="space-y-5">
                    <NutrientTable
                      title={t('nutrition.detailsVitamins')}
                      rows={details.vitamins}
                      nutrientCol={t('nutrition.detailsNutrientCol')}
                      amountCol={t('nutrition.detailsAmountCol')}
                      language={language}
                    />
                    <NutrientTable
                      title={t('nutrition.detailsMinerals')}
                      rows={details.minerals}
                      nutrientCol={t('nutrition.detailsNutrientCol')}
                      amountCol={t('nutrition.detailsAmountCol')}
                      language={language}
                    />
                    <NutrientTable
                      title={t('nutrition.detailsNutrients')}
                      rows={details.nutrients}
                      nutrientCol={t('nutrition.detailsNutrientCol')}
                      amountCol={t('nutrition.detailsAmountCol')}
                      language={language}
                    />
                    {details.vitamins.length === 0 &&
                      details.minerals.length === 0 &&
                      details.nutrients.length === 0 && (
                        <p className="text-xs text-faint text-center py-2">{t('nutrition.detailsNoExtra')}</p>
                      )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
