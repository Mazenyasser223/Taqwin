import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { useCartStore } from '../../store/useCartStore';
import { refreshCartItems, type CartPriceChange } from './cartPriceUtils';

export function useCartSync() {
  const { t, language } = useI18n();
  const items = useCartStore((s) => s.items);
  const replaceItems = useCartStore((s) => s.replaceItems);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[]>([]);

  useEffect(() => {
    if (items.length === 0) return;

    let cancelled = false;

    (async () => {
      setSyncing(true);
      const result = await refreshCartItems(items);

      if (cancelled) return;

      const changed =
        result.removedCount > 0 ||
        result.priceChanges.length > 0 ||
        result.items.length !== items.length;

      if (changed) {
        replaceItems(result.items);
        setPriceChanges(result.priceChanges);

        if (result.removedCount > 0) {
          setNotice(t('marketplace.cartItemsRemoved', { count: String(result.removedCount) }));
        } else if (result.priceChanges.length > 0) {
          setNotice(t('marketplace.priceChanged'));
        } else {
          setNotice(t('marketplace.cartSynced'));
        }
      } else {
        setPriceChanges([]);
      }

      setSyncing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- sync once when cart page opens

  const priceChangeSummary =
    priceChanges.length > 0
      ? priceChanges
          .map((change) => {
            const name = change.name.length > 40 ? `${change.name.slice(0, 40)}…` : change.name;
            return language === 'ar'
              ? `${name}: ${change.oldPrice} ← ${change.newPrice} ج.م`
              : `${name}: EGP ${change.oldPrice} → ${change.newPrice}`;
          })
          .join(language === 'ar' ? ' · ' : ' · ')
      : null;

  return { syncing, notice, priceChanges, priceChangeSummary };
}
