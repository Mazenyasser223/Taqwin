import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, weightedTransition } from '../../lib/motion';
import { useI18n } from '../../lib/i18n/useI18n';
import exerciseService from '../../services/exerciseService';
import type { Exercise } from '../../types';
import type { TranslationKey } from '../../lib/i18n/translations';
import { QuestionnaireGate } from '../onboarding/QuestionnaireGate';
import { formatCategoryLabel } from './exerciseCategories';
import {
  categoriesForEquipmentGroup,
  equipmentGroupKey,
  allKnownEquipmentCategories,
  type BrowseSelection,
} from './exerciseCategoryGroups';
import {
  EXERCISE_MUSCLE_BROWSE_ZONES,
  exerciseMuscleBrowseKey,
  type ExerciseMuscleBrowseZone,
} from './exerciseMuscleBrowse';
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
import { RoutineLibraryPanel } from './RoutineLibraryPanel';
import { ExerciseBrowseGrid } from './ExerciseBrowseGrid';
import { ExerciseLibraryHero } from './ExerciseLibraryHero';
import { EQUIPMENT_GROUPS } from './exerciseCategoryGroups';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

const PAGE_SIZE = 24;
const MIN_SEARCH_LEN = 2;

type ViewMode = 'browse' | 'exercises';

function selectionTitle(selection: BrowseSelection | null, t: (key: TranslationKey) => string): string {
  if (!selection) return '';
  if (selection.kind === 'muscle') {
    return t(exerciseMuscleBrowseKey(selection.id as ExerciseMuscleBrowseZone));
  }
  return t(equipmentGroupKey(selection.id));
}

