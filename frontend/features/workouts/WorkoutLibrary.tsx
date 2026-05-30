import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, weightedTransition } from '../../lib/motion';
import { useI18n } from '../../lib/i18n/useI18n';
import exerciseService from '../../services/exerciseService';
import type { Exercise } from '../../types';
import { QuestionnaireGate } from '../onboarding/QuestionnaireGate';
import { formatCategoryLabel } from './exerciseCategories';
import {
  localizeDifficultyLabel,
  localizeMuscleLabel,
  resolveExerciseDisplayName,
} from './exerciseLocale';
import {
  appendDraftExerciseToWorkout,
  appendLogToWorkout,
  clearWorkoutAddContext,
  exerciseToPlanItem,
  getWorkoutAddContext,
  planItemWithDefaultSetRows,
  type WorkoutAddContext,
} from '../dashboard/workoutAddContext';
import { appendExerciseToSession } from '../dashboard/workoutSessionStore';
import { ExerciseDetailModal } from './ExerciseDetailModal';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

const PAGE_SIZE = 24;

export const WorkoutLibrary: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [workoutAddContext, setWorkoutAddContextState] = useState<WorkoutAddContext | null>(() =>
    getWorkoutAddContext()
  );
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [logging, setLogging] = useState(false);
  const [logToast, setLogToast] = useState<string | null>(null);
  const loadGen = useRef(0);

  useEffect(() => {
    exerciseService.getCategories().then((res) => {
      if (res.data) setCategories(res.data);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      const gen = ++loadGen.current;
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await exerciseService.list({
        category: activeCategory === 'All' ? undefined : activeCategory,
        search: debouncedSearch || undefined,
        page: pageNum,
        pageSize: PAGE_SIZE,
        locale: language,
      });

      if (gen !== loadGen.current) return;

      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setError(null);
        setExercises((prev) => (append ? [...prev, ...res.data!.items] : res.data!.items));
        setHasMore(res.data.hasMore);
        setTotal(res.data.total);
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [activeCategory, debouncedSearch, language],
  );

  useEffect(() => {
    setPage(1);
    void fetchPage(1, false);
  }, [fetchPage]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setPage(next);
    void fetchPage(next, true);
  };

  const filterPills = useMemo(() => {
    const allCount = categories.reduce((sum, c) => sum + c.count, 0);
    const pills = [{ value: 'All', label: t('exercises.cat.all'), count: allCount || total }];
    for (const c of categories) {
      pills.push({
        value: c.category,
        label: formatCategoryLabel(c.category, t),
        count: c.count,
      });
    }
    return pills;
  }, [categories, t, total]);

  const handleLog = async () => {
    if (!selected) return;
    setLogging(true);

    if (workoutAddContext) {
      const item = planItemWithDefaultSetRows(exerciseToPlanItem(selected, 3, 10));
      const existing = workoutAddContext.existingDraftItems ?? [];
      const entryKey = `plan-${existing.length}`;

      if (workoutAddContext.isLogged) {
        const res = await exerciseService.logPlanExercises({
          date: workoutAddContext.date,
          items: [item],
        });
        setLogging(false);
        if (res.error || !res.data?.logIds.length) {
          setLogToast(res.error || t('dashboard.editWorkoutSaveFailed'));
          setTimeout(() => setLogToast(null), 3000);
          return;
        }
        appendLogToWorkout(workoutAddContext.userId, workoutAddContext.date, entryKey, res.data.logIds[0]);
        appendDraftExerciseToWorkout(
          workoutAddContext.userId,
          workoutAddContext.date,
          item,
          existing
        );
        appendExerciseToSession(workoutAddContext.userId, workoutAddContext.date, item, {
          thumbnailUrl: selected.thumbnailUrl ?? undefined,
          primaryMuscles: selected.primaryMuscles,
        });
      } else {
        appendDraftExerciseToWorkout(
          workoutAddContext.userId,
          workoutAddContext.date,
          item,
          existing
        );
        appendExerciseToSession(workoutAddContext.userId, workoutAddContext.date, item, {
          thumbnailUrl: selected.thumbnailUrl ?? undefined,
          primaryMuscles: selected.primaryMuscles,
        });
        setLogging(false);
      }

      clearWorkoutAddContext();
      setWorkoutAddContextState(null);
      setLogToast(t('exercises.addedToWorkout'));
      setSelected(null);
      navigate('/dashboard');
      return;
    }

    const res = await exerciseService.logExercise(selected.id);
    setLogging(false);
    if (res.error) {
      setLogToast(res.error);
    } else {
      setLogToast(t('exercises.logged', { name: resolveExerciseDisplayName(selected, language) }));
      setTimeout(() => setSelected(null), 900);
    }
    setTimeout(() => setLogToast(null), 3000);
  };

  return (
    <QuestionnaireGate flow="workout" questionnairePath="/onboarding/workout">
      <div className="page-shell pb-24 relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
            <div className="flex items-center gap-3 text-primary mb-2">
              <span className="material-symbols-outlined font-black">fitness_center</span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('workouts.area')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight page-title">
              {t('exercises.title')} <span className="text-primary italic">{t('exercises.titleAccent')}</span>
            </h1>
            <p className="text-muted mt-2 max-w-xl text-sm sm:text-base page-subtitle">{t('exercises.subtitle')}</p>
            {!loading && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-faint mt-2">
                {t('exercises.totalCount', { count: String(total) })}
              </p>
            )}
          </motion.div>
          <Link
            to="/muscle-wiki"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/10 border border-primary/25 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/15"
          >
            <span className="material-symbols-outlined text-base">accessibility_new</span>
            {t('exercises.openMuscleWiki')}
          </Link>
        </div>

        {workoutAddContext ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
            <p className="text-sm font-bold text-primary">{t('exercises.addingToWorkout')}</p>
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="text-xs font-black uppercase tracking-widest text-primary hover:underline"
              >
                {t('exercises.backToWorkout')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  clearWorkoutAddContext();
                  setWorkoutAddContextState(null);
                }}
                className="text-xs font-bold uppercase tracking-widest text-muted hover:text-foreground"
              >
                {t('nutrition.cancelMealAdd')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 relative z-10">
          <label className="block">
            <span className="sr-only">{t('exercises.search')}</span>
            <div className="flex items-center gap-2 rounded-2xl border border-subtle bg-surface/80 px-4 py-3">
              <span className="material-symbols-outlined text-faint">search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('exercises.searchPlaceholder')}
                className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-faint min-w-0"
              />
            </div>
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
          {filterPills.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setActiveCategory(cat.value)}
              className={`shrink-0 relative px-4 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                activeCategory === cat.value ? 'text-foreground' : 'text-faint hover:text-muted'
              }`}
            >
              {activeCategory === cat.value && (
                <motion.div
                  layoutId="exercise-filter"
                  className="absolute inset-0 bg-elevated-hover border border-subtle rounded-2xl -z-10"
                  transition={weightedTransition}
                />
              )}
              {cat.label}
              <span className="ml-1 opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>

        {loading && (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 rounded-3xl bg-elevated/60 animate-pulse border border-subtle" />
            ))}
          </motion.div>
        )}

        {error && (
          <motion.div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</motion.div>
        )}

        {!loading && !error && exercises.length === 0 && (
          <div className="mt-6 glass-panel p-10 rounded-3xl text-center text-muted">{t('exercises.empty')}</div>
        )}

        {!loading && exercises.length > 0 && (
          <motion.div
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="visible"
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5"
          >
            <AnimatePresence mode="popLayout">
              {exercises.map((ex) => (
                <motion.button
                  key={ex.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  onClick={() => setSelected(ex)}
                  className="text-left glass-panel rounded-3xl overflow-hidden border border-subtle hover:border-primary/40 transition-all group flex flex-col h-full"
                >
                  <div className="aspect-[4/3] relative bg-black/30 overflow-hidden">
                    <img
                      src={ex.thumbnailUrl || FALLBACK_IMG}
                      alt={ex.name}
                      loading="lazy"
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                    <motion.div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    {ex.videoUrl && (
                      <span className="absolute bottom-3 right-3 size-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-lg">play_arrow</span>
                      </span>
                    )}
                    <span className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
                      {formatCategoryLabel(ex.category, t)}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col flex-1 gap-2">
                    <h3 className="font-black text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {resolveExerciseDisplayName(ex, language)}
                    </h3>
                    <p className="text-[10px] text-faint font-bold uppercase tracking-wider">
                      {ex.primaryMuscles.slice(0, 2).map((m) => localizeMuscleLabel(m, language)).join(' · ')}
                      {ex.difficulty ? ` · ${localizeDifficultyLabel(ex.difficulty, language)}` : ''}
                    </p>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {hasMore && !loading && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="px-8 py-3 rounded-2xl bg-elevated border border-subtle font-bold text-sm disabled:opacity-50"
            >
              {loadingMore ? t('common.loading') : t('exercises.loadMore')}
            </button>
          </div>
        )}

        <AnimatePresence>
          {selected && (
            <ExerciseDetailModal
              exercise={selected}
              onClose={() => setSelected(null)}
              onLog={handleLog}
              logging={logging}
              logToast={logToast}
            />
          )}
        </AnimatePresence>
      </div>
    </QuestionnaireGate>
  );
};
