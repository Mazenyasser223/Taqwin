import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useAdminShopQuery } from '../../../lib/adminShopCache';
import adminShopService, { type AdminShopDashboard as AdminShopDashboardData } from '../../../services/adminShopService';
import { AdminRevenueChart } from './AdminRevenueChart';
import {
  AdminAlert,
  AdminEmptyState,
  AdminListRow,
  AdminLoading,
  AdminPanel,
  AdminProductThumb,
  AdminQuickAction,
  AdminRankBadge,
  AdminSecondaryButton,
  AdminSection,
  AdminStatCard,
  formatAdminPrice,
  StatusBadge,
  TA_INPUT,
} from './adminShopUi';

export const AdminShopDashboard: React.FC = () => {
  const { t, language } = useI18n();
  const { data, loading, error, reload } = useAdminShopQuery<AdminShopDashboardData>(
    'dashboard',
    () => adminShopService.getDashboard(),
  );
  const [threshold, setThreshold] = useState('5');
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.lowStockThreshold) setThreshold(String(data.lowStockThreshold));
  }, [data?.lowStockThreshold]);

  const chartData = useMemo(
    () =>
      (data?.revenueByMonth ?? []).map((row) => ({
        month: row.month,
        revenue: row.revenue,
        orders: row.orders,
      })),
    [data?.revenueByMonth],
  );

  const saveThreshold = async () => {
    const n = Number(threshold);
    if (!Number.isFinite(n) || n < 1) return;
    setSavingThreshold(true);
    setSettingsError(null);
    const res = await adminShopService.updateSettings({ lowStockThreshold: Math.floor(n) });
    setSavingThreshold(false);
    if (res.error) setSettingsError(res.error);
    else void reload(true);
  };

  const handleExportOrders = async () => {
    setExporting(true);
    const res = await adminShopService.exportOrdersCsv();
    setExporting(false);
    if (res.error) setSettingsError(res.error);
  };

  if (loading && !data) return <AdminLoading label={t('adminShop.loading')} />;
  if (error && !data) return <AdminAlert>{error}</AdminAlert>;
  if (!data) return null;

  const formatPct = (n: number) =>
    `${n.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', { maximumFractionDigits: 1 })}%`;

  const primaryKpis = [
    {
      label: t('adminShop.kpi.todayOrders'),
      value: String(data.todayOrders ?? 0),
      icon: 'shopping_bag',
      tone: 'brand' as const,
      hint: t('adminShop.kpi.todayOrdersHint'),
      to: '/admin/shop/orders',
    },
    {
      label: t('adminShop.kpi.todayRevenue'),
      value: formatAdminPrice(data.todayRevenue ?? 0, language),
      icon: 'today',
      tone: 'success' as const,
      hint: t('adminShop.kpi.todayRevenueHint'),
      to: '/admin/shop/orders?paymentStatus=paid',
    },
    {
      label: t('adminShop.kpi.monthRevenue'),
      value: formatAdminPrice(data.monthRevenue ?? 0, language),
      icon: 'calendar_month',
      tone: 'info' as const,
      hint: t('adminShop.kpi.monthRevenueHint', { count: String(data.monthPaidOrders ?? 0) }),
      to: '/admin/shop/orders?paymentStatus=paid',
    },
    {
      label: t('adminShop.kpi.conversionRate'),
      value: formatPct(data.conversionRate ?? 0),
      icon: 'percent',
      tone: 'warning' as const,
      hint: t('adminShop.kpi.conversionRateHint', {
        paid: String(data.monthPaidOrders ?? 0),
        total: String(data.monthOrders ?? 0),
      }),
      to: '/admin/shop/orders',
    },
    {
      label: t('adminShop.kpi.aov'),
      value: formatAdminPrice(data.averageOrderValue ?? 0, language),
      icon: 'sell',
      tone: 'brand' as const,
      hint: t('adminShop.kpi.aovHint'),
      to: '/admin/shop/orders?paymentStatus=paid',
    },
  ];

  const secondaryKpis = [
    {
      label: t('adminShop.stats.revenue'),
      value: formatAdminPrice(data.revenue, language),
      icon: 'payments',
      tone: 'success' as const,
      hint: t('adminShop.kpi.allTimeRevenue'),
      to: '/admin/shop/orders?paymentStatus=paid',
    },
    {
      label: t('adminShop.stats.pendingOrders'),
      value: String(data.pendingOrders),
      icon: 'pending_actions',
      tone: 'warning' as const,
      to: '/admin/shop/orders?status=pending',
    },
    {
      label: t('adminShop.stats.products'),
      value: String(data.productsCount),
      icon: 'inventory_2',
      tone: 'info' as const,
      to: '/admin/shop/products',
    },
    {
      label: t('adminShop.stats.orders'),
      value: String(data.ordersCount),
      icon: 'receipt_long',
      tone: 'brand' as const,
      hint: t('adminShop.kpi.allTimeOrders'),
      to: '/admin/shop/orders',
    },
  ];

  return (
    <div className="space-y-8">
      {settingsError ? <AdminAlert>{settingsError}</AdminAlert> : null}

      <AdminSection icon="insights" title={t('adminShop.kpi.dailyTitle')} subtitle={t('adminShop.kpi.dailySubtitle')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {primaryKpis.map((stat) => (
            <AdminStatCard key={stat.label} {...stat} featured />
          ))}
        </div>
      </AdminSection>

      <AdminSection icon="monitoring" title={t('adminShop.kpi.overviewTitle')} subtitle={t('adminShop.kpi.overviewSubtitle')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {secondaryKpis.map((stat) => (
            <AdminStatCard key={stat.label} {...stat} />
          ))}
        </div>
      </AdminSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AdminPanel
          icon="bar_chart"
          accent="brand"
          title={t('adminShop.dashboard.revenueChart')}
          subtitle={t('adminShop.dashboard.revenueChartSub')}
          className="xl:col-span-2"
        >
          {chartData.length === 0 ? (
            <AdminEmptyState icon="bar_chart" title={t('adminShop.topProducts.empty')} />
          ) : (
            <AdminRevenueChart data={chartData} />
          )}
        </AdminPanel>

        <AdminPanel icon="bolt" accent="warning" title={t('adminShop.dashboard.quickActions')} bodyClassName="space-y-2.5">
          {[
            { to: '/admin/shop/products', icon: 'add_box', label: t('adminShop.products.create') },
            { to: '/admin/shop/orders', icon: 'local_shipping', label: t('adminShop.nav.orders') },
            { to: '/admin/shop/products?lowStock=1', icon: 'warning', label: t('adminShop.lowStock.title') },
            { to: '/admin/shop/categories', icon: 'folder_open', label: t('adminShop.nav.categories') },
          ].map((action) => (
            <AdminQuickAction key={action.to} to={action.to} icon={action.icon} label={action.label} />
          ))}
          <AdminSecondaryButton disabled={exporting} onClick={() => void handleExportOrders()}>
            {exporting ? t('adminShop.exporting') : t('adminShop.exportOrdersCsv')}
          </AdminSecondaryButton>
        </AdminPanel>
      </div>

      <AdminPanel icon="tune" accent="info" title={t('adminShop.settings.title')} subtitle={t('adminShop.settings.subtitle')}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {t('adminShop.settings.lowStockThreshold')}
            </label>
            <input
              type="number"
              min={1}
              max={500}
              className={`${TA_INPUT} w-28`}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <AdminSecondaryButton disabled={savingThreshold} onClick={() => void saveThreshold()}>
            {savingThreshold ? t('adminShop.saving') : t('common.save')}
          </AdminSecondaryButton>
        </div>
      </AdminPanel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminPanel
          icon="inventory"
          accent="warning"
          title={t('adminShop.lowStock.title')}
          subtitle={t('adminShop.lowStock.subtitle', { count: String(data.lowStockThreshold) })}
          action={
            <Link
              to="/admin/shop/products?lowStock=1"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-theme-xs font-bold text-brand-500 transition hover:bg-brand-500/10"
            >
              {t('adminShop.viewAll')}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          }
        >
          {data.lowStockProducts.length === 0 ? (
            <AdminEmptyState icon="inventory" title={t('adminShop.lowStock.empty')} />
          ) : (
            <ul className="space-y-2">
              {data.lowStockProducts.slice(0, 8).map((p) => (
                <AdminListRow key={p.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <AdminProductThumb src={p.imageUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="truncate text-theme-xs text-gray-500">{p.brand}</p>
                    </div>
                  </div>
                  <StatusBadge label={`${p.stock}`} status="pending" />
                </AdminListRow>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel
          icon="trending_up"
          accent="success"
          title={t('adminShop.topProducts.title')}
          subtitle={t('adminShop.topProducts.subtitle')}
        >
          {data.topProducts.length === 0 ? (
            <AdminEmptyState icon="trending_up" title={t('adminShop.topProducts.empty')} />
          ) : (
            <ul className="space-y-2">
              {data.topProducts.map((row, index) => (
                <AdminListRow key={row.productId} highlight={index === 0}>
                  <div className="flex min-w-0 items-center gap-3">
                    <AdminRankBadge rank={index + 1} highlight={index === 0} />
                    <AdminProductThumb src={row.product?.imageUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {row.product?.name ?? row.productId}
                      </p>
                      <p className="text-theme-xs text-gray-500">
                        {formatAdminPrice(row.product?.price ?? 0, language)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-white/[0.08] dark:text-gray-200">
                    {row.quantitySold} {t('adminShop.topProducts.sold')}
                  </span>
                </AdminListRow>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </div>
  );
};
