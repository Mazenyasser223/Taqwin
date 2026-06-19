import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';

export type PlanViewMode = 'ai' | 'logs';

export function PlanViewModeToggle({
  value,
  onChange,
  className,
}: {
  value: PlanViewMode;
  onChange: (mode: PlanViewMode) => void;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        'inline-flex rounded-xl border border-gray-200 bg-gray-100/90 p-0.5 dark:border-gray-700 dark:bg-gray-800/80',
        className
      )}
      role="tablist"
      aria-label={t('dashboard.planViewToggleLabel')}
    >
      {(
        [
          { id: 'ai' as const, icon: 'auto_awesome', label: t('dashboard.planViewAi') },
          { id: 'logs' as const, icon: 'history', label: t('dashboard.planViewLogs') },
        ] as const
      ).map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all',
              active
                ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
