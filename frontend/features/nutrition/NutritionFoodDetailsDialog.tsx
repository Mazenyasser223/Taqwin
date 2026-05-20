import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import nutritionService from '../../services/nutritionService';
import type { FdcFoodDetails } from '../../types';
import type { NutritionFoodRow } from './NutritionFoodList';
import { formatNutrientAmount, nutrientDisplayName } from './nutrientLabels';
import { foodDisplayCategory, foodDisplayName } from './foodDisplayName';

type Props = {
  row: NutritionFoodRow | null;
  onClose: () => void;
};

function NutrientTable({
  title,
  rows,
  lang,
  nutrientCol,
  amountCol,
  accentNames = false,
}: {
  title: string;
  rows: { name: string; amount: number; unit: string }[];
  lang: 'en' | 'ar';
  nutrientCol: string;
  amountCol: string;
  accentNames?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div className="space-y-0">
      <motion.div className="bg-emerald-600 text-white text-sm font-black px-4 py-2 rounded-t-lg text-center">
        {title}
      </motion.div>
      <motion.div className="overflow-x-auto rounded-b-lg border border-subtle border-t-0">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-elevated border-b border-subtle">
              <th className="px-4 py-2 text-start font-black text-foreground">{nutrientCol}</th>
              <th className="px-4 py-2 text-end font-black text-foreground">{amountCol}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-subtle/60 last:border-0">
                <td
                  className={`px-4 py-2 ${accentNames ? 'text-sky-400 font-medium' : 'text-foreground/90'}`}
                >
                  {nutrientDisplayName(row.name, lang)}
                </td>
                <td className="px-4 py-2 text-end font-bold tabular-nums text-foreground">
                  {formatNutrientAmount(row.amount, row.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}

export const NutritionFoodDetailsDialog: React.FC<Props> = ({ row, onClose }) => {
  const { t, language, isRtl } = useI18n();
  const lang = language === 'ar' ? 'ar' : 'en';
  const [details, setDetails] = useState<FdcFoodDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fdcId = row?.fdcPreview?.fdcId;

  useEffect(() => {
    if (!fdcId) {
      setDetails(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setDetails(null);
    nutritionService
      .getFdcFoodDetails(fdcId, lang)
      .then((res) => {
        if (res.error) setError(res.error);
        else if (res.data) setDetails(res.data);
      })
      .finally(() => setLoading(false));
  }, [fdcId, lang]);

  if (!row) return null;

  const cal = details?.calories;
  const displayName =
    row.fdcPreview && details
      ? foodDisplayName(
          {
            ...row.fdcPreview,
            name: details.name,
            nameEn: row.fdcPreview.nameEn ?? row.fdcPreview.name,
          },
          lang,
        )
      : row.name;
  const displayCategory =
    row.fdcPreview && details
      ? foodDisplayCategory(
          {
            ...row.fdcPreview,
            foodCategory: details.foodCategory ?? row.fdcPreview.foodCategory,
            foodCategoryEn: row.fdcPreview.foodCategoryEn,
          },
          lang,
          row.category,
        )
      : row.category;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-background/90 p-4 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-panel w-full max-w-2xl rounded-3xl border border-subtle shadow-2xl my-auto max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <motion.div className="flex items-start justify-between gap-4 p-6 border-b border-subtle shrink-0">
            <motion.div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">
                {displayCategory}
              </p>
              <h2 className="text-xl font-black text-foreground break-words">{displayName}</h2>
              <p className="text-xs text-faint mt-1">{t('nutrition.per100g')}</p>
            </motion.div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </motion.div>

          <motion.div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {loading && (
              <p className="text-center text-accent animate-pulse py-8">{t('nutrition.detailsLoading')}</p>
            )}
            {error && <p className="text-center text-red-400 py-4">{error}</p>}
            {!loading && !error && details && (
              <>
                <NutrientTable
                  title={t('nutrition.detailsNutrients')}
                  rows={details.general}
                  lang={lang}
                  nutrientCol={t('nutrition.detailsNutrientCol')}
                  amountCol={t('nutrition.detailsAmountCol')}
                />

                {cal && (
                  <motion.div className="space-y-0">
                    <motion.div className="bg-emerald-600 text-white text-sm font-black px-4 py-2 rounded-t-lg text-center">
                      {t('nutrition.detailsCalories')}
                    </motion.div>
                    <motion.div className="grid sm:grid-cols-[1fr_auto] gap-4 p-4 rounded-b-lg border border-subtle border-t-0 bg-elevated/40">
                      <table className="w-full text-sm">
                        <tbody>
                          {(
                            [
                              { label: t('nutrition.detailsCalTotal'), value: cal.total },
                              { label: t('nutrition.detailsCalCarbs'), value: cal.fromCarbs },
                              { label: t('nutrition.detailsCalFat'), value: cal.fromFat },
                              { label: t('nutrition.detailsCalProtein'), value: cal.fromProtein },
                            ] as const
                          ).map((r) => (
                            <tr key={r.label} className="border-b border-subtle/50 last:border-0">
                              <td className="py-2 text-foreground/90">{r.label}</td>
                              <td className="py-2 text-end font-bold tabular-nums">{r.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <motion.div className="flex flex-col items-center justify-center gap-2">
                        <motion.div
                          className="size-28 rounded-full border-4 border-subtle relative shrink-0"
                          style={{
                            background: `conic-gradient(
                              rgb(251 146 60) 0 ${cal.pctFat}%,
                              rgb(239 68 68) ${cal.pctFat}% ${cal.pctFat + cal.pctProtein}%,
                              rgb(59 130 246) ${cal.pctFat + cal.pctProtein}% 100%
                            )`,
                          }}
                        >
                          <motion.div className="absolute inset-2 rounded-full bg-background flex items-center justify-center text-center p-1">
                            <span className="text-[9px] font-black leading-tight text-faint">
                              {t('nutrition.detailsCalTotal')}
                            </span>
                          </motion.div>
                        </motion.div>
                        <motion.div className="flex flex-wrap gap-2 justify-center text-[10px] font-bold">
                          <span className="text-orange-400">
                            {cal.pctFat}% {t('nutrition.macroFat')}
                          </span>
                          <span className="text-red-400">
                            {cal.pctProtein}% {t('nutrition.macroProt')}
                          </span>
                          <span className="text-blue-400">
                            {cal.pctCarbs}% {t('nutrition.macroCarb')}
                          </span>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                <NutrientTable
                  title={t('nutrition.detailsVitamins')}
                  rows={details.vitamins}
                  lang={lang}
                  nutrientCol={t('nutrition.detailsNutrientCol')}
                  amountCol={t('nutrition.detailsAmountCol')}
                  accentNames
                />

                <NutrientTable
                  title={t('nutrition.detailsMinerals')}
                  rows={details.minerals}
                  lang={lang}
                  nutrientCol={t('nutrition.detailsNutrientCol')}
                  amountCol={t('nutrition.detailsAmountCol')}
                  accentNames
                />
              </>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
