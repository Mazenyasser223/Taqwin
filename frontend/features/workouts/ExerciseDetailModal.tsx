import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { buttonPress } from '../../lib/motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { Exercise } from '../../types';
import { formatCategoryLabel } from './exerciseCategories';
import { localizeDifficultyLabel, localizeMuscleLabel, resolveExerciseDisplayName } from './exerciseLocale';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

type Props = {
  exercise: Exercise;
  onClose: () => void;
  onLog?: () => void;
  logging?: boolean;
  logToast?: string | null;
};

export function ExerciseDetailModal({ exercise, onClose, onLog, logging, logToast }: Props) {
  const { t, language } = useI18n();
  const displayName = resolveExerciseDisplayName(exercise, language);
  const showLogActions = Boolean(onLog);

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
        className="glass-panel w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-subtle"
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
            <img
              src={exercise.thumbnailUrl || FALLBACK_IMG}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          )}
        </motion.div>
        <motion.div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl sm:text-2xl font-black">{displayName}</h3>
              <p className="text-xs uppercase tracking-widest text-primary font-bold mt-1">
                {formatCategoryLabel(exercise.category, t)}
                {exercise.difficulty ? ` · ${localizeDifficultyLabel(exercise.difficulty, language)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {exercise.primaryMuscles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {exercise.primaryMuscles.map((m) => (
                <span
                  key={m}
                  className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {localizeMuscleLabel(m, language)}
                </span>
              ))}
            </div>
          )}

          {exercise.longDescription && (
            <p className="text-sm text-muted leading-relaxed">{exercise.longDescription}</p>
          )}

          {exercise.steps.length > 0 && (
            <ol className="space-y-2 text-sm text-muted list-decimal list-inside">
              {exercise.steps.map((step, i) => (
                <li key={i} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          )}

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
