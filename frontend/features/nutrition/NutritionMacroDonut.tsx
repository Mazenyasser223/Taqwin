import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useI18n } from '../../lib/i18n/useI18n';

type Props = {
  protein: number;
  carbs: number;
  fat: number;
};

import { NUTRITION_MACRO_COLORS } from './nutritionMacroTheme';

const MACRO_COLORS = [
  NUTRITION_MACRO_COLORS.protein,
  NUTRITION_MACRO_COLORS.carbs,
  NUTRITION_MACRO_COLORS.fat,
] as const;

function formatG(value: number): string {
  if (value > 0 && value < 0.1) return '<0.1';
  return value.toFixed(1);
}

export const NutritionMacroDonut: React.FC<Props> = ({ protein, carbs, fat }) => {
  const { t, isRtl } = useI18n();

  const labels = useMemo(
    () => [t('nutrition.macroProt'), t('nutrition.macroCarb'), t('nutrition.macroFat')],
    [t]
  );

  const { series, grams, hasData, dominantIndex, gramPercents } = useMemo(() => {
    const g = [Math.max(0, protein), Math.max(0, carbs), Math.max(0, fat)];
    const totalGrams = g.reduce((a, b) => a + b, 0);
    const percents = g.map((v) => (totalGrams > 0 ? Math.round((v / totalGrams) * 100) : 0));
    let dom = 0;
    let max = -1;
    g.forEach((v, i) => {
      if (v > max) {
        max = v;
        dom = i;
      }
    });
    return {
      series: g,
      grams: g,
      gramPercents: percents,
      hasData: totalGrams > 0,
      dominantIndex: dom,
    };
  }, [protein, carbs, fat]);

  const [activeIndex, setActiveIndex] = useState(dominantIndex);
  const dominantRef = useRef(dominantIndex);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dominantRef.current = dominantIndex;
    setActiveIndex(dominantIndex);
  }, [dominantIndex]);

  const centerPct = gramPercents[activeIndex] ?? 0;
  const activeColor = MACRO_COLORS[activeIndex];

  const resetToDominant = useCallback(() => {
    setActiveIndex(dominantRef.current);
  }, []);

  const bindLegendHover = useCallback(() => {
    const root = chartWrapRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>('.apexcharts-legend-series').forEach((el, i) => {
      if (el.dataset.macroLegendBound === '1') return;
      el.dataset.macroLegendBound = '1';

      const onEnter = () => setActiveIndex(i);
      const onLeave = () => setActiveIndex(dominantRef.current);

      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });
  }, []);

  const options: ApexOptions = useMemo(
    () => ({
      labels,
      colors: [...MACRO_COLORS],
      chart: {
        fontFamily: 'inherit',
        type: 'donut',
        toolbar: { show: false },
        foreColor: '#e2e8f0',
        background: 'transparent',
        animations: { enabled: true, speed: 350 },
        events: {
          mounted: () => {
            bindLegendHover();
          },
          updated: () => {
            bindLegendHover();
          },
          dataPointMouseEnter: (_e, _ctx, config) => {
            setActiveIndex(config.dataPointIndex);
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      legend: {
        show: true,
        position: 'bottom',
        horizontalAlign: 'center',
        fontSize: '15px',
        fontWeight: 800,
        fontFamily: 'inherit',
        labels: { colors: '#f1f5f9' },
        onItemHover: { highlightDataSeries: true },
        markers: {
          width: 10,
          height: 10,
          radius: 12,
          offsetX: isRtl ? 4 : -4,
        },
        itemMargin: { horizontal: 16, vertical: 8 },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: { show: false },
          },
        },
      },
      tooltip: {
        theme: 'dark',
        style: {
          fontSize: '15px',
          fontFamily: 'inherit',
        },
        y: {
          formatter: (_val, opts) => {
            const i = opts.seriesIndex ?? 0;
            return `${labels[i]}: ${gramPercents[i]}% · ${formatG(grams[i])}g`;
          },
        },
      },
      states: {
        hover: { filter: { type: 'lighten', value: 0.1 } },
        active: { filter: { type: 'none' } },
      },
    }),
    [labels, grams, gramPercents, series, isRtl, bindLegendHover]
  );

  useEffect(() => {
    if (!hasData) return;
    const id = requestAnimationFrame(() => bindLegendHover());
    return () => cancelAnimationFrame(id);
  }, [hasData, labels, series, bindLegendHover]);

  useEffect(() => {
    const root = chartWrapRef.current;
    if (!root || !hasData) return;

    const onWrapLeave = (e: MouseEvent) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) resetToDominant();
    };

    root.addEventListener('mouseleave', onWrapLeave);
    return () => root.removeEventListener('mouseleave', onWrapLeave);
  }, [hasData, resetToDominant]);

  return (
    <div className="rounded-2xl border border-subtle bg-elevated/80 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <h4 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">
          {t('nutrition.macroDistribution')}
        </h4>
      </div>

      {hasData ? (
        <div ref={chartWrapRef} className="relative px-1 pb-2" dir="ltr">
          <Chart options={options} series={series} type="donut" height={320} />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12 transition-colors duration-200"
            aria-live="polite"
          >
            <span
              className="text-sm font-black uppercase tracking-widest transition-colors duration-200"
              style={{ color: activeColor }}
            >
              {labels[activeIndex]}
            </span>
            <span
              className="text-5xl sm:text-[3.25rem] font-black tabular-nums leading-none mt-2 transition-colors duration-200"
              style={{ color: activeColor }}
            >
              {formatG(grams[activeIndex])}
              <span className="text-3xl font-black ms-0.5" style={{ color: activeColor }}>
                g
              </span>
            </span>
            <span
              className="text-xl font-black mt-2 tabular-nums opacity-90 transition-colors duration-200"
              style={{ color: activeColor }}
            >
              {centerPct}%
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm font-bold text-muted text-center py-16 px-4">{t('nutrition.macroChartEmpty')}</p>
      )}
    </div>
  );
};
