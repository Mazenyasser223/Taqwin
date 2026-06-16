import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { withTransientRetry } from '../../lib/apiTransientError';
import aiCommerceService, { type CommerceBundle, type DietPlanCommerce } from '../../services/aiCommerceService';

export function useCommerceRecommendations(enabled: boolean, source?: string) {
  const { language } = useI18n();
  const [bundle, setBundle] = useState<CommerceBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const locale = language === 'en' ? 'en' : 'ar';
      const res = await withTransientRetry(
        () => aiCommerceService.getRecommendations(locale, source),
        { attempts: 3, baseDelayMs: 2000 },
      );
      if (res.error) {
        setError(res.error);
        setBundle(null);
      } else {
        setBundle(res.data?.bundle ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, language, source]);

  useEffect(() => {
    void load();
  }, [load]);

  return { bundle, loading, error, reload: load };
}

export function useDietPlanCommerce(enabled: boolean, dayIndex?: number) {
  const { language } = useI18n();
  const [dietProducts, setDietProducts] = useState<DietPlanCommerce | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    void aiCommerceService
      .getDietProducts(language === 'en' ? 'en' : 'ar', dayIndex)
      .then((res) => {
        if (!cancelled) setDietProducts(res.data?.dietProducts ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, language, dayIndex]);

  return { dietProducts, loading };
}
