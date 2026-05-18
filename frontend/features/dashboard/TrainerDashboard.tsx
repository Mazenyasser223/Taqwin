import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { staggerContainer, contentRevealVariants } from '../../lib/motion';
import { TiltCard } from '../../components/shared/MotionWrappers';
import dashboardService, { type TrainerDashboard as DashType } from '../../services/dashboardService';

const links = [
  { to: '/clients', title: 'Clients', desc: 'Manage your roster', icon: 'groups' },
  { to: '/profile', title: 'Profile', desc: 'Bio, specialties, credentials', icon: 'badge' },
  { to: '/workouts', title: 'Workouts', desc: 'Programs & library', icon: 'fitness_center' },
  { to: '/ai-assistant', title: 'AI Coach', desc: 'Ideas for programming', icon: 'auto_awesome' },
];

const FALLBACK_AVATAR = (id: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`;

export const TrainerDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const name = user?.profile?.displayName || user?.email?.split('@')[0] || 'Trainer';
  const [stats, setStats] = useState<DashType | null>(null);

  useEffect(() => {
    dashboardService.trainer().then((res) => {
      if (res.data) setStats(res.data);
    });
  }, []);

  return (
    <div className="space-y-10 pb-20">
      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="space-y-4">
        <motion.p variants={contentRevealVariants} className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
          Trainer workspace
        </motion.p>
        <motion.h1 variants={contentRevealVariants} className="text-4xl md:text-6xl font-black tracking-tight">
          Welcome, <span className="text-primary">{name}</span>
        </motion.h1>
        <motion.p variants={contentRevealVariants} className="text-slate-400 max-w-xl font-medium">
          {stats ? (
            <>
              You have <span className="text-white font-black">{stats.totals.upcomingSessions}</span> upcoming sessions
              with <span className="text-white font-black">{stats.totals.clients}</span> athletes.
            </>
          ) : (
            'Loading your numbers…'
          )}
        </motion.p>
      </motion.div>

      <motion.div variants={staggerContainer(0.08, 0.1)} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        {[
          { label: 'Clients', value: stats?.totals.clients ?? 0, icon: 'groups' },
          { label: 'Upcoming', value: stats?.totals.upcomingSessions ?? 0, icon: 'event' },
          { label: 'Completed', value: stats?.totals.completedSessions ?? 0, icon: 'task_alt' },
        ].map((s) => (
          <motion.div key={s.label} variants={contentRevealVariants} className="glass-panel p-6 rounded-3xl border-white/5 flex items-center gap-4">
            <div className="size-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-slate-500">{s.label}</p>
              <p className="text-3xl font-black">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {stats && stats.upcoming.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary">Upcoming sessions</h3>
          <div className="space-y-3">
            {stats.upcoming.map((b) => (
              <div key={b.id} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <img src={b.athlete.profile?.avatarUrl || FALLBACK_AVATAR(b.athlete.id)} alt="" className="size-10 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{b.athlete.profile?.displayName ?? 'Athlete'}</p>
                  <p className="text-xs text-slate-400">{new Date(b.scheduledAt).toLocaleString()}</p>
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
              <Link to={item.to} className="block glass-panel p-8 rounded-3xl border-white/10 hover:border-primary/40 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black group-hover:text-primary transition-colors">{item.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary mt-4">
                      Open <span className="material-symbols-outlined text-sm">arrow_forward</span>
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
