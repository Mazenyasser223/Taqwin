import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceOptimizationService from '../../services/marketplaceOptimizationService';

interface WishlistButtonProps {
  productId: string;
  className?: string;
  compact?: boolean;
}

export function WishlistButton({ productId, className = '', compact = false }: WishlistButtonProps) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void marketplaceOptimizationService.checkWishlist(productId).then((res) => {
      if (res.data) setSaved(res.data.saved);
    });
  }, [productId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    if (saved) {
      const res = await marketplaceOptimizationService.removeFromWishlist(productId);
      if (!res.error) setSaved(false);
    } else {
      const res = await marketplaceOptimizationService.addToWishlist(productId);
      if (!res.error) setSaved(true);
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={(e) => void toggle(e)}
      disabled={loading}
      className={`inline-flex items-center gap-1 rounded-lg border border-subtle px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-elevated disabled:opacity-50 ${
        saved ? 'text-red-500 border-red-500/30' : 'text-muted'
      } ${className}`}
      aria-pressed={saved}
      aria-label={saved ? t('shop.removeFromWishlist') : t('shop.saveForLater')}
    >
      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: saved ? "'FILL' 1" : "'FILL' 0" }}>
        favorite
      </span>
      {!compact ? (saved ? t('shop.saved') : t('shop.saveForLater')) : null}
    </button>
  );
}
