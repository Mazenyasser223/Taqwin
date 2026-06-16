import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { COMPETE_KPI_THEMES, type CompeteKpiThemeKey } from './competeDashboardStyles';

type CompeteDashboardCardProps = {
  href?: string;
  icon: string;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  theme?: CompeteKpiThemeKey;
  className?: string;
};

export function CompeteDashboardCard({
  href,
  icon,
  title,
  meta,
  children,
  action,
  theme = 'league',
  className,
}: CompeteDashboardCardProps) {
  const style = COMPETE_KPI_THEMES[theme];

  const body = (
    <div
      className={cn(
        'group relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-2xl border p-5 md:p-6',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        style.border,
        'transition-shadow duration-300 hover:shadow-2xl',
        className,
      )}
      style={
        {
          boxShadow: `0 8px 32px -8px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
          '--compete-accent': style.accent,
          '--compete-glow': style.glow,
        } as React.CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: style.accent }}
      />
      <div className={cn('pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-90', style.wash)} />

      <div className="relative z-[1] flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ring-1 ring-white/20 dark:ring-white/10',
              style.iconFrom,
              style.iconTo,
            )}
            style={{ boxShadow: `0 10px 24px -8px ${style.glow}` }}
          >
            <span className="material-symbols-outlined text-[22px]" style={{ color: style.accent }}>
              {icon}
            </span>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
          {title}
        </p>
        {meta ? <div className="mt-1">{meta}</div> : null}

        <div className="mt-3 flex flex-1 flex-col justify-end">{children}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500/50"
      >
        {body}
      </Link>
    );
  }

  return body;
}

export function CompeteMetricRow({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-xl border px-2.5 py-2 sm:px-3',
            'border-gray-200/90 bg-white/50 dark:border-white/12 dark:bg-white/[0.05]',
          )}
        >
          <p
            className="text-xl font-extrabold tabular-nums leading-none tracking-tight text-gray-900 dark:text-white sm:text-2xl"
            style={{ textShadow: '0 0 24px var(--compete-glow)' }}
          >
            {item.value}
          </p>
          <p className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function CompeteProgressBar({
  pct,
  label,
}: {
  pct: number;
  label: string;
}) {
  const visual = Math.min(100, Math.max(0, pct));
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums font-semibold">{visual}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(visual, visual > 0 ? 4 : 0)}%`,
            background: 'var(--compete-accent)',
            boxShadow: '0 0 12px var(--compete-glow)',
          }}
        />
      </div>
    </div>
  );
}

export function CompeteCardSkeleton({ theme = 'league' }: { theme?: CompeteKpiThemeKey }) {
  const style = COMPETE_KPI_THEMES[theme];
  return (
    <div
      className={cn(
        'relative min-h-[168px] animate-pulse overflow-hidden rounded-2xl border p-5 md:p-6',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        style.border,
      )}
      style={{ boxShadow: `0 8px 32px -8px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.12)` }}
    >
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gray-200/80 dark:bg-white/[0.08]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-24 rounded bg-gray-200/80 dark:bg-white/[0.08]" />
          <div className="h-8 w-full rounded-xl bg-gray-200/80 dark:bg-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}

export function CompeteTextButton({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs',
        variant === 'primary'
          ? 'bg-brand-500 text-white shadow-sm hover:bg-brand-600'
          : 'border border-gray-200/90 bg-white/70 text-gray-700 hover:bg-white dark:border-white/12 dark:bg-white/[0.06] dark:text-gray-200',
      )}
    >
      {children}
    </Link>
  );
}
