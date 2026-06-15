import React from 'react';
import { cn } from '../../lib/cn';
import { CARD_HERO } from './constants';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'hero';
  meta?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  className,
  variant = 'default',
  meta,
}) => {
  const shell =
    variant === 'hero'
      ? cn(CARD_HERO, 'relative overflow-hidden p-6 sm:p-8', className)
      : cn('flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between', className);

  return (
    <div className={shell}>
      {variant === 'hero' && (
        <>
          <div className="pointer-events-none absolute -end-8 -top-8 size-40 rounded-full bg-brand-500/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 start-1/3 size-32 rounded-full bg-accent/10 blur-2xl" />
        </>
      )}
      <div className={cn('relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between', variant === 'default' && className)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {badge && (
              <span className="rounded-full bg-brand-500/15 px-3 py-1 text-theme-xs font-semibold uppercase tracking-wide text-brand-500">
                {badge}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">{title}</h1>
          </div>
          {subtitle && <p className="mt-2 max-w-2xl text-theme-sm text-gray-600 dark:text-gray-300">{subtitle}</p>}
          {meta && <div className="mt-4">{meta}</div>}
        </div>
        {actions && <div className="relative flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
};
