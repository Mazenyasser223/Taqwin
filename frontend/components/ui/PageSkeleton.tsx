import React from 'react';
import { cn } from '../../lib/cn';

export type PageSkeletonVariant = 'default' | 'grid' | 'list' | 'settings' | 'dashboard';

type Props = {
  variant?: PageSkeletonVariant;
  className?: string;
};

function Bone({ className }: { className?: string }) {
  return <div className={cn('skeleton-bone rounded-xl', className)} aria-hidden />;
}

export const PageSkeleton: React.FC<Props> = ({ variant = 'default', className }) => {
  if (variant === 'grid') {
    return (
      <div className={cn('page-shell space-y-6 animate-pulse', className)} aria-busy aria-label="Loading">
        <Bone className="h-8 w-2/3 max-w-md mx-auto" />
        <Bone className="h-12 w-full max-w-3xl mx-auto rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bone key={i} className="aspect-[4/5] min-h-[140px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('page-shell space-y-4', className)} aria-busy aria-label="Loading">
        <Bone className="h-10 w-full max-w-lg rounded-2xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (variant === 'settings') {
    return (
      <div className={cn('mx-auto max-w-2xl space-y-6', className)} aria-busy aria-label="Loading">
        <div className="flex gap-3">
          <Bone className="size-12 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Bone className="h-6 w-40" />
            <Bone className="h-4 w-56" />
          </div>
        </div>
        <Bone className="h-64 w-full rounded-2xl" />
        <Bone className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('page-shell space-y-6', className)} aria-busy aria-label="Loading">
        <Bone className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Bone className="h-48 w-full rounded-2xl" />
        <Bone className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className={cn('page-shell space-y-6', className)} aria-busy aria-label="Loading">
      <Bone className="h-10 w-48" />
      <Bone className="h-32 w-full rounded-2xl" />
      <Bone className="h-48 w-full rounded-2xl" />
    </div>
  );
};
