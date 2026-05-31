import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants, staggerContainer } from '../../lib/motion';
import type { Product } from '../../types';
import { ShopProductCard } from './ShopProductCard';

interface ShopProductSectionProps {
  title: string;
  products: Product[];
  viewAllLabel?: string;
  onViewAll?: () => void;
  onAdd: (product: Product) => void;
  onOpen?: (product: Product) => void;
  inStockLabel: string;
  outOfStockLabel: string;
  addLabel: string;
  saleBadgeLabel?: (percent: number) => string;
}

/** MFB-style horizontal product row with section heading. */
export const ShopProductSection: React.FC<ShopProductSectionProps> = ({
  title,
  products,
  viewAllLabel,
  onViewAll,
  onAdd,
  onOpen,
  inStockLabel,
  outOfStockLabel,
  addLabel,
  saleBadgeLabel,
}) => {
  if (products.length === 0) return null;

  return (
    <section className="space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-lg font-black tracking-tight text-foreground sm:text-xl">{title}</h2>
        {onViewAll && viewAllLabel ? (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-xs font-bold text-primary hover:underline sm:text-sm"
          >
            {viewAllLabel}
          </button>
        ) : null}
      </div>
      <motion.div
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="visible"
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory no-scrollbar"
      >
        {products.map((product) => (
          <motion.div
            key={product.id}
            variants={itemVariants}
            className="w-[168px] shrink-0 snap-start sm:w-[188px]"
          >
            <ShopProductCard
              product={product}
              onOpen={onOpen ? () => onOpen(product) : undefined}
              onAdd={() => onAdd(product)}
              inStockLabel={inStockLabel}
              outOfStockLabel={outOfStockLabel}
              addLabel={addLabel}
              saleBadgeLabel={
                product.discountPercent && saleBadgeLabel
                  ? saleBadgeLabel(product.discountPercent)
                  : undefined
              }
              compact
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
