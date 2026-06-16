import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import gamificationService, {
  type GamificationAchievements,
  type GamificationProfile,
} from '../../services/gamificationService';
import { xpLevelProgress } from '../compete/xpLevel';

const TIER_COLORS: Record<string, string> = {
  bronze: 'text-amber-700 dark:text-amber-400',
  silver: 'text-gray-500 dark:text-gray-300',
  gold: 'text-yellow-600 dark:text-yellow-400',
  diamond: 'text-cyan-600 dark:text-cyan-300',
};

function achievementTitle(slug: string, t: (k: import('../../lib/i18n/translations').TranslationKey) => string) {
  const key = `compete.achievement.${slug}.title` as import('../../lib/i18n/translations').TranslationKey;
  return t(key);
}

export function ProfileGamificationSection() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [earned, setEarned] = useState<GamificationAchievements['earned']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [achievementsRes, meRes] = await Promise.all([
      gamificationService.achievements(),
      gamificationService.me(),
    ]);

    if (achievementsRes.data) {
      setProfile(achievementsRes.data.profile);
      setEarned(achievementsRes.data.earned ?? []);
      setLoading(false);
      return;
    }

    if (meRes.data?.profile) {
      setProfile(meRes.data.profile);
      setEarned([]);
      setLoading(false);
      if (achievementsRes.error) setError(achievementsRes.error);
      return;
    }

    setError(achievementsRes.error || meRes.error || 'Failed to load compete profile');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="glass-panel rounded-xl sm:rounded-3xl border-subtle p-4 sm:p-6 animate-pulse">
        <div className="h-5 w-40 rounded bg-surface" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="glass-panel rounded-xl sm:rounded-3xl border-subtle p-4 sm:p-6">
        <p className="text-sm text-red-400">{error ?? t('compete.profileLoadError')}</p>
        <button type="button" onClick={() => void load()} className="mt-2 text-xs font-semibold text-brand-500">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const tier = profile.currentTier ?? 'bronze';
  const { level: xpLevel, ptsToNext } = xpLevelProgress(profile.lifetimeXp);

  return (
    <section className="glass-panel rounded-xl sm:rounded-3xl border-2 border-brand-500/25 ring-1 ring-brand-500/10 p-4 sm:p-6 space-y-4 shadow-[0_4px_24px_-4px_rgba(21,139,141,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground">{t('compete.profileSectionTitle')}</h2>
          <p className="text-sm text-faint mt-1">{t('compete.profileSectionHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/compete/league"
            className="rounded-lg border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400"
          >
            {t('compete.leagueTitle')}
          </Link>
          <Link
            to="/compete/challenges"
            className="rounded-lg border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400"
          >
            {t('compete.challengesTitle')}
          </Link>
          <Link
            to="/compete/social"
            className="rounded-lg border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400"
          >
            {t('compete.socialTitle')}
          </Link>
        </div>
      </div>

      {error && <p className="text-xs text-amber-500/90">{error}</p>}

      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className={cn('text-2xl font-extrabold uppercase tracking-wide', TIER_COLORS[tier] ?? TIER_COLORS.bronze)}>
            {t(`compete.tier.${tier}` as import('../../lib/i18n/translations').TranslationKey)}
          </p>
          <p className="text-[11px] text-faint uppercase tracking-widest">{t('compete.tierLabel')}</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-foreground">{profile.lifetimeXp}</p>
          <p className="text-[11px] text-faint uppercase tracking-widest">{t('compete.lifetimeXp')}</p>
          <p className="mt-1 text-[11px] text-faint">
            {t('dashboard.profileXpLevel', { level: String(xpLevel) })}
            {' · '}
            {t('dashboard.profilePtsToNext', { pts: String(ptsToNext) })}
          </p>
        </div>
      </div>

      {earned.length === 0 ? (
        <p className="text-sm text-faint">{t('compete.noBadgesYet')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {earned.map((badge) => (
            <div
              key={badge.slug}
              className="rounded-xl border border-subtle bg-surface/50 p-3 flex flex-col items-center text-center gap-2"
            >
              <span className="material-symbols-outlined text-2xl text-brand-500">{badge.icon}</span>
              <p className="text-xs font-bold text-foreground leading-snug">{achievementTitle(badge.slug, t)}</p>
              {badge.earnedAt && (
                <p className="text-[10px] text-faint">
                  {new Date(badge.earnedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