export const WorkoutLibrary: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [workoutAddContext, setWorkoutAddContextState] = useState<WorkoutAddContext | null>(() =>
    getWorkoutAddContext()
  );
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [muscleCounts, setMuscleCounts] = useState<Record<string, number> | null>(null);
  const [equipmentGroupCounts, setEquipmentGroupCounts] = useState<Record<string, number> | null>(null);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [browseSelection, setBrowseSelection] = useState<BrowseSelection | null>(null);
  const [subCategory, setSubCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [logging, setLogging] = useState(false);
  const [logToast, setLogToast] = useState<string | null>(null);
  const [routineLibraryOpen, setRoutineLibraryOpen] = useState(false);
  const loadGen = useRef(0);

  const searchActive = debouncedSearch.length >= MIN_SEARCH_LEN;
  const showExercises = viewMode === 'exercises' || searchActive;

  useEffect(() => {
    setBrowseLoading(true);
    Promise.all([
      exerciseService.getCategories(),
      exerciseService.getMuscleCounts('browse'),
      exerciseService.getCategoryGroups(),
    ]).then(([cats, muscles, groups]) => {
      if (cats.data) setCategories(cats.data);
      if (muscles.data) setMuscleCounts(muscles.data);
      if (groups.data) setEquipmentGroupCounts(groups.data);
      setBrowseLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const listParams = useMemo(() => {
    const params: Parameters<typeof exerciseService.list>[0] = {
      search: searchActive ? debouncedSearch : undefined,
      pageSize: PAGE_SIZE,
      locale: language,
      set: 'browse',
    };

    if (!searchActive && browseSelection) {
      if (browseSelection.kind === 'muscle') {
        params.muscle = browseSelection.id as ExerciseMuscleBrowseZone;
      } else {
        params.categoryGroup = browseSelection.id;
      }
    }

    if (subCategory !== 'All') {
      params.category = subCategory;
      delete params.categoryGroup;
    }

    return params;
  }, [browseSelection, debouncedSearch, language, searchActive, subCategory]);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!showExercises) return;

      const gen = ++loadGen.current;
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await exerciseService.list({
        ...listParams,
        page: pageNum,
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
    [listParams, showExercises],
  );

  useEffect(() => {
    if (!showExercises) {
      setExercises([]);
      setTotal(0);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setPage(1);
    void fetchPage(1, false);
  }, [fetchPage, showExercises]);

  const subCategoryPills = useMemo(() => {
    if (!browseSelection || browseSelection.kind !== 'equipment') return [];
    const groupCats =
      browseSelection.id === 'other'
        ? categories.filter((c) => !allKnownEquipmentCategories().includes(c.category))
        : categories.filter((c) => categoriesForEquipmentGroup(browseSelection.id).includes(c.category));

    if (groupCats.length <= 1) return [];

    const allCount = groupCats.reduce((sum, c) => sum + c.count, 0);
    return [
      { value: 'All', label: t('exercises.cat.all'), count: allCount },
      ...groupCats.map((c) => ({
        value: c.category,
        label: formatCategoryLabel(c.category, t),
        count: c.count,
      })),
    ];
  }, [browseSelection, categories, t]);

  const openBrowseSelection = (selection: BrowseSelection) => {
    setBrowseSelection(selection);
    setSubCategory('All');
    setViewMode('exercises');
    setSearch('');
    setDebouncedSearch('');
    setError(null);
  };

  const backToBrowse = () => {
    setViewMode('browse');
    setBrowseSelection(null);
    setSubCategory('All');
    setSearch('');
    setDebouncedSearch('');
    setExercises([]);
    setTotal(0);
    setError(null);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setPage(next);
    void fetchPage(next, true);
  };

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

  const catalogTotal = useMemo(() => {
    if (equipmentGroupCounts) {
      return Object.values(equipmentGroupCounts).reduce((sum, n) => sum + n, 0);
    }
    return categories.reduce((sum, c) => sum + c.count, 0);
  }, [categories, equipmentGroupCounts]);

  const exercisesHeading = searchActive
    ? t('exercises.search')
    : browseSelection
      ? selectionTitle(browseSelection, t)
      : '';

  return (
    <QuestionnaireGate flow="workout" questionnairePath="/onboarding/workout">
      <div className="page-shell pb-24 relative space-y-6">
        <ExerciseLibraryHero
          search={search}
          onSearchChange={setSearch}
          catalogTotal={catalogTotal}
          muscleZoneCount={EXERCISE_MUSCLE_BROWSE_ZONES.length}
          equipmentGroupCount={EQUIPMENT_GROUPS.length}
          loading={browseLoading}
          onRoutineLibraryOpen={() => setRoutineLibraryOpen(true)}
          compact={showExercises}
          heading={exercisesHeading || undefined}
          showBack={showExercises}
          onBack={backToBrowse}
          resultTotal={showExercises && !loading && total > 0 ? total : undefined}
        />

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

        {showExercises ? (
          <>
            {subCategoryPills.length > 0 && !searchActive ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
                {subCategoryPills.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setSubCategory(cat.value)}
                    className={`shrink-0 relative px-4 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors ${
                      subCategory === cat.value ? 'text-foreground' : 'text-faint hover:text-muted'
                    }`}
                  >
                    {subCategory === cat.value && (
                      <motion.div
                        layoutId="exercise-sub-filter"
                        className="absolute inset-0 bg-elevated-hover border border-subtle rounded-2xl -z-10"
                        transition={weightedTransition}
                      />
                    )}
                    {cat.label}
                    <span className="ml-1 opacity-60">({cat.count})</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <ExerciseBrowseGrid
            muscleCounts={muscleCounts}
            equipmentGroupCounts={equipmentGroupCounts}
            loading={browseLoading}
            onSelect={openBrowseSelection}
          />
        )}

        {showExercises && loading && (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 rounded-3xl bg-elevated/60 animate-pulse border border-subtle" />
            ))}
          </motion.div>
        )}

        {showExercises && error && (
          <motion.div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</motion.div>
        )}

        {showExercises && !loading && !error && exercises.length === 0 && (
          <div className="mt-6 glass-panel p-10 rounded-3xl text-center text-muted">{t('exercises.empty')}</div>
        )}

        {showExercises && !loading && exercises.length > 0 && (
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

        {showExercises && hasMore && !loading && (
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
          {routineLibraryOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 safe-bottom"
              onClick={() => setRoutineLibraryOpen(false)}
            >
              <motion.div
                initial={{ y: 16, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-panel w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-subtle p-4 sm:p-5"
                role="dialog"
                aria-modal="true"
                aria-labelledby="routine-library-title"
              >
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRoutineLibraryOpen(false)}
                    className="size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center"
                    aria-label={t('common.close')}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                {logToast ? (
                  <div className="mb-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                    {logToast}
                  </div>
                ) : null}
                <RoutineLibraryPanel
                  className="rounded-3xl border border-subtle bg-surface/70 p-5 shadow-sm"
                  onMessage={(message) => {
                    setLogToast(message);
                    setTimeout(() => setLogToast(null), 3000);
                  }}
                />
              </motion.div>
            </motion.div>
          )}
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
