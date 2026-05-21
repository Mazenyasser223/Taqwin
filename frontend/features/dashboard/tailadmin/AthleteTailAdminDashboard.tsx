import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { Link } from 'react-router-dom';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useAuthStore } from '../../../store/useAuthStore';
import dashboardService, { type AthleteHomeDashboard } from '../../../services/dashboardService';
import { Badge } from '../../../components/tailadmin/Badge';
import { cn } from '../../../lib/cn';

const CARD =
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';

const BRAND = '#158b8d';
const ACCENT = '#f37021';

function DeltaBadge({ value }: { value: number }) {
  const up = value > 0;
  const down = value < 0;
  return (
    <Badge color={up ? 'success' : down ? 'error' : 'light'}>
      <span className="material-symbols-outlined text-sm">
        {up ? 'arrow_upward' : down ? 'arrow_downward' : 'remove'}
      </span>
      {Math.abs(value)}%
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  delta,
}: {
  label: string;
  value: number;
  unit: string;
  icon: string;
  delta: number;
}) {
  return (
    <div className={cn(CARD, 'p-5 md:p-6')}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
        <span className="material-symbols-outlined text-gray-800 dark:text-foreground/90">{icon}</span>
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div>
          <span className="text-theme-sm text-gray-500 dark:text-gray-400">{label}</span>
          <h4 className="mt-2 text-title-sm font-bold text-gray-800 dark:text-foreground/90">
            {value.toLocaleString()}
            <span className="ml-1 text-sm font-bold text-gray-500">{unit}</span>
          </h4>
        </div>
        <DeltaBadge value={delta} />
      </div>
    </div>
  );
}

function TodayScoreCard({ data }: { data: AthleteHomeDashboard }) {
  const { t } = useI18n();
  const score = data.today.readinessScore;
  const options: ApexOptions = {
    colors: [BRAND],
    chart: { fontFamily: 'Space Grotesk, sans-serif', type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -85,
        endAngle: 85,
        hollow: { size: '78%' },
        track: { background: '#E4E7EC', strokeWidth: '100%', margin: 5 },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: '28px',
            fontWeight: 700,
            offsetY: -8,
            color: '#fff',
            formatter: (v) => `${Math.round(v)}`,
          },
        },
      },
    },
    labels: ['Today'],
  };

  return (
    <div className={cn(CARD, 'p-5 sm:p-6')}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">{t('dashboard.todayScore')}</h3>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">Workout · meals · protein</p>
      <div className="mx-auto max-w-[220px] py-2">
        <Chart options={options} series={[score]} type="radialBar" height={220} />
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-theme-xs">
        <Badge color={data.today.readiness.workout ? 'success' : 'light'}>Workout</Badge>
        <Badge color={data.today.readiness.nutrition ? 'success' : 'light'}>Meals</Badge>
        <Badge color="primary">Protein {data.today.readiness.proteinProgress}%</Badge>
      </div>
    </div>
  );
}

function CalorieBalanceCard({ data }: { data: AthleteHomeDashboard }) {
  const eaten = data.today.nutrition.calories;
  const burned = data.today.caloriesBurned;
  const target = data.targets.calorieTarget;
  const eatenPct = target ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  const burnedPct = target ? Math.min(100, Math.round((burned / target) * 100)) : 0;

  return (
    <div className={cn(CARD, 'p-5 sm:p-6 space-y-4')}>
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">Calorie Balance</h3>
        <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-foreground/90">
          {eaten - burned >= 0 ? '+' : ''}
          {eaten - burned}{' '}
          <span className="text-sm font-medium text-gray-500">kcal net</span>
        </p>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-theme-xs font-medium text-gray-500">
          <span>Eaten</span>
          <span className="text-orange-400">{eaten} kcal</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${eatenPct}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-theme-xs font-medium text-gray-500">
          <span>Burned</span>
          <span style={{ color: BRAND }}>{burned} kcal</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full transition-all" style={{ width: `${burnedPct}%`, background: BRAND }} />
        </div>
      </div>
    </div>
  );
}

