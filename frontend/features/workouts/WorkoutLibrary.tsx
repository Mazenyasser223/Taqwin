import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer } from '../../lib/motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useAuthStore } from '../../store/useAuthStore';
import exerciseService from '../../services/exerciseService';
import type { Exercise } from '../../types';
import { QuestionnaireGate } from '../onboarding/QuestionnaireGate';
import { formatCategoryLabel } from './exerciseCategories';
import { EXERCISE_MUSCLE_BROWSE_ZONES } from './exerciseMuscleBrowse';
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
import { requestPlanLogsView } from '../dashboard/planViewMode';
import { ExerciseEmptyState } from './ExerciseEmptyState';
import { ExerciseFavoriteButton } from './ExerciseFavoriteButton';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { ExerciseLibraryHero } from './ExerciseLibraryHero';
import { ExerciseFilterBar } from './ExerciseFilterBar';
import { ExerciseLibraryViewTabs, type ExerciseLibraryView } from './ExerciseLibraryViewTabs';
import { ExerciseSavedEmptyState, ExerciseSavedLoginPrompt } from './ExerciseSavedEmptyState';
import {
  EMPTY_EXERCISE_FILTERS,
  exerciseFiltersActive,
  type ExerciseLibraryFilters,
} from './exerciseLibraryFilters';
import {
  WORKOUT_EXERCISE_GRID,
  WORKOUT_SECTION,
  WORKOUT_SHELL,
} from './workoutLayout';
import {
  parseExerciseLibrarySearchParams,
  serializeExerciseLibrarySearchParams,
} from './exerciseLibraryUrl';
import { useExerciseFavorites } from './useExerciseFavorites';

const ExerciseDetailModal = lazy(() =>
  import('./ExerciseDetailModal').then((m) => ({ default: m.ExerciseDetailModal })),
);
const RoutineLibraryPanel = lazy(() =>
  import('./RoutineLibraryPanel').then((m) => ({ default: m.RoutineLibraryPanel })),
);

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=480&fm=webp';

const PAGE_SIZE = 24;
const MIN_SEARCH_LEN = 2;

