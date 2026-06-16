import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import gamificationService, { type LeagueStatus } from '../../services/gamificationService';
import {
  CompeteCardSkeleton,
  CompeteDashboardCard,
  CompeteMetricRow,
  CompeteProgressBar,
  CompeteTextButton,
} from './CompeteDashboardCardShell';
import { LeagueTierBadge } from './LeagueTierBadge';

export function LeagueDashboardCard() {
  const { t } = useI18n();
  const [league, setLeague] = useState<LeagueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void gamificationService.leagueCurrent().then((res) => {
      if (cancelled) return;
      setLeague(res.data ?? { optedIn: false });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <CompeteCardSkeleton theme="league" />;

  if (!league?.optedIn) {
    return (
      <CompeteDashboardCard
        theme="league"
        icon="emoji_events"
        title={t('compete.leagueTitle')}
        action={<CompeteTextButton to="/compete/league">{t('compete.joinLeague')}</CompeteTextButton>}
      >
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-xs">
          {t('compete.leagueJoinHint')}
        </p>
      </CompeteDashboardCard>
    );
  }

  const tier = league.tier ?? 'bronze';
  const daysProgress =
    league.daysRequired && league.daysRequired > 0
      ? Math.min(100, Math.round(((league.daysCounted ?? 0) / league.daysRequired) * 100))
      : 0;

  return (
    <CompeteDashboardCard
      href="/compete/league"
      theme="league"
      icon="emoji_events"
      title={t('compete.leagueTitle')}
      action={<LeagueTierBadge tier={tier} rank={league.rank} />}
    >
      <CompeteMetricRow
        items={[
          { value: league.weeklyAvg ?? '—', label: t('compete.weeklyAvg') },
          { value: league.rank != null ? `#${league.rank}` : '—', label: t('compete.yourRank') },
        ]}
      />
      <CompeteProgressBar
        pct={daysProgress}
        label={t('compete.daysCounted', {
          count: String(league.daysCounted ?? 0),
          required: String(league.daysRequired ?? 3),
        })}
      />
    </CompeteDashboardCard>
  );
}
