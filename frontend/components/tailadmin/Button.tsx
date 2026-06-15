import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  to?: string;
  children: React.ReactNode;
}

const variantMap: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10',
  outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/5',
  ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5',
  danger: 'border border-error-500/30 text-error-500 hover:bg-error-500/10',
};

const sizeMap: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-theme-xs',
  md: 'px-4 py-2.5 text-theme-sm',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  to,
  children,
  className,
  ...props
}) => {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50',
    variantMap[variant],
    sizeMap[size],
    className
  );

  const content = (
    <>
      {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  );
};
