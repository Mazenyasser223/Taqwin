import { useEffect, useState } from 'react';
import marketplaceService from '../../services/marketplaceService';
import {
  SHOP_FLAT_SHIPPING_FEE_EGP,
  SHOP_FREE_SHIPPING_MIN_EGP,
  type ShippingRules,
} from '../../lib/shopShipping';

const DEFAULT_RULES: ShippingRules = {
  freeShippingMin: SHOP_FREE_SHIPPING_MIN_EGP,
  flatFee: SHOP_FLAT_SHIPPING_FEE_EGP,
  currency: 'EGP',
};

export function useShippingRules() {
  const [rules, setRules] = useState<ShippingRules>(DEFAULT_RULES);

  useEffect(() => {
    let cancelled = false;
    void marketplaceService.getShippingRules().then((res) => {
      if (cancelled || res.error || !res.data) return;
      setRules(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return rules;
}
