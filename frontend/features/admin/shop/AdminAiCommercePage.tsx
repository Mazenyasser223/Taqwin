import React, { useMemo } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useAdminShopQuery } from '../../../lib/adminShopCache';
import adminShopService, { type AiCommerceAnalytics } from '../../../services/adminShopService';
import {
  AdminAlert,
  AdminEmptyState,
  AdminLoading,
  AdminPanel,
  AdminProductThumb,
  AdminRankBadge,
  AdminSection,
  AdminStatCard,
  formatAdminPrice,
} from './adminShopUi';

function RevenueBySourceChart({
  rows,
  language,
}: {
  rows: NonNullable<AiCommerceAnalytics['revenueBySource']>['bySource'];
  language: string;
}) {
  const maxShare = Math.max(...rows.map((r) => r.sharePercent), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const label = language === 'ar' ? row.labelAr : row.labelEn;
        return (
          <div key={row.source}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-800 dark:text-white/90">{label}</span>
              <span className="tabular-nums text-gray-600 dark:text-gray-400">
                {row.sharePercent}% · {formatAdminPrice(row.revenue, language)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500"
                style={{ width: `${(row.sharePercent / maxShare) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const AdminAiCommercePage: React.FC = () => {
  const { t, language } = useI18n();
  const { data, loading, error, reload } = useAdminShopQuery<AiCommerceAnalytics>(
    'ai-commerce',
    () => adminShopService.getAiCommerce(),
  );

  const stats = useMemo(
    () => [
      {
        label: t('adminShop.aiCommerce.shown'),
        value: String(data?.recommendationsShown ?? 0),
        icon: 'visibility',
      },
      {
        label: t('adminShop.aiCommerce.bundlesAdded'),
        value: String(data?.bundlesAdded ?? 0),
        icon: 'shopping_bag',
      },
      {
        label: t('adminShop.aiCommerce.aiOrders'),
        value: String(data?.aiOrders ?? 0),
        icon: 'receipt_long',
      },
      {
        label: t('adminShop.aiCommerce.aiRevenue'),
        value: formatAdminPrice(data?.aiRevenue ?? 0, language),
        icon: 'payments',
      },
      {
        label: t('adminShop.aiCommerce.conversion'),
        value: `${data?.conversionRate ?? 0}%`,
        icon: 'trending_up',
      },
      {
        label: t('adminShop.aiCommerce.aiShare'),
        value: `${data?.revenueBySource?.aiSharePercent ?? 0}%`,
        icon: 'smart_toy',
      },
      {
        label: t('adminShop.aiCommerce.feedbackPositive'),
        value: String(data?.feedbackPositive ?? 0),
        icon: 'thumb_up',
      },
      {
        label: t('adminShop.aiCommerce.feedbackNegative'),
        value: String(data?.feedbackNegative ?? 0),
        icon: 'thumb_down',
      },
    ],
    [data, language, t],
  );

  if (loading && !data) return <AdminLoading label={t('adminShop.loading')} />;
  if (error) {
    return (
      <AdminAlert tone="error">
        {error}
        <button type="button" className="ml-2 underline" onClick={() => void reload()}>
          {t('dashboard.retry')}
        </button>
      </AdminAlert>
    );
  }

  return (
    <div className="space-y-6">
      <AdminSection title={t('adminShop.aiCommerce.title')} subtitle={t('adminShop.aiCommerce.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((s) => (
            <AdminStatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
          ))}
        </div>
      </AdminSection>

      {data?.revenueBySource?.bySource?.length ? (
        <AdminPanel title={t('adminShop.aiCommerce.revenueBySource')}>
          <RevenueBySourceChart rows={data.revenueBySource.bySource} language={language} />
        </AdminPanel>
      ) : null}

      {data?.abTest?.variants?.length ? (
        <AdminPanel title={t('adminShop.aiCommerce.abTestTitle')}>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {data.abTest.name}
            {data.abTest.winnerVariantKey
              ? ` · ${t('adminShop.aiCommerce.winner')}: ${data.abTest.winnerVariantKey}`
              : ''}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700">
                  <th className="pb-2 pr-3">{t('adminShop.aiCommerce.variant')}</th>
                  <th className="pb-2 pr-3">{t('adminShop.aiCommerce.ctr')}</th>
                  <th className="pb-2 pr-3">{t('adminShop.aiCommerce.addToCart')}</th>
                  <th className="pb-2 pr-3">{t('adminShop.aiCommerce.purchaseRate')}</th>
                  <th className="pb-2 pr-3">{t('adminShop.aiCommerce.revenue')}</th>
                  <th className="pb-2">{t('adminShop.aiCommerce.shown')}</th>
                </tr>
              </thead>
              <tbody>
                {data.abTest.variants.map((v) => (
                  <tr key={v.variantKey} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2.5 pr-3 font-medium">
                      {v.variantKey}: {v.variantName}
                      {v.isWinner ? ' ✓' : ''}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{v.ctr}%</td>
                    <td className="py-2.5 pr-3 tabular-nums">{v.addToCartRate}%</td>
                    <td className="py-2.5 pr-3 tabular-nums">{v.purchaseRate}%</td>
                    <td className="py-2.5 pr-3 tabular-nums">{formatAdminPrice(v.revenue, language)}</td>
                    <td className="py-2.5 tabular-nums">{v.shown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      ) : null}

      <AdminPanel title={t('adminShop.aiCommerce.topProducts')}>
        {!data?.topProducts?.length ? (
          <AdminEmptyState icon="inventory_2" title={t('adminShop.aiCommerce.noProducts')} />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.topProducts.map((p, idx) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <AdminRankBadge rank={idx + 1} />
                <AdminProductThumb src={p.imageUrl} name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 dark:text-white/90">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {t('adminShop.aiCommerce.eventCount', { count: String(p.eventCount) })} ·{' '}
                    {formatAdminPrice(p.price, language)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      <AdminPanel title={t('adminShop.aiCommerce.mostWishlisted')}>
        {!data?.mostWishlisted?.length ? (
          <AdminEmptyState icon="favorite" title={t('shop.wishlistEmpty')} />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.mostWishlisted.map((p, idx) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <AdminRankBadge rank={idx + 1} />
                <AdminProductThumb src={p.imageUrl} name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 dark:text-white/90">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {t('adminShop.aiCommerce.wishlistCount', { count: String(p.wishlistCount) })} ·{' '}
                    {formatAdminPrice(p.price, language)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
};
