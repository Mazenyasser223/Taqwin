import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { buttonPress } from '../../lib/motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { Exercise } from '../../types';
import { formatCategoryLabel } from './exerciseCategories';
import { ExerciseFavoriteButton } from './ExerciseFavoriteButton';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import {
  localizeDifficultyLabel,
  localizeMuscleLabel,
  exerciseDetailContentIsEnglishOnly,
  parseExerciseSteps,
  resolveExerciseDisplayName,
} from './exerciseLocale';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=800&fm=webp';

type Props = {
  exercise: Exercise;
  onClose: () => void;
  onLog?: () => void;
  logging?: boolean;
  logToast?: string | null;
  saved?: boolean;
  favoriteLoading?: boolean;
  onToggleFavorite?: (exerciseId: string, nextSaved: boolean) => void | Promise<void>;
  onLoginRequired?: () => void;
};

export function ExerciseDetailModal({
  exercise,
  onClose,
  onLog,
  logging,
  logToast,
  saved = false,
  favoriteLoading = false,
  onToggleFavorite,
  onLoginRequired,
}: Props) {
  const { t, language } = useI18n();
  const displayName = resolveExerciseDisplayName(exercise, language);
  const showLogActions = Boolean(onLog);
  const parsedSteps = useMemo(() => parseExerciseSteps(exercise.steps), [exercise.steps]);
  const englishOnlyContent = exerciseDetailContentIsEnglishOnly(exercise, language);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 safe-bottom"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-[min(100%,42rem)] lg:max-w-3xl max-h-[min(92dvh,900px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-subtle custom-scrollbar"
      >
        <motion.div className="relative aspect-video bg-black/50">
          {exercise.videoUrl ? (
            <video
              key={exercise.videoUrl}
              src={exercise.videoUrl}
              poster={exercise.thumbnailUrl || undefined}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <ExerciseThumbnail
              src={exercise.thumbnailUrl || FALLBACK_IMG}
              alt={displayName}
              priority="high"
              className="w-full h-full object-cover"
            />
          )}
        </motion.div>
        <motion.div className="p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-black leading-tight text-foreground">
                {displayName}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground px-3 py-1.5 rounded-lg bg-elevated border border-subtle">
                  {formatCategoryLabel(exercise.category, t)}
                </span>
                {exercise.difficulty ? (
                  <span className="text-sm font-semibold text-primary px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                    {localizeDifficultyLabel(exercise.difficulty, language)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onToggleFavorite ? (
                <ExerciseFavoriteButton
                  exerciseId={exercise.id}
                  saved={saved}
                  loading={favoriteLoading}
                  onToggle={onToggleFavorite}
                  onLoginRequired={onLoginRequired}
                />
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="size-10 shrink-0 rounded-xl bg-elevated border border-subtle flex items-center justify-center"
                aria-label={t('common.close')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {exercise.primaryMuscles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {exercise.primaryMuscles.map((m) => (
                <span
                  key={m}
                  className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {localizeMuscleLabel(m, language)}
                </span>
              ))}
            </div>
          )}

          {englishOnlyContent ? (
            <p className="rounded-xl border border-subtle bg-elevated/60 px-3.5 py-2.5 text-xs sm:text-sm text-muted leading-relaxed">
              {t('exercises.contentEnglishOnly')}
            </p>
          ) : null}

          {exercise.longDescription ? (
            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
                {t('exercises.overview')}
              </h4>
              <p className="text-base text-foreground leading-relaxed">{exercise.longDescription}</p>
            </section>
          ) : null}

          {parsedSteps.length > 0 ? (
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
                {t('exercises.instructions')}
              </h4>
              <ol className="space-y-3">
                {parsedSteps.map((step) => (
                  <li
                    key={`${step.number}-${step.text.slice(0, 24)}`}
                    className="flex gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-subtle bg-elevated/70 p-3.5 sm:p-4"
                  >
                    <span
                      aria-hidden
                      className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs sm:text-sm font-black text-white"
                    >
                      {step.number}
                    </span>
                    <p className="flex-1 pt-0.5 text-sm sm:text-base leading-relaxed text-foreground">{step.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {logToast && (
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-sm">
              {logToast}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/muscle-wiki"
              className="flex-1 text-center py-3 rounded-xl border border-subtle font-bold text-muted hover:bg-elevated"
            >
              {t('exercises.openMuscleWiki')}
            </Link>
            {showLogActions ? (
              <motion.button
                variants={buttonPress}
                whileTap="tap"
                type="button"
                onClick={onLog}
                disabled={logging}
                className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {logging ? t('exercises.logging') : t('exercises.logExercise')}
              </motion.button>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
