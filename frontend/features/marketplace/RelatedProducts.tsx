import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import marketplaceService from '../../services/marketplaceService';
import { useI18n } from '../../lib/i18n/useI18n';
import type { Product } from '../../types';
import { ShopProductSection } from './ShopProductSection';
import { productPagePath } from './productPagePath';

interface RelatedProductsProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export const RelatedProducts: React.FC<RelatedProductsProps> = ({ product, onAdd }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const collected: Product[] = [];
      const seen = new Set<string>([product.id]);

      const pushUnique = (list: Product[]) => {
        for (const p of list) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          collected.push(p);
          if (collected.length >= 8) break;
        }
      };

      if (product.categoryId) {
        const byCategory = await marketplaceService.getProducts({
          categoryId: product.categoryId,
          excludeId: product.id,
          limit: 8,
        });
        if (!cancelled && byCategory.data?.items) pushUnique(byCategory.data.items);
      }

      if (collected.length < 4 && product.brand) {
        const byBrand = await marketplaceService.getProducts({
          brand: product.brand,
          excludeId: product.id,
          limit: 8,
        });
        if (!cancelled && byBrand.data?.items) pushUnique(byBrand.data.items);
      }

      if (!cancelled) setItems(collected.slice(0, 8));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [product.id, product.categoryId, product.brand]);

  if (!items.length) return null;

  return (
    <ShopProductSection
      title={t('shop.relatedProducts')}
      products={items}
      onAdd={onAdd}
      onOpen={(p) => {
        const path = productPagePath(p);
        if (path) navigate(path);
      }}
      inStockLabel={t('marketplace.inStock')}
      outOfStockLabel={t('shop.outOfStock')}
      addLabel={t('shop.addToCart')}
      saleBadgeLabel={(percent) => t('shop.saleBadge', { percent: String(percent) })}
    />
  );
};