function MacrosDonutCard({ data }: { data: AthleteHomeDashboard }) {
  const p = Math.round(data.today.nutrition.protein);
  const c = Math.round(data.today.nutrition.carbs);
  const f = Math.round(data.today.nutrition.fat);
  const series = [p * 4, c * 4, f * 9];
  const has = series.some((v) => v > 0);

  const options: ApexOptions = {
    labels: ['Protein', 'Carbs', 'Fat'],
    colors: [BRAND, ACCENT, '#6366f1'],
    chart: { fontFamily: 'Space Grotesk, sans-serif', type: 'donut' },
    legend: { show: false },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: '70%' } } },
  };

  return (
    <div className={cn(CARD, 'p-5 sm:p-6')}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">Macros Today</h3>
      {has ? (
        <Chart options={options} series={series} type="donut" height={200} />
      ) : (
        <p className="py-12 text-center text-theme-sm text-gray-500">Log a meal to see macros</p>
      )}
      <div className="grid grid-cols-3 gap-2 text-center text-theme-xs">
        <div><p className="text-gray-500">Protein</p><p className="font-bold" style={{ color: BRAND }}>{p}g</p></div>
        <div><p className="text-gray-500">Carbs</p><p className="font-bold text-orange-400">{c}g</p></div>
        <div><p className="text-gray-500">Fat</p><p className="font-bold text-indigo-400">{f}g</p></div>
      </div>
    </div>
  );
}

function WeeklyBarChart({ data }: { data: AthleteHomeDashboard }) {
  const options: ApexOptions = useMemo(
    () => ({
      colors: [BRAND, ACCENT],
      chart: { fontFamily: 'Space Grotesk, sans-serif', type: 'bar', toolbar: { show: false }, height: 200 },
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: { categories: data.weekly.map((d) => d.day) },
      legend: { position: 'top' },
      grid: { strokeDashArray: 4 },
    }),
    [data.weekly]
  );

  const series = useMemo(
    () => [
      { name: 'Burned', data: data.weekly.map((d) => d.caloriesBurned) },
      { name: 'Eaten', data: data.weekly.map((d) => d.caloriesEaten) },
    ],
    [data.weekly]
  );

  return (
    <div className={cn(CARD, 'overflow-hidden px-5 pb-5 pt-5 sm:px-6 sm:pt-6')}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">Weekly Energy</h3>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">Burned vs eaten · last 7 days</p>
      <div className="mt-4 min-w-0">
        <Chart options={options} series={series} type="bar" height={220} />
      </div>
    </div>
  );
}

function EnergyAreaChart({ data }: { data: AthleteHomeDashboard }) {
  const options: ApexOptions = useMemo(
    () => ({
      colors: [BRAND, ACCENT],
      chart: { fontFamily: 'Space Grotesk, sans-serif', type: 'area', toolbar: { show: false }, height: 300 },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.05 } },
      dataLabels: { enabled: false },
      xaxis: { categories: data.weekly.map((d) => d.day) },
      legend: { position: 'top' },
      grid: { borderColor: '#1b323d', strokeDashArray: 4 },
    }),
    [data.weekly]
  );

  const series = useMemo(
    () => [
      { name: 'Calories burned', data: data.weekly.map((d) => d.caloriesBurned) },
      { name: 'Calories eaten', data: data.weekly.map((d) => d.caloriesEaten) },
    ],
    [data.weekly]
  );

  return (
    <div className={cn(CARD, 'px-5 pb-5 pt-5 sm:px-6 sm:pt-6')}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">Energy Statistics</h3>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">Interactive weekly trends</p>
      <div className="mt-4 overflow-x-auto custom-scrollbar">
        <Chart options={options} series={series} type="area" height={300} />
      </div>
    </div>
  );
}

function MonthlyTargetCard({ data }: { data: AthleteHomeDashboard }) {
  const proteinPct = Math.min(100, Math.round((data.today.nutrition.protein / data.targets.proteinTarget) * 100));
  const caloriePct = Math.min(100, Math.round((data.today.nutrition.calories / data.targets.calorieTarget) * 100));

  const options: ApexOptions = {
    colors: [BRAND],
    chart: { fontFamily: 'Space Grotesk, sans-serif', type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        hollow: { size: '75%' },
        dataLabels: {
          value: { fontSize: '32px', fontWeight: 600, color: '#fff', formatter: (v) => `${Math.round(v)}%` },
        },
      },
    },
    labels: ['Goal'],
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="rounded-2xl bg-white px-5 pb-8 pt-5 shadow-default dark:bg-gray-900 sm:px-6 sm:pt-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">Goal Progress</h3>
        <p className="mt-1 text-theme-sm text-gray-500">
          {data.profile.fitnessGoal || 'Set your goal in Profile'}
        </p>
        <div className="mx-auto max-w-[280px]">
          <Chart options={options} series={[proteinPct]} type="radialBar" height={280} />
        </div>
        <p className="text-center text-theme-sm text-gray-500">
          Calories today: {caloriePct}% · Streak: {data.streak} days
        </p>
      </div>
      <div className="flex items-center justify-center gap-6 px-4 py-4 text-theme-sm">
        <div className="text-center">
          <p className="text-gray-500">Target kcal</p>
          <p className="font-semibold text-gray-800 dark:text-foreground/90">{data.targets.calorieTarget}</p>
        </div>
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-800" />
        <div className="text-center">
          <p className="text-gray-500">Protein goal</p>
          <p className="font-semibold text-gray-800 dark:text-foreground/90">{data.targets.proteinTarget}g</p>
        </div>
      </div>
    </div>
  );
}

