import React from 'react';
import { cn } from '../../lib/cn';

type BadgeColor = 'primary' | 'success' | 'error' | 'warning' | 'light';

interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
}

const colorMap: Record<BadgeColor, string> = {
  primary: 'bg-brand-500/15 text-brand-400',
  success: 'bg-success-500/15 text-success-500',
  error: 'bg-error-500/15 text-error-500',
  warning: 'bg-warning-500/15 text-warning-500',
  light: 'bg-elevated text-gray-400',
};

export const Badge: React.FC<BadgeProps> = ({ color = 'primary', children, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium',
      colorMap[color],
      className
    )}
  >
    {children}
  </span>
);
