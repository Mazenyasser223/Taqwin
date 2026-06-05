import React from 'react';
import { cn } from './cn';
import { PREMIUM_CARD_STYLES, type PremiumCardVariant } from './premiumCardStyles';

interface PremiumCardShellProps {
  variant?: PremiumCardVariant;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

/** Premium glass surface without KPI header — for shop product/category tiles. */
export const PremiumCardShell: React.FC<PremiumCardShellProps> = ({
  variant = 'teal',
  className,
  children,
  onClick,
  selected,
}) => {
  const style = PREMIUM_CARD_STYLES[variant];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'kpi-card-premium group relative overflow-hidden rounded-2xl border text-start',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        style.border,
        'transition-all duration-300 ease-out hover:shadow-2xl',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        selected && 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background',
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
      <div className="relative z-[1]">{children}</div>
    </Tag>
  );
};
