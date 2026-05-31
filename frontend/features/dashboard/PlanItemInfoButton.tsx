import { cn } from '../../lib/cn';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  size?: 'sm' | 'md';
};

/** Inline info button matching Nutrition / Workout library styling. */
export function PlanItemInfoButton({ onClick, disabled, ariaLabel, size = 'sm' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'shrink-0 flex items-center justify-center border transition-colors',
        size === 'sm' ? 'size-7 rounded-lg' : 'size-11 rounded-xl',
        'border-gray-200 bg-white text-gray-600 hover:border-brand-500/40 hover:text-brand-600',
        'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-brand-500/40 dark:hover:text-brand-400',
        'disabled:opacity-40 disabled:pointer-events-none'
      )}
    >
      <span className={cn('material-symbols-outlined', size === 'sm' ? 'text-[16px]' : 'text-[22px]')}>
        info
      </span>
    </button>
  );
}
