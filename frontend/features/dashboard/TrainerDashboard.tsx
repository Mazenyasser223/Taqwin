import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { staggerContainer, contentRevealVariants } from '../../lib/motion';
import { TiltCard } from '../../components/shared/MotionWrappers';
import dashboardService, { type TrainerDashboard as DashType } from '../../services/dashboardService';
import type { TranslationKey } from '../../lib/i18n/translations';

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
      { labelKey: 'trainer.stat.clients' as TranslationKey, value: stats?.totals.clients ?? 0, icon: 'groups' },
      { labelKey: 'trainer.stat.upcoming' as TranslationKey, value: stats?.totals.upcomingSessions ?? 0, icon: 'event' },
      { labelKey: 'trainer.stat.completed' as TranslationKey, value: stats?.totals.completedSessions ?? 0, icon: 'task_alt' },
    ],
    [stats]
  );

  useEffect(() => {
    dashboardService.trainer().then((res) => {
      if (res.data) setStats(res.data);
    });
  }, []);

  return (
    <div className="page-shell pb-2">
      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="space-y-4">
        <motion.p variants={contentRevealVariants} className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
          {t('trainer.workspace')}
        </motion.p>
        <motion.h1 variants={contentRevealVariants} className="text-4xl md:text-6xl font-black tracking-tight">
          {t('trainer.welcomeName', { name })}
        </motion.h1>
        <motion.p variants={contentRevealVariants} className="text-muted max-w-xl font-medium">
          {stats ? (
            t('trainer.statsLine', {
              upcoming: String(stats.totals.upcomingSessions),
              clients: String(stats.totals.clients),
            })
          ) : (
            t('trainer.loadingNumbers')
          )}
        </motion.p>
      </motion.div>

      <motion.div variants={staggerContainer(0.08, 0.1)} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        {statCards.map((s) => (
          <motion.div key={s.labelKey} variants={contentRevealVariants} className="glass-panel p-6 rounded-3xl border-subtle flex items-center gap-4">
            <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-faint">{t(s.labelKey)}</p>
              <p className="text-3xl font-black">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {stats && stats.upcoming.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary">{t('trainer.upcomingSessions')}</h3>
          <div className="space-y-3">
            {stats.upcoming.map((b) => (
              <div key={b.id} className="flex items-center gap-4 bg-elevated p-4 rounded-2xl border border-subtle">
                <img src={b.athlete.profile?.avatarUrl || FALLBACK_AVATAR(b.athlete.id)} alt="" className="size-10 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{b.athlete.profile?.displayName ?? t('trainer.athlete')}</p>
                  <p className="text-xs text-muted">{new Date(b.scheduledAt).toLocaleString()}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <motion.div variants={staggerContainer(0.06, 0.2)} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        {links.map((item) => (
          <TiltCard key={item.to} maxTilt={5}>
            <motion.div variants={contentRevealVariants}>
              <Link to={item.to} className="block glass-panel p-8 rounded-3xl border-subtle hover:border-primary/40 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black group-hover:text-primary transition-colors">{t(item.titleKey)}</h2>
                    <p className="text-sm text-faint mt-1">{t(item.descKey)}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary mt-4">
                      {t('trainer.open')}{' '}
                      <span className="material-symbols-outlined text-sm">
                        {isRtl ? 'arrow_back' : 'arrow_forward'}
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          </TiltCard>
        ))}
      </motion.div>
    </div>
  );
};
