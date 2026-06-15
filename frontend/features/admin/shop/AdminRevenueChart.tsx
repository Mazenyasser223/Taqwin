import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../../../lib/i18n/useI18n';
import { formatAdminPrice } from './adminShopUi';

type ChartPoint = { month: string; revenue: number; orders: number };

function formatMonthLabel(month: string, language: string) {
  const [year, mon] = month.split('-');
  const date = new Date(Number(year), Number(mon) - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
    month: 'short',
    year: '2-digit',
  });
}

function formatAxisRevenue(value: number, language: string) {
  const abs = Math.abs(value);
  const suffix =
    abs >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : abs >= 1_000
        ? `${Math.round(value / 1_000)}k`
        : String(Math.round(value));
  return language === 'ar' ? `${suffix} ج.م` : `EGP ${suffix}`;
}

function RevenueTooltip({
  active,
  payload,
  language,
  revenueLabel,
  ordersLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  language: string;
  revenueLabel: string;
  ordersLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-[180px] rounded-xl border border-gray-200 bg-white px-3.5 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {formatMonthLabel(point.month, language)}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
        {formatAdminPrice(point.revenue, language)}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {ordersLabel}: <span className="font-semibold text-gray-800 dark:text-white/90">{point.orders}</span>
      </p>
      <p className="sr-only">{revenueLabel}</p>
    </div>
  );
}

export const AdminRevenueChart: React.FC<{ data: ChartPoint[] }> = ({ data }) => {
  const { t, language } = useI18n();
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const prepared = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        monthLabel: formatMonthLabel(row.month, language),
      })),
    [data, language]
  );

  const gridStroke = isDark ? '#344054' : '#e4e7ec';
  const tickColor = isDark ? '#98a2b3' : '#667085';

  return (
    <div className="w-full min-h-[300px]" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height={300} debounce={50}>
        <AreaChart
          data={prepared}
          margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#158b8d" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#158b8d" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v) => formatAxisRevenue(Number(v), language)}
          />
          <Tooltip
            cursor={{ stroke: '#158b8d', strokeWidth: 1, strokeDasharray: '4 4' }}
            content={
              <RevenueTooltip
                language={language}
                revenueLabel={t('adminShop.stats.revenue')}
                ordersLabel={t('adminShop.stats.orders')}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#158b8d"
            strokeWidth={2.5}
            fill="url(#adminRevenueFill)"
            dot={{ r: 3, fill: '#158b8d', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#158b8d', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
