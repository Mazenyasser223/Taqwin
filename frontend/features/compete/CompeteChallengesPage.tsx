import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import gamificationService, {
  type ChallengeDetail,
  type ChallengeTemplate,
} from '../../services/gamificationService';

const CARD =
  'rounded-xl border border-gray-200/80 bg-white/90 shadow-sm dark:border-gray-800 dark:bg-[#0c1220]/90';

const STATUS_KEYS = {
  active: 'compete.status.active',
  completed: 'compete.status.completed',
  failed: 'compete.status.failed',
  abandoned: 'compete.status.abandoned',
} as const;

function challengeKey(slug: string, field: 'title' | 'desc') {
  return `compete.challenge.${slug}.${field}` as import('../../lib/i18n/translations').TranslationKey;
}

export const CompeteChallengesPage: React.FC = () => {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const [catalog, setCatalog] = useState<ChallengeTemplate[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await gamificationService.challenges();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setCatalog(res.data?.catalog ?? []);
    setCompletedCount(res.data?.completedCount ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId) {
      setDetail(null);
      return;
    }
    void gamificationService.challengeDetail(focusId).then((res) => {
      if (!res.error && res.data) setDetail(res.data);
    });
  }, [focusId]);

  const handleJoin = async (slug: string) => {
    setJoining(slug);
    const res = await gamificationService.joinChallenge(slug);
    setJoining(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    await load();
    if (res.data?.participation?.id) {
      const detailRes = await gamificationService.challengeDetail(res.data.participation.id);
      if (!detailRes.error && detailRes.data) setDetail(detailRes.data);
    }
  };

  const handleLeave = async (participantId: string) => {
    const res = await gamificationService.leaveChallenge(participantId);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDetail(null);
    await load();
  };

  const sortedCatalog = useMemo(
    () => [...catalog].sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog],
  );

  return (
    <div className="page-shell mx-auto w-full max-w-3xl flex-1 pb-8">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/dashboard" className="text-brand-500 hover:text-brand-600">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{t('compete.challengesTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('compete.challengesSubtitle', { count: String(completedCount) })}
          </p>
        </div>
        <Link
          to="/compete/social"
          className="rounded-lg border border-brand-500/40 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400"
        >
          {t('compete.socialTitle')}
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {detail && (
        <div className={cn(CARD, 'mb-6 p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-500">{detail.participation.icon}</span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t(challengeKey(detail.participation.slug, 'title'))}
                </h2>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t(challengeKey(detail.participation.slug, 'desc'))}
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {t(STATUS_KEYS[detail.participation.status] ?? STATUS_KEYS.active)}
            </span>
          </div>

          <div className="mt-4 flex items-end gap-6">
            <div>
              <p className="text-3xl font-extrabold text-brand-600 dark:text-brand-400">
                {detail.participation.progress}/{detail.participation.target}
              </p>
              <p className="text-xs text-gray-500">{t('compete.progressLabel')}</p>
            </div>
            {detail.participation.status === 'active' && (
              <p className="text-sm text-gray-500">
                {t('compete.daysLeftInline', { count: String(detail.participation.daysLeft) })}
              </p>
            )}
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${detail.participation.progressPct}%` }}
            />
          </div>

          {detail.daily.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('compete.dailyChecklist')}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {detail.daily.map((day) => (
                  <div
                    key={day.dateKey}
                    title={day.dateKey}
                    className={cn(
                      'flex h-8 items-center justify-center rounded-md text-[10px] font-medium',
                      day.pending && 'bg-gray-100 text-gray-400 dark:bg-gray-800',
                      !day.pending && day.met && 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                      !day.pending && !day.met && 'bg-gray-100 text-gray-500 dark:bg-gray-800',
                    )}
                  >
                    {day.dateKey.slice(8)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.participation.status === 'active' && (
            <button
              type="button"
              onClick={() => void handleLeave(detail.participation.id)}
              className="mt-4 text-xs text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('compete.leaveChallenge')}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-gray-500 animate-pulse">{t('compete.loadingChallenges')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedCatalog.map((item) => {
            const active = item.activeParticipation;
            const canJoin = !active;
            return (
              <div key={item.slug} className={cn(CARD, 'flex flex-col p-4')}>
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-brand-500">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 dark:text-white">{t(challengeKey(item.slug, 'title'))}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {t(challengeKey(item.slug, 'desc'))}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{item.durationDays} {t('compete.daysShort')}</span>
                  <span>·</span>
                  <span>{item.target} {t('compete.targetLabel')}</span>
                  <span>·</span>
                  <span>+{item.xpReward} XP</span>
                </div>
                {active ? (
                  <Link
                    to={`/compete/challenges?focus=${active.id}`}
                    className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-500/10 px-3 py-2 text-xs font-semibold text-brand-600 dark:text-brand-400"
                  >
                    {active.progress}/{active.target} · {t('compete.viewDetails')}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!canJoin || joining === item.slug}
                    onClick={() => void handleJoin(item.slug)}
                    className="mt-4 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {joining === item.slug ? t('compete.joiningChallenge') : t('compete.joinChallenge')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
