import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  staggerContainer,
  buttonPress,
  weightedTransition,
  liftVariants,
} from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { WorkoutsVisual } from '../../3d/PageSpecificVisuals';
import workoutService from '../../services/workoutService';
import type { Workout } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

const CATEGORIES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'All', labelKey: 'workouts.cat.all' },
  { value: 'Strength', labelKey: 'workouts.cat.strength' },
  { value: 'Yoga', labelKey: 'workouts.cat.yoga' },
  { value: 'Cardio', labelKey: 'workouts.cat.cardio' },
  { value: 'Recovery', labelKey: 'workouts.cat.recovery' },
  { value: 'HIIT', labelKey: 'workouts.cat.hiit' },
  { value: 'Mobility', labelKey: 'workouts.cat.mobility' },
];

export const WorkoutLibrary: React.FC = () => {
  const { t } = useI18n();
  const [activeFilter, setActiveFilter] = useState('All');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Workout | null>(null);
  const [logging, setLogging] = useState(false);
  const [logToast, setLogToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    workoutService.getWorkouts().then((res) => {
      if (!mounted) return;
      if (res.error) setError(res.error);
      else setWorkouts(res.data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(
    () => (activeFilter === 'All' ? workouts : workouts.filter((w) => w.category === activeFilter)),
    [workouts, activeFilter]
  );

  const handleLog = async () => {
    if (!selected) return;
    setLogging(true);
    const res = await workoutService.logWorkout({ workoutId: selected.id });
    setLogging(false);
    if (res.error) {
      setLogToast(res.error);
    } else {
      setLogToast(t('workouts.logged', { title: selected.title }));
      setTimeout(() => setSelected(null), 800);
    }
    setTimeout(() => setLogToast(null), 3000);
  };

  return (
    <div className="page-shell pb-2 relative">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">fitness_center</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('workouts.area')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground page-title">
            {t('workouts.title')} <span className="text-primary italic">{t('workouts.titleAccent')}</span>
          </h1>
          <p className="text-muted mt-4 max-w-lg font-medium page-subtitle">
            {t('workouts.subtitle')}
          </p>
        </motion.div>

        <div className="hidden lg:block absolute -top-16 -right-16 w-80 h-80 pointer-events-none opacity-60">
          <WorkoutsVisual />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-3 relative z-10 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveFilter(cat.value)}
            className={`relative px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors duration-300 ${
              activeFilter === cat.value ? 'text-foreground' : 'text-faint hover:text-muted'
            }`}
          >
            {activeFilter === cat.value && (
              <motion.div
                layoutId="filter-pill"
                className="absolute inset-0 bg-elevated-hover border border-subtle rounded-2xl -z-10"
                transition={weightedTransition}
              />
            )}
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {loading && <div className="text-primary animate-pulse">{t('workouts.loading')}</div>}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="glass-panel p-10 rounded-3xl text-center text-muted">
          {t('workouts.empty')}
        </div>
      )}

      <motion.div
        layout
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 relative z-10"
      >
        <AnimatePresence mode="popLayout">
          {filtered.map((w) => (
            <motion.div
              layout
              key={w.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={weightedTransition}
            >
              <Magnetic strength={0.15}>
                <TiltCard maxTilt={5}>
                  <motion.div
                    variants={liftVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => setSelected(w)}
                    className="glass-panel rounded-[2.5rem] overflow-hidden group hover:border-primary/50 transition-all cursor-pointer flex flex-col h-full"
                  >
                    <div className="h-60 relative overflow-hidden bg-black/40">
                      <motion.img
                        src={w.imageUrl || FALLBACK_IMG}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700"
                        alt={w.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                      <div className="absolute top-6 left-6">
                        <span className="bg-primary/20 backdrop-blur-xl border border-primary/30 px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest text-primary">
                          {w.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-8 flex flex-col flex-1 gap-6 relative">
                      <div>
                        <h3 className="text-2xl font-black group-hover:text-primary transition-colors leading-tight tracking-tight">
                          {w.title}
                        </h3>
                        <p className="text-[10px] text-faint font-bold uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary" />
                          {w.difficulty}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-6 py-5 border-y border-subtle">
                        <div className="space-y-1">
                          <p className="text-lg font-black text-foreground">{w.durationMin}m</p>
                          <p className="text-[9px] text-faint font-black uppercase tracking-widest">{t('common.time')}</p>
                        </div>
                        <div className="space-y-1 pl-6 border-l border-subtle">
                          <p className="text-lg font-black text-foreground">{w.calories}</p>
                          <p className="text-[9px] text-faint font-black uppercase tracking-widest">{t('common.calories')}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto group/btn">
                        <span className="text-xs font-black uppercase tracking-widest text-muted group-hover/btn:text-primary transition-colors">
                          {t('common.seeDetails')}
                        </span>
                        <div className="size-12 rounded-xl bg-elevated border border-subtle flex items-center justify-center group-hover:bg-primary group-hover:text-foreground group-hover:scale-110 transition-all">
                          <span className="material-symbols-outlined font-black">trending_flat</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TiltCard>
              </Magnetic>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-6 safe-bottom"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90dvh] overflow-y-auto"
            >
              <div className="h-56 relative">
                <img src={selected.imageUrl || FALLBACK_IMG} className="w-full h-full object-cover" alt={selected.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-4 left-6">
                  <h3 className="text-3xl font-black text-foreground">{selected.title}</h3>
                  <p className="text-xs uppercase tracking-widest text-primary font-black mt-1">{selected.category} · {selected.difficulty}</p>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-muted text-sm leading-relaxed">{selected.description || t('common.noDescription')}</p>
                <div className="flex gap-6 text-sm text-muted">
                  <span><b className="text-foreground">{selected.durationMin}</b> {t('common.min')}</span>
                  <span><b className="text-foreground">{selected.calories}</b> {t('common.kcal')}</span>
                </div>
                {logToast && (
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-sm">{logToast}</div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setSelected(null)} className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold hover:bg-elevated-hover">
                    {t('common.close')}
                  </button>
                  <motion.button
                    variants={buttonPress}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={handleLog}
                    disabled={logging}
                    className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50"
                  >
                    {logging ? t('workouts.logging') : t('workouts.logWorkout')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
