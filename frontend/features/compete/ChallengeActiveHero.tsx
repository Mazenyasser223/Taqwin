import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { ChallengeDetail } from '../../services/gamificationService';
import { CompeteProgressBar } from './CompeteDashboardCardShell';
import {
  CHALLENGE_STATUS_KEYS,
  CHALLENGE_STATUS_STYLES,
  CHALLENGE_THEME,
  challengeKey,
} from './challengeUiShared';

function DailyStreak({ daily }: { daily: ChallengeDetail['daily'] }) {
  const { t } = useI18n();

  return (
    <div className="mt-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {t('compete.dailyChecklist')}
      </p>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {daily.map((day) => (
          <div
            key={day.dateKey}
            title={day.dateKey}
            className={cn(
              'relative flex aspect-square max-h-10 flex-col items-center justify-center rounded-lg text-[10px] font-bold tabular-nums transition',
              day.pending &&
                'border border-dashed border-gray-300/60 bg-gray-100/50 text-gray-400 dark:border-white/10 dark:bg-white/[0.03]',
              !day.pending &&
                day.met &&
                'border border-[#f37021]/40 bg-[#f37021]/20 text-[#f37021] shadow-[0_0_12px_rgba(243,112,33,0.25)]',
              !day.pending &&
                !day.met &&
                'border border-gray-200/80 bg-gray-100/80 text-gray-500 dark:border-white/10 dark:bg-white/[0.04]',
            )}
          >
            {day.dateKey.slice(8)}
            {!day.pending && day.met ? (
              <span className="material-symbols-outlined absolute -right-0.5 -top-0.5 text-[12px] text-[#f37021]">
                check_circle
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChallengeActiveHero({
  detail,
  onLeave,
}: {
  detail: ChallengeDetail;
  onLeave?: () => void;
}) {
  const { t } = useI18n();
  const theme = CHALLENGE_THEME;
  const { participation: p } = detail;
  const statusStyle = CHALLENGE_STATUS_STYLES[p.status] ?? CHALLENGE_STATUS_STYLES.active;

  return (
    <div
      className={cn(
        'relative mb-6 overflow-hidden rounded-2xl border p-5 md:p-6',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        theme.border,
      )}
      style={{
        boxShadow: `0 8px 32px -8px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
        ['--compete-accent' as string]: theme.accent,
        ['--compete-glow' as string]: theme.glow,
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-35 blur-2xl"
        style={{ background: theme.accent }}
      />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', theme.wash)} />

      <div className="relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-white/20 dark:ring-white/10',
                theme.iconFrom,
                theme.iconTo,
              )}
              style={{ boxShadow: `0 10px 24px -8px ${theme.glow}` }}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ color: theme.accent }}>
                {p.icon}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
                {t(challengeKey(p.slug, 'title'))}
              </h2>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                {t(challengeKey(p.slug, 'desc'))}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1',
              statusStyle.shell,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
            {t(CHALLENGE_STATUS_KEYS[p.status] ?? CHALLENGE_STATUS_KEYS.active)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-gray-200/90 bg-white/50 px-2.5 py-2 dark:border-white/12 dark:bg-white/[0.05]">
            <p
              className="text-2xl font-extrabold tabular-nums leading-none sm:text-3xl"
              style={{ color: theme.accent, textShadow: `0 0 20px ${theme.glow}` }}
            >
              {p.progress}
              <span className="text-lg font-semibold text-gray-400">/{p.target}</span>
            </p>
            <p className="mt-1 text-[10px] font-medium text-gray-500">{t('compete.progressLabel')}</p>
          </div>
          <div className="rounded-xl border border-gray-200/90 bg-white/50 px-2.5 py-2 dark:border-white/12 dark:bg-white/[0.05]">
            <p className="text-2xl font-extrabold tabular-nums leading-none text-gray-900 dark:text-white sm:text-3xl">
              {p.status === 'active' ? p.daysLeft : '—'}
            </p>
            <p className="mt-1 text-[10px] font-medium text-gray-500">{t('compete.daysLeft')}</p>
          </div>
          <div className="rounded-xl border border-gray-200/90 bg-white/50 px-2.5 py-2 dark:border-white/12 dark:bg-white/[0.05]">
            <p className="text-2xl font-extrabold tabular-nums leading-none text-gray-900 dark:text-white sm:text-3xl">
              +{p.xpReward}
            </p>
            <p className="mt-1 text-[10px] font-medium text-gray-500">XP</p>
          </div>
        </div>

        <div className="mt-4">
          <CompeteProgressBar
            pct={p.progressPct}
            label={`${p.progressPct}% · ${t('compete.progressLabel')}`}
          />
        </div>

        {detail.daily.length > 0 ? <DailyStreak daily={detail.daily} /> : null}

        {p.status === 'active' && onLeave ? (
          <button
            type="button"
            onClick={onLeave}
            className="mt-4 text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline dark:hover:text-gray-300"
          >
            {t('compete.leaveChallenge')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
