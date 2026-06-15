import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';

interface ProductRatingProps {
  avgRating?: number | null;
  reviewCount?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}

function StarIcon({ filled, half }: { filled: boolean; half?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined ${
        filled ? 'text-amber-400' : half ? 'text-amber-400/50' : 'text-gray-300 dark:text-gray-600'
      }`}
      style={{ fontVariationSettings: filled || half ? "'FILL' 1" : "'FILL' 0", fontSize: 'inherit' }}
    >
      star
    </span>
  );
}

export function ProductRating({
  avgRating,
  reviewCount,
  size = 'sm',
  className = '',
}: ProductRatingProps) {
  const { t } = useI18n();
  const rating = Number(avgRating) || 0;
  const count = Number(reviewCount) || 0;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'text-[14px]' : 'text-base';

  if (rating <= 0 && count <= 0) return null;

  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${textSize} ${className}`}>
      <span className={`inline-flex items-center gap-0.5 ${iconSize}`} aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <StarIcon key={i} filled={i < fullStars} half={i === fullStars && hasHalf} />
        ))}
      </span>
      <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
        {rating > 0 ? rating.toFixed(1) : '—'}
      </span>
      {count > 0 ? (
        <span className="text-gray-500 dark:text-gray-400">
          ({t('shop.reviewCount', { count: String(count) })})
        </span>
      ) : null}
    </div>
  );
}
