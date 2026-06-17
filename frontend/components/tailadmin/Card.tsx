import React from 'react';
import { cn } from '../../lib/cn';
import { CARD } from './constants';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  title?: string;
  subtitle?: string;
  icon?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
  headerBorder?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  id,
  title,
  subtitle,
  icon,
  actions,
  noPadding,
  headerBorder = true,
}) => (
  <div id={id} className={cn(CARD, !noPadding && 'p-5 sm:p-6', className)}>
    {(title || actions) && (
      <div
        className={cn(
          'mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
          headerBorder && 'border-b border-gray-100 pb-5 dark:border-gray-800'
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <span className="material-symbols-outlined text-xl">{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            {title && <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);
