import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { LeagueDashboardCard } from './LeagueDashboardCard';
import { ChallengeDashboardCard } from './ChallengeDashboardCard';
import { useCompeteDashboard } from './useCompeteDashboard';

export function CompeteHomeSection() {
  const { t } = useI18n();
  const { league, activeChallenge, loading } = useCompeteDashboard();

  return (
    <section aria-label={t('compete.profileSectionTitle')} className="w-full min-w-0">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 md:gap-5">
        <div data-tour="home-league">
          <LeagueDashboardCard league={league} loading={loading} />
        </div>
        <div data-tour="home-challenge">
          <ChallengeDashboardCard active={activeChallenge} loading={loading} />
        </div>
      </div>
    </section>
  );
}
