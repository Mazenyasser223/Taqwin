import React from 'react';
import { cn } from '../../lib/cn';
import { PREMIUM_CARD_STYLES, type PremiumCardVariant } from '../../lib/premiumCardStyles';

export interface PremiumCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: string;
  variant?: PremiumCardVariant;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

/** Glass KPI-style card (dashboard + shop). */
export const PremiumCard: React.FC<PremiumCardProps> = ({
  label,
  value,
  sub,
  icon,
  variant = 'teal',
  className,
  children,
  onClick,
}) => {
  const style = PREMIUM_CARD_STYLES[variant];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'kpi-card-premium group rounded-2xl border p-5 md:p-6 text-start',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        style.border,
        'transition-all duration-300 ease-out hover:shadow-2xl',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        className
      )}
      style={{
        boxShadow: `0 8px 32px -8px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: style.accent }}
      />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', style.wash)} />

      <div className="relative z-[1] flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
              style.iconFrom,
              style.iconTo,
              'ring-1 ring-white/20 dark:ring-white/10'
            )}
            style={{ boxShadow: `0 10px 24px -8px ${style.glow}` }}
          >
            <span className="material-symbols-outlined text-[22px]" style={{ color: style.accent }}>
              {icon}
            </span>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
            {label}
          </p>
          <div
            className="mt-1.5 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-[1.35rem] leading-tight line-clamp-2"
            style={{ textShadow: `0 0 40px ${style.glow}` }}
          >
            {value}
          </div>
          {sub ? (
            <div className="mt-1 text-theme-xs leading-snug text-gray-500 dark:text-gray-400">{sub}</div>
          ) : null}
        </div>

        {children}
      </div>
    </Tag>
  );
};
