import React from 'react';
import { cn } from '../../lib/cn';

interface FilterPillsProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function FilterPills<T extends string>({ value, options, onChange, className }: FilterPillsProps<T>) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-3 py-1.5 text-theme-xs font-semibold transition-colors',
            value === opt.value
              ? 'bg-brand-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
