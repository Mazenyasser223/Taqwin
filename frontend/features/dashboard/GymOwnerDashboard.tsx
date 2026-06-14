import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { AnimatePresence, motion } from 'framer-motion';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import dashboardService, {
  type CheckInsRange,
  type GymDashboardClearSection,
  type GymOwnerDashboard as DashType,
  type GymSubscriptionPlan,
} from '../../services/dashboardService';
import type { GymStaff } from '../../types';
import gymService from '../../services/gymService';
import {
  benefitsFromForm,
  emptyPlanBenefitsForm,
  formFromBenefits,
  type PlanBenefitsForm,
} from '../../lib/gymPlanBenefits';
import { PlanBenefitsFields, PlanBenefitsList } from '../../components/gyms/PlanBenefitsFields';
import { GymStaffSection } from '../gyms/GymStaffSection';
import { GymClassesSection } from '../gyms/GymClassesSection';
import {
  Badge,
  Button,
  Card,
  ChartTooltip,
  FilterPills,
  KpiCard,
  PageHeader,
  CARD_INNER,
  INPUT_CLASS,
} from '../../components/tailadmin';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../store/useAuthStore';
import { gymBrandName } from '../../lib/gymBrandName';

const ClassAttendanceBarChart = lazy(() =>
  import('./ClassAttendanceBarChart').then((m) => ({ default: m.ClassAttendanceBarChart })),
);

const PIE_COLORS = ['#158b8d', '#f37021', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];
const CHART_GRID = 'rgba(148, 163, 184, 0.12)';
const CHART_AXIS = 'rgba(148, 163, 184, 0.45)';

type PlanForm = {
  name: string;
  nameAr: string;
  durationDays: string;
  price: string;
  benefits: PlanBenefitsForm;
};

const emptyPlanForm = (): PlanForm => ({
  name: '',
  nameAr: '',
  durationDays: '30',
  price: '',
  benefits: emptyPlanBenefitsForm(),
});

function planLabel(plan: GymSubscriptionPlan, language: string) {
  if (language === 'ar' && plan.nameAr) return plan.nameAr;
  return plan.name;
}

function formatMoney(amount: number, language: string) {
  const suffix = language === 'ar' ? ' ج.م' : ' EGP';
  return `${amount.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}${suffix}`;
}

