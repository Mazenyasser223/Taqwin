import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import gamificationService, { type ChallengeParticipation } from '../../services/gamificationService';
import {
  CompeteCardSkeleton,
  CompeteDashboardCard,
  CompeteMetricRow,
  CompeteProgressBar,
  CompeteTextButton,
} from './CompeteDashboardCardShell';

function challengeTitle(slug: string, t: (k: import('../../lib/i18n/translations').TranslationKey) => string) {
  const key = `compete.challenge.${slug}.title` as import('../../lib/i18n/translations').TranslationKey;
  return t(key);
}

export function ChallengeDashboardCard() {
  const { t } = useI18n();
  const [active, setActive] = useState<ChallengeParticipation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void gamificationService.challengesSummary().then((res) => {
      if (cancelled) return;
      setActive(res.data?.active?.[0] ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <CompeteCardSkeleton theme="challenge" />;

  if (!active) {
    return (
      <CompeteDashboardCard
        theme="challenge"
        icon="flag"
        title={t('compete.challengesTitle')}
        action={
          <CompeteTextButton to="/compete/challenges" variant="ghost">
            {t('compete.browseChallenges')}
          </CompeteTextButton>
        }
      >
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-xs">
          {t('compete.noActiveChallenge')}
        </p>
      </CompeteDashboardCard>
    );
  }

  const pct = active.progressPct ?? 0;

  return (
    <CompeteDashboardCard
      href={`/compete/challenges?focus=${active.id}`}
      theme="challenge"
      icon={active.icon}
      title={challengeTitle(active.slug, t)}
      meta={
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {t('compete.xpReward', { amount: String(active.xpReward) })}
        </span>
      }
    >
      <CompeteMetricRow
        items={[
          {
            value: (
              <>
                {active.progress}
                <span className="text-base font-semibold text-gray-400">/{active.target}</span>
              </>
            ),
            label: t('compete.progressLabel'),
          },
          { value: active.daysLeft, label: t('compete.daysLeft') },
        ]}
      />
      <CompeteProgressBar pct={pct} label={t('compete.progressLabel')} />
    </CompeteDashboardCard>
  );
}
