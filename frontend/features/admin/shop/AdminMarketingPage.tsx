import React from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useAdminShopQuery } from '../../../lib/adminShopCache';
import adminShopService, { type AdminCoupon } from '../../../services/adminShopService';
import { AdminLoading, AdminPanel, AdminSection, AdminStatCard } from './adminShopUi';

export const AdminMarketingPage: React.FC = () => {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAdminShopQuery<{ items: AdminCoupon[] }>(
    'marketing-coupons',
    () => adminShopService.getMarketingCoupons(),
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

  const coupons = data?.items ?? [];

  return (
    <div className="space-y-6">
      <AdminSection title={t('adminShop.marketing.title')} subtitle={t('adminShop.marketing.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label={t('adminShop.marketing.coupons')} value={String(coupons.length)} icon="sell" />
          <AdminStatCard label={t('adminShop.marketing.referralBonus')} value="100 pts" icon="group_add" />
          <AdminStatCard label={t('adminShop.marketing.loyaltyRate')} value="10 EGP = 1 pt" icon="loyalty" />
        </div>
      </AdminSection>

      <AdminPanel title={t('adminShop.marketing.couponList')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700">
                <th className="pb-2 pr-3">{t('adminShop.marketing.code')}</th>
                <th className="pb-2 pr-3">{t('adminShop.marketing.discount')}</th>
                <th className="pb-2 pr-3">{t('adminShop.marketing.minOrder')}</th>
                <th className="pb-2 pr-3">{t('adminShop.marketing.used')}</th>
                <th className="pb-2">{t('adminShop.marketing.status')}</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2.5 pr-3 font-mono font-bold">{c.code}</td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {c.type === 'percent' ? `${c.value}%` : `${c.value} EGP`}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{c.minOrderTotal} EGP</td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {c.usedCount}
                    {c.maxUses != null ? ` / ${c.maxUses}` : ''}
                  </td>
                  <td className="py-2.5">{c.isActive ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminPanel title={t('adminShop.marketing.referralTitle')}>
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('adminShop.marketing.referralDesc')}</p>
      </AdminPanel>

      <AdminPanel title={t('adminShop.marketing.loyaltyTitle')}>
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('adminShop.marketing.loyaltyDesc')}</p>
      </AdminPanel>
    </div>
  );
};
