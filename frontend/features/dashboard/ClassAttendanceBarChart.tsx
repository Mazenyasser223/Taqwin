import React, { useMemo } from 'react';

import {

  Bar,

  BarChart,

  CartesianGrid,

  Legend,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts';

import { useI18n } from '../../lib/i18n/useI18n';

import type { TranslationKey } from '../../lib/i18n/translations';



const BOOKED_COLOR = '#3b82f6';

const ATTENDED_COLOR = '#10b981';

const NO_SHOW_COLOR = '#94a3b8';

const CHART_GRID = 'rgba(148, 163, 184, 0.12)';

const CHART_AXIS = 'rgba(148, 163, 184, 0.45)';



export type ClassChartRow = {

  classId: string;

  name: string;

  nameAr?: string | null;

  booked: number;

  attended: number;

  noShow: number;

  bookedRevenue: number;

  attendedRevenue: number;

  noShowRevenue: number;

  revenue: number;

};



type ChartPoint = ClassChartRow & {

  label: string;

};



function ClassBarTooltip({

  active,

  payload,

  formatMoney,

  t,

}: {

  active?: boolean;

  payload?: Array<{ payload?: ChartPoint }>;

  formatMoney: (amount: number) => string;

  t: (key: TranslationKey, params?: Record<string, string>) => string;

}) {

  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;

  if (!point) return null;



  return (

    <div className="min-w-[168px] rounded-xl border border-gray-700/50 bg-gray-900/95 px-3.5 py-2.5 shadow-xl backdrop-blur-sm">

      <p className="mb-2 text-theme-xs font-medium text-gray-400">{point.label}</p>

      <p className="text-theme-sm font-semibold text-white">

        {t('gymDash.classChartBooked')}: {point.booked}

        <span className="ms-1 font-normal text-gray-400">({formatMoney(point.bookedRevenue)})</span>

      </p>

      <p className="mt-1 text-theme-sm font-semibold text-emerald-400">

        {t('gymDash.classChartAttended')}: {point.attended}

        <span className="ms-1 font-normal text-gray-400">({formatMoney(point.attendedRevenue)})</span>

      </p>

      <p className="mt-1 text-theme-sm font-semibold text-slate-400">

        {t('gymDash.classChartNoShow')}: {point.noShow}

        <span className="ms-1 font-normal text-gray-500">({formatMoney(point.noShowRevenue)})</span>

      </p>

      <p className="mt-2 border-t border-gray-700/50 pt-2 text-theme-xs font-bold text-brand-400">

        {t('gymDash.classChartRevenue')}: {formatMoney(point.revenue)}

      </p>

    </div>

  );

}



function truncateLabel(label: string, max = 14) {

  if (label.length <= max) return label;

  return `${label.slice(0, max - 1)}…`;

}



export const ClassAttendanceBarChart = React.memo(function ClassAttendanceBarChart({

  sessions,

  formatMoney,

}: {

  sessions: ClassChartRow[];

  formatMoney: (amount: number) => string;

}) {

  const { t, language } = useI18n();



  const chartData = useMemo<ChartPoint[]>(

    () =>

      sessions.map((row) => ({

        ...row,

        label: language === 'ar' && row.nameAr ? row.nameAr : row.name,

      })),

    [sessions, language],

  );



  const yMax = useMemo(() => {

    const peak = chartData.reduce(

      (max, row) => Math.max(max, row.booked, row.attended, row.noShow),

      0,

    );

    if (peak <= 0) return 4;

    const step = peak <= 10 ? 2 : peak <= 50 ? 10 : 50;

    return Math.ceil(peak / step) * step;

  }, [chartData]);



  if (chartData.length === 0) {

    return (

      <div className="flex h-[280px] items-center justify-center text-theme-sm text-gray-500">

        {t('gymDash.classSessionsEmpty')}

      </div>

    );

  }



  return (

    <div className="relative h-[280px] sm:h-[320px]">

      <ResponsiveContainer width="100%" height="100%">

        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 4 }} barCategoryGap="20%" barGap={3}>

          <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />

          <XAxis

            dataKey="label"

            stroke={CHART_AXIS}

            fontSize={11}

            tickLine={false}

            axisLine={false}

            dy={8}

            interval={0}

            tickFormatter={(value: string) => truncateLabel(value)}

          />

          <YAxis

            stroke={CHART_AXIS}

            fontSize={11}

            tickLine={false}

            axisLine={false}

            allowDecimals={false}

            domain={[0, yMax]}

          />

          <Tooltip

            content={<ClassBarTooltip formatMoney={formatMoney} t={t} />}

            cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}

          />

          <Legend

            verticalAlign="top"

            align="right"

            iconType="circle"

            iconSize={8}

            wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}

            formatter={(value) => (

              <span className="text-theme-xs text-gray-500">{value}</span>

            )}

          />

          <Bar

            dataKey="booked"

            name={t('gymDash.classChartBooked')}

            fill={BOOKED_COLOR}

            radius={[4, 4, 0, 0]}

            maxBarSize={22}

          />

          <Bar

            dataKey="attended"

            name={t('gymDash.classChartAttended')}

            fill={ATTENDED_COLOR}

            radius={[4, 4, 0, 0]}

            maxBarSize={22}

          />

          <Bar

            dataKey="noShow"

            name={t('gymDash.classChartNoShow')}

            fill={NO_SHOW_COLOR}

            radius={[4, 4, 0, 0]}

            maxBarSize={22}

          />

        </BarChart>

      </ResponsiveContainer>

    </div>

  );

});