function newListSeed(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const WorkoutLibrary: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlReadyRef = useRef(false);
  const user = useAuthStore((s) => s.user);
  const { favoriteIds, isFavorite, isToggling, toggleFavorite } = useExerciseFavorites();
  const [workoutAddContext, setWorkoutAddContextState] = useState<WorkoutAddContext | null>(() =>
    getWorkoutAddContext()
  );
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [muscleCounts, setMuscleCounts] = useState<Record<string, number> | null>(null);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [logging, setLogging] = useState(false);
  const [logToast, setLogToast] = useState<string | null>(null);
  const [routineLibraryOpen, setRoutineLibraryOpen] = useState(false);
  const [exerciseFilters, setExerciseFilters] = useState<ExerciseLibraryFilters>(EMPTY_EXERCISE_FILTERS);
  const [difficulties, setDifficulties] = useState<{ difficulty: string; count: number }[]>([]);
  const [goalCounts, setGoalCounts] = useState<Record<string, number> | null>(null);
  const [libraryView, setLibraryView] = useState<ExerciseLibraryView>('browse');
  const loadGen = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);
  const skipResultsScrollRef = useRef(true);
  const deepLinkHandledRef = useRef(false);
  const [deepLinkExerciseId, setDeepLinkExerciseId] = useState<string | null>(null);
  const [wikiMuscleFilter, setWikiMuscleFilter] = useState(false);
  const exercisesRef = useRef<Exercise[]>([]);
  exercisesRef.current = exercises;

  const filtersActive = exerciseFiltersActive(exerciseFilters);
  const searchActive = debouncedSearch.length >= MIN_SEARCH_LEN;
  const savedView = libraryView === 'saved';

  const handleExerciseFiltersChange = useCallback((next: ExerciseLibraryFilters) => {
    setWikiMuscleFilter(false);
    setExerciseFilters(next);
  }, []);

  const clearExerciseFilters = useCallback(() => {
    setWikiMuscleFilter(false);
    setExerciseFilters(EMPTY_EXERCISE_FILTERS);
  }, []);

  const handleLibraryViewChange = useCallback(
    (view: ExerciseLibraryView) => {
      if (view === libraryView) return;
      skipResultsScrollRef.current = true;
      setLibraryView(view);
      setPage(1);
      setExercises([]);
      setHasMore(false);
      setTotal(0);
      setError(null);
      setLoading(true);
      setRefreshing(false);
    },
    [libraryView],
  );

  useEffect(() => {
    const fromUrl = parseExerciseLibrarySearchParams(searchParams);
    setExerciseFilters(fromUrl.filters);
    setSearch(fromUrl.search);
    setDebouncedSearch(fromUrl.search);
    setLibraryView(fromUrl.savedView ? 'saved' : 'browse');
    setWikiMuscleFilter(fromUrl.wikiMuscleFilter);
    urlReadyRef.current = true;

    if (fromUrl.exerciseId && !deepLinkHandledRef.current) {
      deepLinkHandledRef.current = true;
      setDeepLinkExerciseId(fromUrl.exerciseId);
      void exerciseService.getExercise(fromUrl.exerciseId, language).then((res) => {
        setDeepLinkExerciseId(null);
        if (res.data) setSelected(res.data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from URL on mount
  }, []);

  useEffect(() => {
    if (!urlReadyRef.current) return;
    setSearchParams(
      serializeExerciseLibrarySearchParams({
        filters: exerciseFilters,
        search: debouncedSearch,
        savedView,
        exerciseId: selected?.id ?? deepLinkExerciseId,
        wikiMuscleFilter,
      }),
      { replace: true },
    );
  }, [debouncedSearch, deepLinkExerciseId, exerciseFilters, savedView, selected?.id, setSearchParams, wikiMuscleFilter]);

  useEffect(() => {
    setBrowseLoading(true);
    void exerciseService.getBrowseMetadata().then((res) => {
      if (res.data) {
        setCategories(res.data.categories);
        setMuscleCounts(res.data.muscleCounts);
        setDifficulties(res.data.difficulties);
        setGoalCounts(res.data.goalCounts);
      }
      setBrowseLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of categories) m[c.category] = c.count;
    return m;
  }, [categories]);

  const listSeed = useMemo(
    () =>
      newListSeed(),
    [
      savedView,
      exerciseFilters.categories.join(','),
      exerciseFilters.difficulty ?? '',
      exerciseFilters.muscle ?? '',
      exerciseFilters.goals.join(','),
      wikiMuscleFilter ? 'wiki' : '',
      searchActive ? debouncedSearch : '',
    ],
  );

  const listParams = useMemo(() => {
    const params: Parameters<typeof exerciseService.list>[0] = {
      pageSize: PAGE_SIZE,
      locale: language,
      set: wikiMuscleFilter && exerciseFilters.muscle ? 'wiki' : 'browse',
    };

    if (searchActive) {
      params.search = debouncedSearch;
    } else if (!savedView) {
      params.sort = 'random';
      params.seed = listSeed;
    }

    if (exerciseFilters.muscle) params.muscle = exerciseFilters.muscle;

    const filterCategories = exerciseFilters.categories;
    if (filterCategories.length === 1) {
      params.category = filterCategories[0];
    } else if (filterCategories.length > 1) {
      params.categories = filterCategories;
    }

    if (exerciseFilters.difficulty) params.difficulty = exerciseFilters.difficulty;

    if (exerciseFilters.goals.length) params.goals = exerciseFilters.goals;

    return params;
  }, [debouncedSearch, exerciseFilters, language, listSeed, savedView, searchActive, wikiMuscleFilter]);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (savedView && !user) {
        setExercises([]);
        setTotal(0);
        setHasMore(false);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }

      const gen = ++loadGen.current;
      if (pageNum === 1) {
        if (exercisesRef.current.length > 0) setRefreshing(true);
        else setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const res = savedView
        ? await exerciseService.listFavorites({
            ...listParams,
            page: pageNum,
          })
        : await exerciseService.list({
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
      setRefreshing(false);
      setLoadingMore(false);
    },
    [listParams, savedView, user],
  );

  useEffect(() => {
    setPage(1);
    void fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    if (skipResultsScrollRef.current) {
      skipResultsScrollRef.current = false;
      return;
    }
    // Only scroll when filters change — not while searching (user controls scroll).
    if (!filtersActive) return;
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [
    filtersActive,
    savedView,
    exerciseFilters.categories.join(','),
    exerciseFilters.difficulty ?? '',
    exerciseFilters.muscle ?? '',
    exerciseFilters.goals.join(','),
  ]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setPage(next);
    void fetchPage(next, true);
  };

  const retryLoad = useCallback(() => {
    setError(null);
    setPage(1);
    void fetchPage(1, false);
    void exerciseService.getBrowseMetadata({ force: true }).then((res) => {
      if (res.data) {
        setCategories(res.data.categories);
        setMuscleCounts(res.data.muscleCounts);
        setDifficulties(res.data.difficulties);
        setGoalCounts(res.data.goalCounts);
      }
    });
  }, [fetchPage]);

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
      requestPlanLogsView();
      navigate('/dashboard');
      return;
    }

    const res = await exerciseService.logExercise(selected.id);
    setLogging(false);
    if (res.error) {
      setLogToast(res.error);
    } else {
      setLogToast(t('exercises.logged', { name: resolveExerciseDisplayName(selected, language) }));
      requestPlanLogsView();
      setTimeout(() => setSelected(null), 900);
    }
    setTimeout(() => setLogToast(null), 3000);
  };

  const handleFavoriteLoginRequired = useCallback(() => {
    setLogToast(t('exercises.favoriteLoginRequired'));
    setTimeout(() => setLogToast(null), 2800);
  }, [t]);

  const handleFavoriteToggle = async (exerciseId: string, nextSaved: boolean) => {
    const ok = await toggleFavorite(exerciseId, nextSaved);
    if (ok) {
      if (!nextSaved && savedView) {
        setExercises((prev) => prev.filter((exercise) => exercise.id !== exerciseId));
        setTotal((count) => Math.max(0, count - 1));
      }
      setLogToast(t(nextSaved ? 'exercises.favoriteSaved' : 'exercises.favoriteRemoved'));
      setTimeout(() => setLogToast(null), 2500);
    }
  };

  const catalogTotal = useMemo(
    () => categories.reduce((sum, c) => sum + c.count, 0),
    [categories],
  );

  const countLocale = language === 'ar' ? 'ar' : 'en';
  const showResultsSummary = savedView || filtersActive || searchActive;

  return (
    <QuestionnaireGate flow="workout" questionnairePath="/onboarding/workout">
      <div className={`${WORKOUT_SHELL} relative`}>
        <div data-tour="workouts-hero">
          <ExerciseLibraryHero
            search={search}
            onSearchChange={setSearch}
            catalogTotal={catalogTotal}
            muscleZoneCount={EXERCISE_MUSCLE_BROWSE_ZONES.length}
            categoryCount={categories.length}
            loading={browseLoading}
            onRoutineLibraryOpen={() => setRoutineLibraryOpen(true)}
          />
        </div>

        {logToast && !selected && !routineLibraryOpen ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
            {logToast}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch scroll-mt-20 sm:scroll-mt-24">
          <ExerciseLibraryViewTabs
            view={libraryView}
            onChange={handleLibraryViewChange}
            savedCount={favoriteIds.size}
          />
          <div className="min-w-0 flex-1">
            <ExerciseFilterBar
              filters={exerciseFilters}
              onChange={handleExerciseFiltersChange}
              difficulties={difficulties}
              muscleCounts={muscleCounts}
              categoryCounts={categoryCounts}
              goalCounts={goalCounts}
              hideCounts={savedView}
            />
          </div>
        </div>

        {workoutAddContext ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl sm:rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-3 sm:px-4 sm:py-3">
            <p className="text-sm font-bold text-primary">{t('exercises.addingToWorkout')}</p>
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="text-xs sm:text-sm font-bold text-primary hover:underline"
              >
                {t('exercises.backToWorkout')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  clearWorkoutAddContext();
                  setWorkoutAddContextState(null);
                }}
                className="text-xs sm:text-sm font-semibold text-muted hover:text-foreground"
              >
                {t('nutrition.cancelMealAdd')}
              </button>
            </div>
          </div>
        ) : null}

        <section ref={resultsRef} className={`${WORKOUT_SECTION} space-y-4`} aria-live="polite" data-tour="workouts-browse">
          {showResultsSummary ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  {savedView
                    ? t('exercises.savedResults')
                    : filtersActive
                      ? t('exercises.filteredResults')
                      : t('exercises.search')}
                </h2>
                {!loading && !refreshing && total > 0 ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary tabular-nums">
                    {t('exercises.totalCount', { count: total.toLocaleString(countLocale) })}
                  </span>
                ) : null}
                {refreshing ? (
                  <span className="text-xs font-bold text-muted">{t('common.loading')}</span>
                ) : null}
              </div>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearExerciseFilters}
                  className="text-xs sm:text-sm font-bold text-primary hover:underline"
                >
                  {t('exercises.clearFilters')}
                </button>
              ) : null}
            </div>
          ) : !loading && total > 0 && !savedView ? (
            <p className="text-sm font-bold text-muted">
              {t('exercises.totalCount', { count: total.toLocaleString(countLocale) })}
            </p>
          ) : null}

          {savedView && !user ? <ExerciseSavedLoginPrompt /> : null}

          {loading && exercises.length === 0 && !(savedView && !user) && (
            <div className={`${WORKOUT_EXERCISE_GRID}`}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="min-h-[17rem] rounded-2xl sm:rounded-3xl bg-elevated/60 animate-pulse border border-subtle" />
              ))}
            </div>
          )}

          {error && (
            <motion.div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <p>{error}</p>
              <button
                type="button"
                onClick={retryLoad}
                className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20"
              >
                {t('exercises.retry')}
              </button>
            </motion.div>
          )}

          {!loading && !refreshing && !error && exercises.length === 0 && savedView && user ? (
            filtersActive || searchActive ? (
              <ExerciseEmptyState
                filters={exerciseFilters}
                searchActive={searchActive}
                onChangeFilters={handleExerciseFiltersChange}
                onClearSearch={() => setSearch('')}
              />
            ) : (
              <ExerciseSavedEmptyState />
            )
          ) : null}

          {!loading && !refreshing && !error && exercises.length === 0 && !savedView ? (
            <ExerciseEmptyState
              filters={exerciseFilters}
              searchActive={searchActive}
              onChangeFilters={setExerciseFilters}
              onClearSearch={() => setSearch('')}
            />
          ) : null}

          {exercises.length > 0 && (
            <motion.div
              variants={staggerContainer(0.05)}
              initial="hidden"
              animate="visible"
              className={`relative ${WORKOUT_EXERCISE_GRID} transition-opacity duration-200 ${refreshing ? 'opacity-50 pointer-events-none' : ''}`}
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
                  className="text-left glass-panel rounded-2xl sm:rounded-3xl overflow-hidden border border-subtle hover:border-primary/40 transition-all group flex flex-col h-full min-h-0"
                >
                  <div className="aspect-[4/3] relative bg-black/30 overflow-hidden shrink-0">
                    <ExerciseThumbnail
                      src={ex.thumbnailUrl || FALLBACK_IMG}
                      alt={ex.name}
                      priority="low"
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                    <motion.div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                    {ex.videoUrl && (
                      <span className="absolute bottom-3 right-3 size-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-lg">play_arrow</span>
                      </span>
                    )}
                    <span className="absolute top-2.5 start-2.5 sm:top-3 sm:start-3 text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
                      {formatCategoryLabel(ex.category, t)}
                    </span>
                    <ExerciseFavoriteButton
                      exerciseId={ex.id}
                      saved={isFavorite(ex.id)}
                      loading={isToggling(ex.id)}
                      compact
                      className="absolute top-2.5 end-2.5 sm:top-3 sm:end-3 z-10"
                      onToggle={handleFavoriteToggle}
                      onLoginRequired={handleFavoriteLoginRequired}
                    />
                  </div>
                  <div className="p-3.5 sm:p-4 flex flex-col flex-1 gap-1.5 sm:gap-2 min-w-0">
                    <h3 className="font-black text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {resolveExerciseDisplayName(ex, language)}
                    </h3>
                    <p className="text-xs text-muted font-semibold leading-snug line-clamp-2">
                      {ex.primaryMuscles.slice(0, 2).map((m) => localizeMuscleLabel(m, language)).join(' · ')}
                      {ex.difficulty ? ` · ${localizeDifficultyLabel(ex.difficulty, language)}` : ''}
                    </p>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
            {refreshing ? (
              <div className="absolute inset-0 flex items-start justify-center pt-16">
                <span className="rounded-full bg-surface/90 border border-subtle px-4 py-2 text-xs font-black text-muted shadow-lg">
                  {t('common.loading')}
                </span>
              </div>
            ) : null}
          </motion.div>
          )}

          {hasMore && !loading && !refreshing && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 sm:px-8 py-3 min-h-11 rounded-xl sm:rounded-2xl bg-elevated border border-subtle font-bold text-sm disabled:opacity-50"
              >
                {loadingMore ? t('common.loading') : t('exercises.loadMore')}
              </button>
            </div>
          )}
        </section>

        <AnimatePresence>
          {routineLibraryOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6 safe-bottom"
              onClick={() => setRoutineLibraryOpen(false)}
            >
              <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 24, opacity: 0, scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-panel w-full max-w-4xl max-h-[min(92dvh,820px)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-subtle p-4 sm:p-6 custom-scrollbar"
                role="dialog"
                aria-modal="true"
                aria-labelledby="routine-library-title"
              >
                {logToast ? (
                  <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                    {logToast}
                  </div>
                ) : null}
                <Suspense
                  fallback={
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-40 rounded-2xl bg-elevated/60 animate-pulse border border-subtle" />
                      ))}
                    </div>
                  }
                >
                  <RoutineLibraryPanel
                    onClose={() => setRoutineLibraryOpen(false)}
                    onMessage={(message) => {
                      setLogToast(message);
                      setTimeout(() => setLogToast(null), 3000);
                    }}
                  />
                </Suspense>
              </motion.div>
            </motion.div>
          )}
          {selected && (
            <Suspense fallback={null}>
              <ExerciseDetailModal
              exercise={selected}
              onClose={() => setSelected(null)}
              onLog={handleLog}
              logging={logging}
              logToast={logToast}
              saved={isFavorite(selected.id)}
              favoriteLoading={isToggling(selected.id)}
              onToggleFavorite={handleFavoriteToggle}
              onLoginRequired={handleFavoriteLoginRequired}
            />
            </Suspense>
          )}
        </AnimatePresence>
      </div>
    </QuestionnaireGate>
  );
};
