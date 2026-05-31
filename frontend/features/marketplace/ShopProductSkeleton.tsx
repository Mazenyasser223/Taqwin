import React from 'react';

interface ShopProductSkeletonProps {
  count?: number;
}

export const ShopProductSkeleton: React.FC<ShopProductSkeletonProps> = ({ count = 12 }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-hidden>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse overflow-hidden rounded-2xl border border-subtle bg-elevated/60"
      >
        <div className="aspect-square bg-elevated" />
        <div className="space-y-2 p-3">
          <div className="h-3 w-4/5 rounded bg-elevated" />
          <div className="h-3 w-1/2 rounded bg-elevated" />
          <div className="mt-2 h-9 w-full rounded-xl bg-elevated" />
        </div>
      </div>
    ))}
  </div>
);
