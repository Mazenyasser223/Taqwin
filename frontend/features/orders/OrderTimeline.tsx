import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { OrderTimelineStep } from './orderStatusTimeline';
import type { TranslationKey } from '../../lib/i18n/translations';

type Props = {
  steps: OrderTimelineStep[];
  variant?: 'customer' | 'admin';
};

export const OrderTimeline: React.FC<Props> = ({ steps, variant = 'customer' }) => {
  const { t, language } = useI18n();
  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const activeClass =
    variant === 'admin'
      ? 'bg-brand-500/15 text-brand-500'
      : 'bg-primary/15 text-primary border border-primary/20';
  const pendingClass =
    variant === 'admin'
      ? 'bg-gray-100 text-gray-400 dark:bg-white/[0.06]'
      : 'bg-elevated text-faint border border-subtle';

  return (
    <ul className="space-y-3">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
              step.done ? activeClass : pendingClass
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-semibold ${
                step.done
                  ? variant === 'admin'
                    ? 'text-gray-900 dark:text-white'
                    : 'text-foreground'
                  : variant === 'admin'
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-faint'
              }`}
            >
              {t(step.labelKey as TranslationKey)}
            </p>
            {step.done && step.at ? (
              <p className={variant === 'admin' ? 'text-theme-xs text-gray-500' : 'text-xs text-muted'}>
                {fmt(step.at)}
              </p>
            ) : !step.done ? (
              <p className={variant === 'admin' ? 'text-theme-xs text-gray-400' : 'text-xs text-faint'}>
                {t('orders.timeline.pending')}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};