function HeatmapCard({ data }: { data: AthleteHomeDashboard }) {
  const max = Math.max(1, ...data.heatmap.map((h) => h.workouts));
  return (
    <div className={cn(CARD, 'p-5 sm:p-6')}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">Consistency</h3>
      <p className="mt-1 text-3xl font-bold text-gray-800 dark:text-foreground/90">
        {data.streak}
        <span className="ml-2 text-base font-medium text-gray-500">day streak</span>
      </p>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {data.heatmap.map((cell) => (
          <div
            key={cell.date}
            title={`${cell.date}: ${cell.workouts} workouts`}
            className="aspect-square rounded-md border border-gray-200 dark:border-gray-800"
            style={{
              background:
                cell.workouts === 0
                  ? 'rgba(255,255,255,0.05)'
                  : `rgba(21, 139, 141, ${0.25 + (cell.workouts / max) * 0.75})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityTable({ data }: { data: AthleteHomeDashboard }) {
  const { t } = useI18n();
  return (
    <div className={cn(CARD, 'overflow-hidden px-4 pb-3 pt-4 sm:px-6')}>
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-foreground/90">Today&apos;s Activity</h3>
      {data.timeline.length === 0 ? (
        <p className="py-8 text-center text-theme-sm text-gray-500">{t('dashboard.noActivity')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">Time</th>
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">Activity</th>
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">Detail</th>
                <th className="pb-3 text-left text-theme-xs font-medium text-gray-500">Type</th>
              </tr>
            </thead>
            <tbody>
              {data.timeline.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800/80">
                  <td className="py-3 text-theme-sm text-gray-500">
                    {new Date(row.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 font-medium text-gray-800 dark:text-foreground/90">{row.title}</td>
                  <td className="py-3 text-theme-sm text-gray-500">{row.subtitle}</td>
                  <td className="py-3">
                    <Badge color={row.type === 'workout' ? 'primary' : 'warning'}>{row.type}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CoachCard({ tip }: { tip: string }) {
  return (
    <div className={cn(CARD, 'flex h-full flex-col justify-between p-6 bg-brand-500/10 border-brand-500/30')}>
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
            <span className="material-symbols-outlined">psychology_alt</span>
          </div>
          <div>
            <p className="text-theme-xs font-semibold uppercase tracking-wider text-brand-400">Smart Coach</p>
            <p className="text-theme-xs text-gray-500">Personalized insight</p>
          </div>
        </div>
        <p className="text-lg font-semibold leading-snug text-gray-800 dark:text-foreground/90">{tip}</p>
      </div>
      <Link
        to="/ai-assistant"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:brightness-110"
      >
        Talk to Coach
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </div>
  );
}

function UpcomingTable({ data }: { data: AthleteHomeDashboard }) {
  const { t } = useI18n();
  const rows = [
    ...data.upcoming.bookings.map((b) => ({
      id: b.id,
      title: `Session · ${b.trainer}`,
      sub: new Date(b.scheduledAt).toLocaleString(),
      status: b.status,
    })),
    ...data.upcoming.notifications.filter((n) => !n.read).slice(0, 3).map((n) => ({
      id: n.id,
      title: n.title,
      sub: n.message.slice(0, 50),
      status: 'alert',
    })),
  ];

  return (
    <div className={cn(CARD, 'overflow-hidden px-4 pb-3 pt-4 sm:px-6')}>
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-foreground/90">Coming Up</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-theme-sm text-gray-500">{t('dashboard.nothingScheduled')}</p>
      ) : (
        <table className="w-full">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/80">
                <td className="py-3">
                  <p className="font-medium text-gray-800 dark:text-foreground/90">{r.title}</p>
                  <p className="text-theme-xs text-gray-500">{r.sub}</p>
                </td>
                <td className="py-3 text-right">
                  <Badge color="primary">{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CommunityTable({ posts }: { posts: AthleteHomeDashboard['community'] }) {
  if (!posts.length) return null;
  return (
    <div className={cn(CARD, 'overflow-hidden px-4 pb-3 pt-4 sm:px-6')}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground/90">Community Pulse</h3>
        <Link to="/community" className="text-theme-sm font-medium text-brand-400 hover:underline">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[20rem]">
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800/80">
              <td className="py-3 font-medium text-gray-800 dark:text-foreground/90 whitespace-nowrap">{p.author}</td>
              <td className="max-w-[12rem] sm:max-w-md py-3 text-theme-sm text-gray-500 break-words">{p.content}</td>
              <td className="py-3 text-right text-theme-xs text-gray-500">
                {p.likesCount} likes · {p.commentsCount} comments
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const QUICK = [
  { to: '/workouts', label: 'Log Workout', icon: 'fitness_center' },
  { to: '/nutrition', label: 'Log Meal', icon: 'restaurant' },
  { to: '/ai-assistant', label: 'AI Coach', icon: 'auto_awesome' },
  { to: '/trainers', label: 'Book Trainer', icon: 'person_search' },
  { to: '/gyms', label: 'Gyms', icon: 'apartment' },
  { to: '/community', label: 'Community', icon: 'groups' },
];

export const AthleteTailAdminDashboard: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  const [data, setData] = useState<AthleteHomeDashboard | null>(null);
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await dashboardService.athleteHome();
    if (res.error) setError(res.error);
    else {
      setError(null);
      setData(res.data ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const name = data?.profile.displayName || authUser?.profile?.displayName;

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="animate-pulse text-brand-400 font-medium">{t('dashboard.loading')}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={cn(CARD, 'p-8 text-center')}>
        <p className="text-error-500">{error}</p>
        <button type="button" onClick={load} className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-white font-semibold">
          {t('dashboard.retry')}
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="page-shell w-full min-w-0 pb-2">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-theme-xs font-semibold uppercase tracking-widest text-brand-400">TailAdmin · Taqwin</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-800 dark:text-foreground/90 sm:text-3xl">
            {t('dashboard.welcome')}{name ? `, ${name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500">
            {data.totals.workouts} workouts this week · {data.streak} day streak · {data.today.readinessScore}% today
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-gray-200 px-4 py-2 text-theme-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
          >
            Refresh
          </button>
          <Link
            to="/workouts"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-semibold text-white"
          >
            <span className="material-symbols-outlined text-lg">bolt</span>
            Start Workout
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6">
          <MetricCard label="Workouts" value={data.totals.workouts} unit="/ week" icon="fitness_center" delta={data.comparison.workouts} />
          <MetricCard label="Minutes" value={data.totals.minutes} unit="min" icon="schedule" delta={data.comparison.minutes} />
          <MetricCard label="Burned" value={data.totals.caloriesBurned} unit="kcal" icon="local_fire_department" delta={data.comparison.caloriesBurned} />
          <MetricCard label="Eaten" value={data.totals.caloriesEaten} unit="kcal" icon="restaurant" delta={data.comparison.caloriesEaten} />
        </div>

        <div className="col-span-12 space-y-6 xl:col-span-7">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            <TodayScoreCard data={data} />
            <CalorieBalanceCard data={data} />
            <MacrosDonutCard data={data} />
          </div>
          <WeeklyBarChart data={data} />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <MonthlyTargetCard data={data} />
        </div>

        <div className="col-span-12">
          <EnergyAreaChart data={data} />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <HeatmapCard data={data} />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <ActivityTable data={data} />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <CoachCard tip={data.coachTip} />
        </div>

        <div className="col-span-12 xl:col-span-7 space-y-6">
          <UpcomingTable data={data} />
          <CommunityTable posts={data.community} />
        </div>

        <div className="col-span-12">
          <div className={cn(CARD, 'p-4')}>
            <p className="mb-3 text-theme-xs font-semibold uppercase tracking-wider text-gray-500">{t('dashboard.quickActions')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {QUICK.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 text-theme-xs font-semibold text-gray-700 transition hover:border-brand-500/40 hover:bg-brand-500/10 dark:border-gray-800 dark:text-gray-300"
                >
                  <span className="material-symbols-outlined text-brand-400">{q.icon}</span>
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
