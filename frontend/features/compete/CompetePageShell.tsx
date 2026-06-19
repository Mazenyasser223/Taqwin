import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

type CompetePageShellProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function CompetePageShell({
  title,
  subtitle,
  backTo = '/dashboard',
  action,
  children,
  className,
}: CompetePageShellProps) {
  return (
    <div className={cn('page-shell mx-auto w-full max-w-3xl flex-1 pb-8', className)}>
      <div className="mb-6 flex items-start gap-3">
        <Link
          to={backTo}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-white/80 text-brand-600 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-brand-400"
          aria-label="Back"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
