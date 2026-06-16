import React from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useAdminShopQuery } from '../../../lib/adminShopCache';
import adminShopService, { type DataQualityReport } from '../../../services/adminShopService';
import {
  AdminAlert,
  AdminLoading,
  AdminPanel,
  AdminSection,
  AdminStatCard,
} from './adminShopUi';

function IssueList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; name: string; brand?: string }>;
}) {
  if (!items.length) return null;
  return (
    <AdminPanel title={title}>
      <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
        {items.map((p) => (
          <li key={p.id} className="py-2">
            <span className="font-medium">{p.name}</span>
            {p.brand ? <span className="text-gray-500"> · {p.brand}</span> : null}
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

export const AdminDataQualityPage: React.FC = () => {
  const { t } = useI18n();
  const { data, loading, error, reload } = useAdminShopQuery<DataQualityReport>(
    'data-quality',
    () => adminShopService.getDataQuality(),
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
      <AdminSection title={t('adminShop.dataQuality.title')} subtitle={t('adminShop.dataQuality.subtitle')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label={t('adminShop.dataQuality.score')}
            value={`${data?.qualityScore ?? 0}/100`}
            icon="verified"
          />
          <AdminStatCard
            label={t('adminShop.dataQuality.featuredIssues')}
            value={String(data?.summary.featuredIssues ?? 0)}
            icon="star"
          />
          <AdminStatCard
            label={t('adminShop.dataQuality.missingImages')}
            value={String(data?.summary.missingImages ?? 0)}
            icon="image"
          />
          <AdminStatCard
            label={t('adminShop.dataQuality.missingNutrition')}
            value={String(data?.summary.supplementsMissingNutrition ?? 0)}
            icon="nutrition"
          />
        </div>
      </AdminSection>

      {data?.weeklyChecklist?.length ? (
        <AdminPanel title={t('adminShop.dataQuality.weeklyChecklist')}>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {data.weeklyChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </AdminPanel>
      ) : null}

      <IssueList title={t('adminShop.dataQuality.featuredIssuesList')} items={data?.featuredIssues ?? []} />
      <IssueList title={t('adminShop.dataQuality.noImageList')} items={data?.missingImages ?? []} />
      <IssueList title={t('adminShop.dataQuality.noNutritionList')} items={data?.supplementsMissingNutrition ?? []} />
    </div>
  );
};
