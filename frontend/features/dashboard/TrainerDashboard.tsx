import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { staggerContainer, contentRevealVariants } from '../../lib/motion';
import dashboardService, { type TrainerDashboard as DashType } from '../../services/dashboardService';
import type { TranslationKey } from '../../lib/i18n/translations';
import { Badge, Card, KpiCard, PageHeader, CARD_INNER } from '../../components/tailadmin';
import { cn } from '../../lib/cn';

const FALLBACK_AVATAR = (id: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

export const TrainerDashboard: React.FC = () => {
  const { t, isRtl } = useI18n();
  const user = useAuthStore((s) => s.user);
  const name = user?.profile?.displayName || user?.email?.split('@')[0] || 'Trainer';
  const [stats, setStats] = useState<DashType | null>(null);

  const links = useMemo(
    () => [
      { to: '/clients', titleKey: 'trainer.link.clients' as TranslationKey, descKey: 'trainer.link.clientsDesc' as TranslationKey, icon: 'groups' },
      { to: '/profile', titleKey: 'trainer.link.profile' as TranslationKey, descKey: 'trainer.link.profileDesc' as TranslationKey, icon: 'badge' },
      { to: '/workouts', titleKey: 'trainer.link.workouts' as TranslationKey, descKey: 'trainer.link.workoutsDesc' as TranslationKey, icon: 'fitness_center' },
      { to: '/ai-assistant', titleKey: 'trainer.link.ai' as TranslationKey, descKey: 'trainer.link.aiDesc' as TranslationKey, icon: 'auto_awesome' },
    ],
    []
  );

  const statCards = useMemo(
    () => [
      { labelKey: 'trainer.stat.clients' as TranslationKey, value: stats?.totals.clients ?? 0, icon: 'groups', accent: 'brand' as const },
      { labelKey: 'trainer.stat.upcoming' as TranslationKey, value: stats?.totals.upcomingSessions ?? 0, icon: 'event', accent: 'info' as const },
      { labelKey: 'trainer.stat.completed' as TranslationKey, value: stats?.totals.completedSessions ?? 0, icon: 'task_alt', accent: 'success' as const },
    ],
    [stats]
  );

  useEffect(() => {
    dashboardService.trainer().then((res) => {
      if (res.data) setStats(res.data);
    });
  }, []);

  return (
    <div className="trainer-dashboard page-shell pb-2">
      <PageHeader
        title={t('trainer.welcomeName', { name })}
        subtitle={
          stats
            ? t('trainer.statsLine', {
                upcoming: String(stats.totals.upcomingSessions),
                clients: String(stats.totals.clients),
              })
            : t('trainer.loadingNumbers')
        }
        badge={t('trainer.workspace')}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((s) => (
          <KpiCard key={s.labelKey} label={t(s.labelKey)} value={s.value} icon={s.icon} accent={s.accent} />
        ))}
      </div>

      {stats && stats.upcoming.length > 0 && (
        <Card title={t('trainer.upcomingSessions')}>
          <div className="space-y-3">
            {stats.upcoming.map((b) => (
              <div
                key={b.id}
                className={cn(CARD_INNER, 'flex items-center gap-4 p-4')}
              >
                <img src={b.athlete.profile?.avatarUrl || FALLBACK_AVATAR(b.athlete.id)} alt="" className="size-10 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">
                    {b.athlete.profile?.displayName ?? t('trainer.athlete')}
                  </p>
                  <p className="text-theme-xs text-gray-500">{new Date(b.scheduledAt).toLocaleString()}</p>
                </div>
                <Badge color="primary">{b.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <motion.div
        variants={staggerContainer(0.06, 0.2)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {links.map((item) => (
          <motion.div key={item.to} variants={contentRevealVariants}>
            <Link
              to={item.to}
              className={cn(
                CARD_INNER,
                'group block p-6 transition-colors hover:border-brand-500/30'
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 transition-colors group-hover:text-brand-500 dark:text-white">
                    {t(item.titleKey)}
                  </h2>
                  <p className="mt-1 text-theme-sm text-gray-500">{t(item.descKey)}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-theme-xs font-semibold text-brand-500">
                    {t('trainer.open')}
                    <span className="material-symbols-outlined text-sm">{isRtl ? 'arrow_back' : 'arrow_forward'}</span>
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
