import React from 'react';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { useI18n } from '../../../lib/i18n/useI18n';
import type { OnboardingAnswers } from '../types';

interface InbodyReviewSummaryProps {
  answers: OnboardingAnswers;
  avatarUrl?: string | null;
  email?: string | null;
  compact?: boolean;
}

function statValue(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  return String(raw).trim() || null;
}

/** Profile row for InBody review — uses onboarding profile, not scan patient name. */
export const InbodyReviewSummary: React.FC<InbodyReviewSummaryProps> = ({
  answers,
  avatarUrl,
  email,
  compact = false,
}) => {
  const { t } = useI18n();

  const displayName =
    statValue(answers.displayName) ||
    statValue(answers.name) ||
    null;

  const stats = [
    { label: t('onboarding.inbody.summary.phone'), value: statValue(answers.phone) },
    {
      label: t('onboarding.inbody.summary.height'),
      value: statValue(answers.height) ? `${answers.height}cm` : null,
    },
    { label: t('onboarding.inbody.summary.age'), value: statValue(answers.age) },
    { label: t('onboarding.inbody.summary.gender'), value: statValue(answers.gender) },
  ].filter((s) => s.value);

  return (
    <div
      className={`rounded-xl border border-subtle bg-surface/95 shadow-sm ${
        compact ? 'p-2.5 space-y-2' : 'p-3 sm:p-3.5 space-y-2.5'
      }`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
        <UserAvatar
          avatarUrl={avatarUrl}
          displayName={displayName}
          email={email}
          className={`shrink-0 rounded-full border border-subtle ${
            compact ? 'size-9 text-[10px]' : 'size-10 sm:size-11 text-xs'
          }`}
          imgClassName={`shrink-0 rounded-full object-cover border border-subtle ${
            compact ? 'size-9' : 'size-10 sm:size-11'
          }`}
          alt={displayName ?? ''}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`font-bold text-foreground truncate ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>
            {displayName ?? t('onboarding.inbody.summary.you')}
          </p>
          <p className="text-[10px] sm:text-xs text-muted mt-0.5">{t('notifications.justNow')}</p>
        </div>
      </div>

      {stats.length > 0 && (
        <div
          className={`grid gap-x-2 gap-y-1 border-t border-subtle/70 pt-2 ${
            compact ? 'grid-cols-2 text-[10px]' : 'grid-cols-2 sm:grid-cols-4 text-[10px] sm:text-xs'
          }`}
        >
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <span className="text-faint font-semibold uppercase tracking-wide">{s.label}</span>
              <p className="font-bold text-foreground truncate tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
