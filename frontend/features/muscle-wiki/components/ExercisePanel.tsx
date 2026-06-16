import { useEffect, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { Link } from 'react-router-dom';
import exerciseService from '../../../services/exerciseService';
import type { Exercise } from '../../../types';
import { MUSCLE_BADGE_COLORS, MUSCLE_EXERCISES } from '../muscleExercises';
import { REGION_BADGE_COLORS, muscleRegionKey } from '../muscleRegions';
import { countForRegion } from '../useMuscleExerciseCounts';
import type { MuscleRegion } from '../types';
import { formatCategoryLabel } from '../../workouts/exerciseCategories';
import {
  localizeDifficultyLabel,
  localizeMuscleLabel,
  resolveExerciseDisplayName,
} from '../../workouts/exerciseLocale';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

export interface ExercisePanelProps {
  selectedMuscle: MuscleRegion | null;
  hoveredMuscle?: MuscleRegion | null;
  muscleCounts?: Record<string, number> | null;
}

function countForZone(region: MuscleRegion, muscleCounts?: Record<string, number> | null) {
  const fromApi = countForRegion(region, muscleCounts);
  if (fromApi != null) return fromApi;
  if (region in MUSCLE_EXERCISES) return MUSCLE_EXERCISES[region as keyof typeof MUSCLE_EXERCISES].length;
  return 0;
}

function badgeClassFor(region: MuscleRegion) {
  return REGION_BADGE_COLORS[region] ?? MUSCLE_BADGE_COLORS[region as keyof typeof MUSCLE_BADGE_COLORS] ?? MUSCLE_BADGE_COLORS.chest;
}

function labelKeyFor(region: MuscleRegion) {
  return muscleRegionKey(region);
}

export function ExercisePanel({
  selectedMuscle,
  hoveredMuscle = null,
  muscleCounts = null,
}: ExercisePanelProps) {
  const { t, language } = useI18n();
  const previewMuscle = !selectedMuscle ? hoveredMuscle : null;
  const hoverPreview =
    hoveredMuscle && selectedMuscle && hoveredMuscle !== selectedMuscle ? hoveredMuscle : null;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMuscle) {
      setExercises([]);
      setExpandedId(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    exerciseService
      .list({ muscle: selectedMuscle, pageSize: 12, locale: language, set: 'wiki' })
      .then((res) => {
        if (!mounted) return;
        if (res.error) setError(res.error);
        else setExercises(res.data?.items ?? []);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedMuscle, language]);

  if (!selectedMuscle && !previewMuscle) {
    return (
      <div className="flex h-full min-h-[240px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center backdrop-blur-xl sm:min-h-[280px] sm:p-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-400/30">
          <svg
            className="h-7 w-7 text-cyan-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">{t('muscleWiki.clickPrompt')}</h2>
      </div>
    );
  }

  if (previewMuscle) {
    const label = t(labelKeyFor(previewMuscle));
    const badgeClass = badgeClassFor(previewMuscle);
    const count = countForZone(previewMuscle, muscleCounts);

    return (
      <div className="flex h-full min-h-[240px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/25 bg-cyan-500/5 p-6 text-center backdrop-blur-xl ring-1 ring-cyan-400/20 sm:min-h-[280px] sm:p-8">
        <span
          className={`mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${badgeClass}`}
        >
          {label}
        </span>
        <h2 className="text-lg font-semibold text-white">{t('muscleWiki.hoverPreview')}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {t('muscleWiki.exercisesReady', { count: String(count) })}
        </p>
      </div>
    );
  }

  const label = t(labelKeyFor(selectedMuscle!));
  const badgeClass = badgeClassFor(selectedMuscle!);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6 md:p-6 xl:p-8">
      {hoverPreview && (
        <div className="mb-4 shrink-0 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-200/90">
          {t('muscleWiki.hovering')}:{' '}
          <span className="font-semibold">{t(labelKeyFor(hoverPreview))}</span>
        </div>
      )}
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${badgeClass}`}
        >
          {label}
        </span>
        <span className="text-sm text-slate-400">{t('muscleWiki.recommended')}</span>
        <Link
          to="/workouts"
          className="ms-auto text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
        >
          {t('exercises.browseAll')}
        </Link>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400 animate-pulse">
          {t('common.loading')}
        </div>
      )}

      {error && (
        <div className="shrink-0 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && exercises.length === 0 && (
        <p className="shrink-0 text-sm text-slate-400">{t('exercises.empty')}</p>
      )}

      {!loading && !error && exercises.length > 0 && (
        <ul className="muscle-wiki-exercise-list min-h-0 flex-1 list-none space-y-3 overflow-y-auto overscroll-contain pr-1">
          {exercises.map((exercise) => {
            const title = resolveExerciseDisplayName(exercise, language);
            const open = expandedId === exercise.id;
            return (
              <li
                key={exercise.id}
                className="shrink-0 rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/80 shadow-lg shadow-black/20 overflow-hidden"
              >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : exercise.id)}
                className="w-full p-4 text-left group transition"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={exercise.thumbnailUrl || FALLBACK_IMG}
                    alt=""
                    className="size-14 rounded-lg object-cover shrink-0 bg-black/40"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white group-hover:text-cyan-100 line-clamp-2">
                        {title}
                      </h3>
                      <span className="material-symbols-outlined text-slate-500 text-lg shrink-0">
                        {open ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                      {formatCategoryLabel(exercise.category, t)}
                      {exercise.difficulty ? ` · ${localizeDifficultyLabel(exercise.difficulty, language)}` : ''}
                    </p>
                  </div>
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                  {exercise.videoUrl && (
                    <video
                      src={exercise.videoUrl}
                      poster={exercise.thumbnailUrl || undefined}
                      controls
                      playsInline
                      className="w-full rounded-lg bg-black/50 max-h-48"
                    />
                  )}
                  {exercise.steps.slice(0, 3).map((step, i) => (
                    <p key={i} className="text-xs text-slate-400 leading-relaxed">
                      {i + 1}. {step}
                    </p>
                  ))}
                  <Link
                    to="/workouts"
                    className="inline-block text-xs font-bold uppercase tracking-wider text-cyan-400"
                  >
                    {t('muscleWiki.view')}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
        </ul>
      )}
    </div>
  );
}
