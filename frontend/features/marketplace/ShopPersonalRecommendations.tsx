import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { CommerceRecommendationCard } from '../commerce/CommerceRecommendationCard';
import { DietPlanCommerceCard } from '../commerce/DietPlanCommerceCard';
import { ReorderBanner } from '../commerce/ReorderBanner';
import { useCommerceRecommendations, useDietPlanCommerce } from '../commerce/useCommerceRecommendations';

/** Personalized AI bundle + diet-plan products — logged-in athletes only. */
export function ShopPersonalRecommendations() {
  const { t } = useI18n();
  const authHydrated = useAuthStore((s) => s.authHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const enabled = authHydrated && isAuthenticated;

  const { bundle, loading, error, reload } = useCommerceRecommendations(enabled, 'marketplace');
  const { dietProducts, loading: dietLoading } = useDietPlanCommerce(enabled);

  if (!enabled) return null;

  const hasContent =
    loading ||
    dietLoading ||
    Boolean(error) ||
    (bundle?.products?.length ?? 0) > 0 ||
    (dietProducts?.products?.length ?? 0) > 0;

  if (!hasContent) return null;

  return (
    <section className="min-w-0" aria-label={t('shop.personalRecommendations')}>
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-brand-600 dark:text-brand-400">auto_awesome</span>
        <h2 className="text-lg font-black text-foreground">{t('shop.personalRecommendations')}</h2>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <p>{t('shop.recommendationsError')}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-2 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('shop.recommendationsRetry')}
          </button>
        </div>
      ) : null}

      <div className="space-y-4">
        <ReorderBanner />
        <CommerceRecommendationCard
          bundle={bundle}
          loading={loading}
          source="marketplace"
          surface="shop"
          className="mt-0"
        />
        <DietPlanCommerceCard dietProducts={dietProducts} loading={dietLoading} />
      </div>
    </section>
  );
}
