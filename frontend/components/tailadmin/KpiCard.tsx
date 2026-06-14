import React from 'react';
import { cn } from '../../lib/cn';
import { CARD } from './constants';

type Accent = 'brand' | 'success' | 'info' | 'warning' | 'accent';

const accentMap: Record<Accent, { bar: string; icon: string; value: string }> = {
  brand: { bar: 'bg-brand-500', icon: 'bg-brand-500/10 text-brand-500', value: 'text-gray-900 dark:text-white' },
  success: { bar: 'bg-success-500', icon: 'bg-success-500/10 text-success-500', value: 'text-gray-900 dark:text-white' },
  info: { bar: 'bg-blue-500', icon: 'bg-blue-500/10 text-blue-500', value: 'text-gray-900 dark:text-white' },
  warning: { bar: 'bg-warning-500', icon: 'bg-warning-500/10 text-warning-500', value: 'text-gray-900 dark:text-white' },
  accent: { bar: 'bg-accent', icon: 'bg-accent/10 text-accent', value: 'text-gray-900 dark:text-white' },
};

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: Accent;
  hint?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon, accent = 'brand', hint, className }) => {
  const colors = accentMap[accent];
  return (
    <div
      className={cn(
        CARD,
        'group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:hover:border-gray-700',
        className
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1', colors.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105', colors.icon)}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className={cn('mt-1 text-2xl font-bold tracking-tight sm:text-[1.75rem]', colors.value)}>{value}</p>
        {hint && <p className="mt-1 text-theme-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  );
};