function UtilizationBar({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="max-w-md">
      <div className="mb-2 flex items-center justify-between text-theme-xs">
        <span className="font-medium text-gray-500">{label}</span>
        <span className="font-bold text-brand-500">{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export const GymOwnerDashboard: React.FC = () => {
  const [data, setData] = useState<DashType | null>(null);
  const { t, language } = useI18n();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planModal, setPlanModal] = useState<'add' | 'edit' | null>(null);
  const [editingPlan, setEditingPlan] = useState<GymSubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm());
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState<GymDashboardClearSection | null>(null);
  const [checkInsRange, setCheckInsRange] = useState<CheckInsRange>('6m');
  const [trainers, setTrainers] = useState<GymStaff[]>([]);
  const hasLoaded = useRef(false);
  const checkInsRangeRef = useRef(checkInsRange);
  const skipRangeFetch = useRef(true);
  checkInsRangeRef.current = checkInsRange;

  const reload = useCallback(async () => {
    const res = await dashboardService.gym(checkInsRangeRef.current);
    if (res.error) {
      setError(res.error);
      setData(null);
    } else {
      setError(null);
      setData(res.data ?? null);
      skipRangeFetch.current = true;
    }
    setLoading(false);
  }, []);

  const loadCheckInsSeries = useCallback(async (range: CheckInsRange) => {
    const res = await dashboardService.gymCheckIns(range);
    if (!res.error && res.data) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              monthlySeries: res.data!.monthlySeries,
              checkInsRange: res.data!.checkInsRange,
            }
          : prev,
      );
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const clearConfirmKey = (section: GymDashboardClearSection) => {
    if (section === 'check-ins') return 'gymDash.clearConfirmCheckIns' as const;
    if (section === 'class-sessions') return 'gymDash.clearConfirmClassSessions' as const;
    return 'gymDash.clearConfirmMembershipPlans' as const;
  };

  const handleClear = useCallback(
    async (section: GymDashboardClearSection) => {
      if (!window.confirm(t(clearConfirmKey(section)))) return;
      setClearing(section);
      const res = await dashboardService.clearGymSection(section);
      setClearing(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      await handleRefresh();
    },
    [handleRefresh, t],
  );

  useEffect(() => {
    let mounted = true;
    if (!hasLoaded.current) setLoading(true);
    else setRefreshing(true);
    void reload().then(() => {
      if (mounted) {
        setRefreshing(false);
        hasLoaded.current = true;
      }
    });
    return () => {
      mounted = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!data?.gym?.id) return;
    if (skipRangeFetch.current) {
      skipRangeFetch.current = false;
      return;
    }
    setRefreshing(true);
    void loadCheckInsSeries(checkInsRange).finally(() => setRefreshing(false));
  }, [checkInsRange, data?.gym?.id, loadCheckInsSeries]);

  useEffect(() => {
    if (!data?.gym?.id) return;
    let mounted = true;
    void gymService.getStaff(data.gym.id, 'trainer').then((res) => {
      if (!mounted || res.error) return;
      setTrainers((res.data ?? []).filter((s) => s.isActive));
    });
    return () => {
      mounted = false;
    };
  }, [data?.gym?.id]);

  const refreshTrainers = useCallback(async () => {
    if (!data?.gym?.id) return;
    const res = await gymService.getStaff(data.gym.id, 'trainer');
    if (!res.error) setTrainers((res.data ?? []).filter((s) => s.isActive));
  }, [data?.gym?.id]);

  const formatMoneyCb = useCallback(
    (amount: number) => formatMoney(amount, language),
    [language],
  );

  const openAddPlan = () => {
    setEditingPlan(null);
    setPlanForm(emptyPlanForm());
    setPlanError(null);
    setPlanModal('add');
  };

  const openEditPlan = (plan: GymSubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      nameAr: plan.nameAr ?? '',
      durationDays: String(plan.durationDays),
      price: String(plan.price),
      benefits: formFromBenefits(plan.benefits),
    });
    setPlanError(null);
    setPlanModal('edit');
  };

  const closePlanModal = () => {
    if (planSaving) return;
    setPlanModal(null);
    setEditingPlan(null);
    setPlanError(null);
  };

  const handleSavePlan = async () => {
    if (!data?.gym?.id) return;
    const name = planForm.name.trim();
    const durationDays = parseInt(planForm.durationDays, 10);
    const price = parseFloat(planForm.price);
    if (!name || !Number.isFinite(durationDays) || durationDays <= 0 || !Number.isFinite(price) || price <= 0) {
      setPlanError(t('gymDash.planPrice'));
      return;
    }
    setPlanSaving(true);
    setPlanError(null);
    const payload = {
      name,
      nameAr: planForm.nameAr.trim() || undefined,
      durationDays,
      price,
      benefits: benefitsFromForm(planForm.benefits) ?? null,
      currency: 'EGP',
      sortOrder: editingPlan?.sortOrder ?? (data.plans?.length ?? 0),
    };
    const res =
      planModal === 'edit' && editingPlan
        ? await gymService.updateGymPlan(data.gym.id, editingPlan.id, payload)
        : await gymService.createGymPlan(data.gym.id, payload);
    setPlanSaving(false);
    if (res.error) {
      setPlanError(res.error);
      return;
    }
    closePlanModal();
    await reload();
  };

  const handleDeactivatePlan = async (plan: GymSubscriptionPlan) => {
    if (!data?.gym?.id || !plan.isActive) return;
    setPlanSaving(true);
    const res = await gymService.deactivateGymPlan(data.gym.id, plan.id);
    setPlanSaving(false);
    if (!res.error) {
      closePlanModal();
      await reload();
    }
  };

  if (loading) {
    return (
      <div className="gym-dashboard page-shell flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-theme-sm text-gray-500">
          <span className="material-symbols-outlined animate-spin text-brand-500">progress_activity</span>
          {t('gymDash.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gym-dashboard page-shell">
        <div className="rounded-2xl border border-error-500/20 bg-error-500/10 p-4 text-theme-sm text-error-500">
          {error}
        </div>
        <Button
          className="mt-4"
          variant="outline"
          icon="refresh"
          onClick={() => {
            setError(null);
            setLoading(true);
            void reload();
          }}
        >
          {t('dashboard.refresh')}
        </Button>
      </div>
    );
  }

  if (!data?.hasGym) {
    return (
      <div className="gym-dashboard page-shell flex justify-center py-8">
        <Card className="max-w-lg text-center" icon="fitness_center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('gymDash.noGym')}</h2>
          <p className="mt-2 text-theme-sm text-gray-500">{t('gymDash.setupDetail')}</p>
          <Button to="/profile" icon="person" className="mt-6">
            {t('gymDash.setupCta')}
          </Button>
        </Card>
      </div>
    );
  }

  const activePlans = (data.plans ?? []).filter((p) => p.isActive);
  const planDistributionTotal = (data.planDistribution ?? []).reduce((sum, e) => sum + e.value, 0);

  const checkInsChartTitle =
    checkInsRange === '1m'
      ? t('gymDash.checkInsChart1m')
      : checkInsRange === '1y'
        ? t('gymDash.checkInsChart1y')
        : t('gymDash.checkInsChart');
  const checkInsXAxisKey = checkInsRange === '1y' ? 'label' : 'month';

  const dashboardRefreshAction = (
    <Button
      size="sm"
      variant="outline"
      icon={refreshing ? 'progress_activity' : 'refresh'}
      className={refreshing ? '[&_.material-symbols-outlined]:animate-spin' : undefined}
      disabled={refreshing || clearing !== null}
      onClick={() => void handleRefresh()}
    >
      {t('dashboard.refresh')}
    </Button>
  );

  const dashboardSectionActions = (
    section: GymDashboardClearSection,
    extra?: React.ReactNode,
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      {extra}
      {dashboardRefreshAction}
      <Button
        size="sm"
        variant="danger"
        icon={clearing === section ? 'progress_activity' : 'delete'}
        className={clearing === section ? '[&_.material-symbols-outlined]:animate-spin' : undefined}
        disabled={refreshing || clearing !== null}
        onClick={() => void handleClear(section)}
      >
        {clearing === section ? t('gymDash.clearing') : t('gymDash.clear')}
      </Button>
    </div>
  );

  const stats = [
    { labelKey: 'gymDash.statTotalMembers' as const, value: data.totals?.members ?? 0, icon: 'groups', accent: 'brand' as const },
    { labelKey: 'gymDash.statActiveMembers' as const, value: data.totals?.activeMembers ?? 0, icon: 'check_circle', accent: 'success' as const },
    { labelKey: 'gymDash.statCheckIns7d' as const, value: data.totals?.weekCheckIns ?? 0, icon: 'login', accent: 'info' as const },
    { labelKey: 'gymDash.statNewMonth' as const, value: data.totals?.newThisMonth ?? 0, icon: 'person_add', accent: 'accent' as const },
    {
      labelKey: 'gymDash.statMonthRevenue' as const,
      value: formatMoney(data.totals?.monthRevenue ?? 0, language),
      icon: 'payments',
      accent: 'warning' as const,
    },
  ];

  return (
    <div className="gym-dashboard page-shell pb-2">
      <PageHeader
        variant="hero"
        badge={t('gymDash.yourGym')}
        title={gymBrandName(user?.profile?.businessName, data.gym?.name) || t('gymDash.yourGym')}
        subtitle={data.gym?.location ?? ''}
        meta={
          <UtilizationBar
            pct={data.totals?.utilization ?? 0}
            label={t('gymDash.utilization', { pct: String(data.totals?.utilization ?? 0) })}
          />
        }
        actions={
          <>
            <Button
              variant="outline"
              icon={refreshing ? 'progress_activity' : 'refresh'}
              className={refreshing ? '[&_.material-symbols-outlined]:animate-spin' : undefined}
              disabled={refreshing}
              onClick={() => void handleRefresh()}
            >
              {t('dashboard.refresh')}
            </Button>
            <Button to="/owner/reception" variant="outline" icon="door_front">
              Reception
            </Button>
            <Button to="/profile" variant="outline" icon="person">
              {t('gymDash.businessProfile')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <KpiCard
            key={stat.labelKey}
            label={t(stat.labelKey)}
            value={stat.value}
            icon={stat.icon}
            accent={stat.accent}
          />
        ))}
      </div>

      <Card
        icon="fitness_center"
        title={t('gymDash.classSessionsTitle')}
        subtitle={t('gymDash.classSessionsSubtitle')}
        headerBorder
        actions={dashboardSectionActions('class-sessions')}
      >
        <Suspense fallback={<div className="h-[280px] animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />}>
          <ClassAttendanceBarChart
            sessions={data.classSessionStats?.sessions ?? []}
            formatMoney={formatMoneyCb}
          />
        </Suspense>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card
          className="lg:col-span-8"
          icon="trending_up"
          title={checkInsChartTitle}
          headerBorder
          actions={dashboardSectionActions(
            'check-ins',
            <FilterPills
              value={checkInsRange}
              options={[
                { value: '1m', label: t('gymDash.checkInsRange1m') },
                { value: '6m', label: t('gymDash.checkInsRange6m') },
                { value: '1y', label: t('gymDash.checkInsRange1y') },
              ]}
              onChange={(v) => setCheckInsRange(v as CheckInsRange)}
            />,
          )}
        >
          <div className={cn('relative h-[240px] sm:h-[320px]', (refreshing || clearing === 'check-ins') && 'opacity-60 transition-opacity')}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlySeries ?? []} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCheckins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#158b8d" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#158b8d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} vertical={false} />
                <XAxis
                  dataKey={checkInsXAxisKey}
                  stroke={CHART_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                  interval={checkInsRange === '1m' ? 'preserveStartEnd' : 0}
                />
                <YAxis stroke={CHART_AXIS} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="checkIns"
                  stroke="#158b8d"
                  fill="url(#colorCheckins)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#158b8d', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#158b8d', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          className="lg:col-span-4"
          icon="donut_large"
          title={t('gymDash.membershipDistribution')}
          subtitle={t('gymDash.planDistributionHint')}
          headerBorder
          actions={dashboardSectionActions('membership-plans')}
        >
          <div className="relative mx-auto h-[200px] w-full max-w-[220px] sm:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.planDistribution ?? []}
                  innerRadius={62}
                  outerRadius={88}
                  dataKey="value"
                  paddingAngle={3}
                  cornerRadius={4}
                >
                  {(data.planDistribution ?? []).map((_, i) => (
                    <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{planDistributionTotal}</span>
              <span className="text-theme-xs text-gray-500">{t('gymDash.statTotalMembers')}</span>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {(data.planDistribution ?? []).map((entry, i) => {
              const pct = planDistributionTotal > 0 ? Math.round((entry.value / planDistributionTotal) * 100) : 0;
              return (
                <div key={entry.name} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                  <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-gray-200">{entry.name}</p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-theme-sm font-bold text-gray-900 dark:text-white">{entry.value}</p>
                    <p className="text-theme-xs text-gray-400">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card
        icon="card_membership"
        title={t('gymDash.subscriptionPlans')}
        subtitle={t('gymDash.planDistributionHint')}
        actions={
          <Button size="sm" icon="add" onClick={openAddPlan}>
            {t('gymDash.addPlan')}
          </Button>
        }
        headerBorder
      >
        {activePlans.length === 0 ? (
          <div className="py-10 text-center">
            <span className="material-symbols-outlined mb-3 text-4xl text-gray-300">inventory_2</span>
            <p className="text-theme-sm text-gray-500">{t('gymDash.noPlans')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activePlans.map((plan, i) => (
              <div
                key={plan.id}
                className={cn(
                  CARD_INNER,
                  'group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-md'
                )}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{planLabel(plan, language)}</h4>
                    {language === 'ar' && plan.nameAr && plan.name !== plan.nameAr && (
                      <p className="mt-0.5 text-theme-xs text-gray-500">{plan.name}</p>
                    )}
                    {language !== 'ar' && plan.nameAr && (
                      <p className="mt-0.5 text-theme-xs text-gray-500">{plan.nameAr}</p>
                    )}
                  </div>
                  <Badge color="primary">{t('gymDash.planMembers', { count: String(plan.memberCount ?? 0) })}</Badge>
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                  <div>
                    <p className="text-2xl font-bold text-brand-500">{formatMoney(plan.price, language)}</p>
                    <p className="mt-1 text-theme-xs text-gray-500">
                      {t('gymDash.planDurationLabel', { days: String(plan.durationDays) })}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEditPlan(plan)}>
                    {t('gymDash.editPlan')}
                  </Button>
                </div>
                {plan.benefits && (
                  <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <PlanBenefitsList benefits={plan.benefits} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.gym?.id && <GymStaffSection gymId={data.gym.id} onStaffChange={() => void refreshTrainers()} />}

      {data.gym?.id && <GymClassesSection gymId={data.gym.id} trainers={trainers} />}

      <AnimatePresence>
        {planModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={closePlanModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-default dark:border-gray-800 dark:bg-gray-900 sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {planModal === 'edit' ? t('gymDash.editPlan') : t('gymDash.addPlan')}
              </h3>

              <div className="mt-5 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-theme-xs font-semibold uppercase text-gray-500">{t('gymDash.planName')}</span>
                  <input
                    value={planForm.name}
                    onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="Monthly"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-theme-xs font-semibold uppercase text-gray-500">{t('gymDash.planNameAr')}</span>
                  <input
                    value={planForm.nameAr}
                    onChange={(e) => setPlanForm((f) => ({ ...f, nameAr: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="شهري"
                    dir="rtl"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-theme-xs font-semibold uppercase text-gray-500">{t('gymDash.planPrice')}</span>
                    <input
                      type="number"
                      min={1}
                      value={planForm.price}
                      onChange={(e) => setPlanForm((f) => ({ ...f, price: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-theme-xs font-semibold uppercase text-gray-500">{t('gymDash.planDuration')}</span>
                    <input
                      type="number"
                      min={1}
                      value={planForm.durationDays}
                      onChange={(e) => setPlanForm((f) => ({ ...f, durationDays: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>
                <PlanBenefitsFields
                  value={planForm.benefits}
                  onChange={(benefits) => setPlanForm((f) => ({ ...f, benefits }))}
                />
              </div>

              {planError && <p className="mt-4 text-theme-sm text-error-500">{planError}</p>}

              <div className="mt-6 flex flex-wrap gap-3">
                <Button disabled={planSaving} onClick={handleSavePlan} className="min-w-[120px] flex-1">
                  {planSaving ? t('gymDash.savingPlan') : t('gymDash.savePlan')}
                </Button>
                {planModal === 'edit' && editingPlan?.isActive && (
                  <Button variant="danger" disabled={planSaving} onClick={() => handleDeactivatePlan(editingPlan)}>
                    {t('gymDash.deactivatePlan')}
                  </Button>
                )}
                <Button variant="outline" disabled={planSaving} onClick={closePlanModal}>
                  {t('common.cancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
