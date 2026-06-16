import React, { useMemo } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useAdminShopQuery } from '../../../lib/adminShopCache';
import adminShopService, { type ConversionFunnel } from '../../../services/adminShopService';
import { AdminLoading, AdminPanel, AdminSection, AdminStatCard } from './adminShopUi';

const STEP_LABELS: Record<string, { en: string; ar: string }> = {
  visit: { en: 'Visitors', ar: 'زوار' },
  search: { en: 'Search', ar: 'بحث' },
  product_view: { en: 'Product view', ar: 'عرض منتج' },
  add_to_cart: { en: 'Add to cart', ar: 'إضافة للسلة' },
  checkout_start: { en: 'Checkout', ar: 'الدفع' },
  paid: { en: 'Paid', ar: 'مدفوع' },
};

function FunnelChart({ funnel, language }: { funnel: ConversionFunnel; language: string }) {
  const max = Math.max(...funnel.steps.map((s) => s.sessions), 1);

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {funnel.steps.map((step, idx) => {
        const label = language === 'ar' ? STEP_LABELS[step.step]?.ar : STEP_LABELS[step.step]?.en;
        const width = Math.max(8, (step.sessions / max) * 100);
        return (
          <div key={step.step}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800 dark:text-white/90">
                {idx > 0 ? '↓ ' : ''}
                {label || step.step}
              </span>
              <span className="tabular-nums text-gray-600 dark:text-gray-400">
                {step.sessions.toLocaleString()}
                {idx > 0 ? ` · ${step.conversionFromPrev}%` : ''}
              </span>
            </div>
            <div className="h-10 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
              <div
                className="flex h-full items-center justify-center rounded-lg bg-gradient-to-r from-brand-500 to-emerald-500 text-xs font-bold text-white transition-all"
                style={{ width: `${width}%`, minWidth: step.sessions > 0 ? '3rem' : 0 }}
              >
                {step.sessions > 0 ? step.sessions : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const AdminConversionFunnelPage: React.FC = () => {
  const { t, language } = useI18n();
  const { data, loading, error, reload } = useAdminShopQuery<ConversionFunnel>(
    'conversion-funnel',
    () => adminShopService.getConversionFunnel(),
  );

  const stats = useMemo(
    () => [
      { label: t('adminShop.funnel.visitors'), value: String(data?.visitCount ?? 0), icon: 'groups' },
      { label: t('adminShop.funnel.paid'), value: String(data?.paidCount ?? 0), icon: 'payments' },
      {
        label: t('adminShop.funnel.overallConversion'),
        value: `${data?.overallConversion ?? 0}%`,
        icon: 'trending_up',
      },
    ],
    [data, t],
  );

  if (loading && !data) return <AdminLoading label={t('adminShop.loading')} />;
  if (error) {
    return (
      <p className="text-sm text-red-500">
        {error}{' '}
        <button type="button" className="underline" onClick={() => void reload()}>
          {t('dashboard.retry')}
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <AdminSection title={t('adminShop.funnel.title')} subtitle={t('adminShop.funnel.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <AdminStatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
          ))}
        </div>
      </AdminSection>
      {data?.migrationPending ? (
        <AdminPanel title={t('adminShop.funnel.migrationPendingTitle')}>
          <p className="text-sm text-amber-600 dark:text-amber-400">{t('adminShop.funnel.migrationPending')}</p>
        </AdminPanel>
      ) : null}
      {data ? (
        <AdminPanel title={t('adminShop.funnel.chartTitle')}>
          <FunnelChart funnel={data} language={language} />
        </AdminPanel>
      ) : null}
    </div>
  );
};
