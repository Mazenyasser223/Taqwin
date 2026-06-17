import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { ChallengeTemplate } from '../../services/gamificationService';
import { CHALLENGE_THEME, challengeKey } from './challengeUiShared';

export function ChallengeCatalogCard({
  item,
  joining,
  onJoin,
}: {
  item: ChallengeTemplate;
  joining: boolean;
  onJoin: (slug: string) => void;
}) {
  const { t } = useI18n();
  const theme = CHALLENGE_THEME;
  const active = item.activeParticipation;
  const isActive = Boolean(active);

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-shadow duration-300',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        isActive ? theme.border : 'border-gray-200/90 dark:border-white/10',
        'hover:shadow-xl',
      )}
      style={
        isActive
          ? { boxShadow: `0 8px 28px -10px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.1)` }
          : undefined
      }
    >
      {isActive ? (
        <div
          className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60', theme.wash)}
          aria-hidden
        />
      ) : null}

      <div className="relative z-[1] flex flex-1 flex-col">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-white/15',
              theme.iconFrom,
              theme.iconTo,
            )}
            style={{ boxShadow: isActive ? `0 6px 16px -6px ${theme.glow}` : undefined }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: theme.accent }}>
              {item.icon}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold leading-tight text-gray-900 dark:text-white">
              {t(challengeKey(item.slug, 'title'))}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t(challengeKey(item.slug, 'desc'))}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">
            {item.durationDays} {t('compete.daysShort')}
          </span>
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">
            {item.target} {t('compete.targetLabel')}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ background: theme.accent, boxShadow: `0 2px 8px -2px ${theme.glow}` }}
          >
            +{item.xpReward} XP
          </span>
        </div>

        {active ? (
          <Link
            to={`/compete/challenges?focus=${active.id}`}
            className={cn(
              'mt-4 inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold transition',
              'border border-[#f37021]/35 bg-[#f37021]/10 text-[#f37021] hover:bg-[#f37021]/15',
            )}
          >
            {active.progress}/{active.target} · {t('compete.viewDetails')}
          </Link>
        ) : (
          <button
            type="button"
            disabled={joining}
            onClick={() => onJoin(item.slug)}
            className="mt-4 rounded-xl px-3 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{
              background: theme.accent,
              boxShadow: `0 6px 18px -6px ${theme.glow}`,
            }}
          >
            {joining ? t('compete.joiningChallenge') : t('compete.joinChallenge')}
          </button>
        )}
      </div>
    </div>
  );
}

export function ChallengeCatalogSkeleton() {
  const theme = CHALLENGE_THEME;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-[168px] animate-pulse rounded-2xl border p-4',
            'border-gray-200/90 dark:border-white/10',
            theme.border,
          )}
        >
          <div className="flex gap-2">
            <div className="h-10 w-10 rounded-xl bg-gray-200/80 dark:bg-white/[0.08]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-gray-200/80 dark:bg-white/[0.08]" />
              <div className="h-2 w-full rounded bg-gray-200/80 dark:bg-white/[0.08]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
