import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PremiumCardShell } from '../../lib/premiumCardShell';
import { shopProductCardVariant } from '../../lib/premiumCardStyles';
import { buttonPress } from '../../lib/motion';
import { productComparePrice, productDisplayPrice } from '../../lib/shopFormat';
import { useI18n } from '../../lib/i18n/useI18n';
import { ProductRating } from '../commerce/ProductRating';
import type { Product } from '../../types';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=400';

interface ShopProductCardProps {
  product: Product;
  /** Navigate to full product page (SEO-friendly). */
  productTo?: string;
  onOpen?: () => void;
  onAdd: () => void;
  inStockLabel: string;
  outOfStockLabel: string;
  addLabel: string;
  saleBadgeLabel?: string;
  /** Horizontal row layout (narrower, image-first). */
  compact?: boolean;
}

/** MFB-style product tile with Taqwin premium glass styling. */
export const ShopProductCard: React.FC<ShopProductCardProps> = ({
  product,
  productTo,
  onOpen,
  onAdd,
  inStockLabel,
  outOfStockLabel,
  addLabel,
  saleBadgeLabel,
  compact = false,
}) => {
  const { language } = useI18n();
  const variant = shopProductCardVariant(product);
  const priceText = productDisplayPrice(product, language);
  const compareText = productComparePrice(product, language);
  const showSale = product.isOnSale || Boolean(compareText);
  const discount =
    product.discountPercent ??
    (product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null);
  const title = language === 'ar' && product.nameAr ? product.nameAr : product.name;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd();
  };

  const imageBlock = (
    <div
      className={`relative overflow-hidden bg-black/10 ${
        compact ? 'aspect-square rounded-t-2xl' : 'aspect-[4/3] rounded-t-2xl'
      }`}
    >
      {showSale && discount ? (
        <span className="absolute top-2 start-2 z-10 rounded-lg bg-[#f37021] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
          {saleBadgeLabel ?? `-${discount}%`}
        </span>
      ) : null}
      <img
        src={product.imageUrl || FALLBACK_IMG}
        alt=""
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  );

  const infoBlock = (
    <div className={`flex flex-1 flex-col gap-2 ${compact ? 'p-3 pb-0' : 'p-4 pb-0'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted line-clamp-1">
        {product.brand}
      </p>
      <h3
        className={`font-bold leading-snug text-foreground line-clamp-2 ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        {title}
      </h3>

      <ProductRating avgRating={product.avgRating} reviewCount={product.reviewCount} />

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`font-black text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
          {priceText}
        </span>
        {compareText ? (
          <span className="text-xs text-muted line-through decoration-red-400/80">
            {compareText}
          </span>
        ) : null}
      </div>

      {!compact && product.description ? (
        <p className="text-xs text-muted line-clamp-2">
          {language === 'ar' && product.descriptionAr ? product.descriptionAr : product.description}
        </p>
      ) : null}

      <p className="text-[10px] text-muted">
        {product.stock > 0 ? inStockLabel : outOfStockLabel}
      </p>
    </div>
  );

  const addButton = (
    <div className={compact ? 'p-3 pt-2' : 'p-4 pt-2'}>
      <motion.button
        type="button"
        variants={buttonPress}
        whileHover="hover"
        whileTap="tap"
        disabled={product.stock <= 0}
        onClick={handleAdd}
        className={`relative z-10 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary font-black text-white shadow-lg shadow-primary/25 disabled:opacity-40 ${
          compact ? 'min-h-9 text-xs' : 'min-h-10 text-sm'
        }`}
      >
        <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
        {addLabel}
      </motion.button>
    </div>
  );

  const clickableBody =
    productTo ? (
      <Link to={productTo} className="block min-w-0 flex-1 text-inherit no-underline">
        {imageBlock}
        {infoBlock}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onOpen}
        className="block min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-start text-inherit"
      >
        {imageBlock}
        {infoBlock}
      </button>
    );

  return (
    <PremiumCardShell variant={variant} className="flex h-full flex-col p-0">
      {clickableBody}
      {addButton}
    </PremiumCardShell>
  );
};
