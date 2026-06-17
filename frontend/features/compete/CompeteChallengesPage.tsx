import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import gamificationService, {
  type ChallengeDetail,
  type ChallengeTemplate,
} from '../../services/gamificationService';
import { CompetePageShell } from './CompetePageShell';
import { CompeteCardSkeleton } from './CompeteDashboardCardShell';
import { ChallengeActiveHero } from './ChallengeActiveHero';
import { ChallengeCatalogCard, ChallengeCatalogSkeleton } from './ChallengeCatalogCard';

const ERROR_CARD =
  'rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';

export const CompeteChallengesPage: React.FC = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const [catalog, setCatalog] = useState<ChallengeTemplate[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    setLoading(true);
    setError(null);
    const res = await gamificationService.challenges({ refresh: opts?.refresh });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setCatalog(res.data?.catalog ?? []);
    setCompletedCount(res.data?.completedCount ?? 0);
  }, []);

  const loadDetail = useCallback(async (participantId: string) => {
    setDetailLoading(true);
    const res = await gamificationService.challengeDetail(participantId);
    setDetailLoading(false);
    if (!res.error && res.data) setDetail(res.data);
    else setDetail(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstActiveId = useMemo(
    () => catalog.find((c) => c.activeParticipation)?.activeParticipation?.id ?? null,
    [catalog],
  );

  const detailTargetId = focusId ?? firstActiveId;

  useEffect(() => {
    if (!detailTargetId) {
      setDetail(null);
      return;
    }
    void loadDetail(detailTargetId);
  }, [detailTargetId, loadDetail]);

  const handleJoin = async (slug: string) => {
    setJoining(slug);
    const res = await gamificationService.joinChallenge(slug);
    setJoining(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    await load({ refresh: true });
    if (res.data?.participation?.id) {
      setSearchParams({ focus: res.data.participation.id });
    }
  };

  const handleLeave = async (participantId: string) => {
    const res = await gamificationService.leaveChallenge(participantId);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSearchParams({});
    setDetail(null);
    await load();
  };

  const sortedCatalog = useMemo(
    () => [...catalog].sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog],
  );

  return (
    <CompetePageShell
      title={t('compete.challengesTitle')}
      subtitle={t('compete.challengesSubtitle', { count: String(completedCount) })}
      action={
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <Link
            to="/compete/league"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200/90 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-white dark:border-white/12 dark:bg-white/[0.06] dark:text-gray-200 sm:text-xs"
          >
            <span className="material-symbols-outlined text-[16px]">emoji_events</span>
            {t('compete.leagueTitle')}
          </Link>
          <Link
            to="/compete/social"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#f37021]/35 bg-[#f37021]/10 px-3 py-1.5 text-[11px] font-semibold text-[#f37021] transition hover:bg-[#f37021]/15 sm:text-xs"
          >
            <span className="material-symbols-outlined text-[16px]">groups</span>
            {t('compete.socialTitle')}
          </Link>
        </div>
      }
    >
      {error ? <div className={cn(ERROR_CARD, 'mb-4')}>{error}</div> : null}

      {loading ? (
        <CompeteCardSkeleton theme="challenge" />
      ) : detailLoading && !detail ? (
        <CompeteCardSkeleton theme="challenge" />
      ) : detail ? (
        <ChallengeActiveHero
          detail={detail}
          onLeave={
            detail.participation.status === 'active'
              ? () => void handleLeave(detail.participation.id)
              : undefined
          }
        />
      ) : null}

      {loading ? (
        <ChallengeCatalogSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sortedCatalog.map((item) => (
            <ChallengeCatalogCard
              key={item.slug}
              item={item}
              joining={joining === item.slug}
              onJoin={(slug) => void handleJoin(slug)}
            />
          ))}
        </div>
      )}
    </CompetePageShell>
  );
};
