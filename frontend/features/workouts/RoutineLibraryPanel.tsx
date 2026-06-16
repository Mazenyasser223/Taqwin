import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import plansService, {
  type RoutineAdvice,
  type RoutineApplyMode,
  type SavedWorkoutRoutine,
} from '../../services/plansService';

type Props = {
  onMessage: (message: string) => void;
  className?: string;
  onClose?: () => void;
};

const APPLY_MODES: RoutineApplyMode[] = ['append', 'replace'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function RoutineCardSkeleton() {
  return (
    <div className="rounded-2xl border border-subtle bg-elevated/40 p-4 animate-pulse space-y-3">
      <div className="h-5 w-2/3 rounded-lg bg-elevated" />
      <div className="h-4 w-1/3 rounded-lg bg-elevated" />
      <div className="space-y-2 pt-1">
        <div className="h-3 w-full rounded bg-elevated" />
        <div className="h-3 w-5/6 rounded bg-elevated" />
        <div className="h-3 w-4/6 rounded bg-elevated" />
      </div>
      <div className="flex gap-2 pt-2">
        <div className="h-10 flex-1 rounded-xl bg-elevated" />
        <div className="h-10 flex-1 rounded-xl bg-elevated" />
      </div>
    </div>
  );
}

export const RoutineLibraryPanel: React.FC<Props> = ({ onMessage, className, onClose }) => {
  const { t } = useI18n();
  const [routines, setRoutines] = useState<SavedWorkoutRoutine[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [advisingId, setAdvisingId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(todayIso);
  const [mode, setMode] = useState<RoutineApplyMode>('append');
  const [advice, setAdvice] = useState<Record<string, RoutineAdvice>>({});

  const modeLabel = (value: RoutineApplyMode) =>
    t(value === 'append' ? 'routines.mode.append' : 'routines.mode.replace');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await plansService.getRoutines();
    if (res.data) setRoutines(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const askAdvice = async (routine: SavedWorkoutRoutine) => {
    setAdvisingId(routine.id);
    const res = await plansService.getRoutineAdvice(routine.id, targetDate);
    setAdvisingId(null);
    if (res.error || !res.data) {
      onMessage(res.error || t('routines.errorAdvice'));
      return;
    }
    setAdvice((prev) => ({ ...prev, [routine.id]: res.data! }));
    setMode(res.data.recommendMode);
  };

  const applyRoutine = async (routine: SavedWorkoutRoutine) => {
    setApplyingId(routine.id);
    const res = await plansService.applyRoutine(routine.id, { date: targetDate, mode });
    setApplyingId(null);
    if (res.error || !res.data) {
      onMessage(res.error || t('routines.errorApply'));
      return;
    }
    if (res.data.added === 0) {
      onMessage(t('routines.appliedNone', { name: routine.name }));
      return;
    }
    let message = t('routines.appliedSuccess', {
      name: routine.name,
      added: String(res.data.added),
    });
    if (res.data.duplicateExerciseIds.length) {
      message += ` — ${t('routines.duplicatesSkipped', {
        count: String(res.data.duplicateExerciseIds.length),
      })}`;
    }
    onMessage(message);
  };

  return (
    <section className={className ?? 'space-y-5'}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[22px]">bookmark_added</span>
          </div>
          <div className="min-w-0">
            <h2 id="routine-library-title" className="text-xl sm:text-2xl font-black leading-tight text-foreground">
              {t('routines.title')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t('routines.subtitle')}</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="size-10 shrink-0 rounded-xl bg-elevated border border-subtle flex items-center justify-center"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
      </header>

      <div className="rounded-xl sm:rounded-2xl border border-subtle bg-elevated/40 p-3.5 sm:p-4 lg:p-5 space-y-3 sm:space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('routines.applySettings')}</p>
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">{t('routines.targetDate')}</span>
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="w-full rounded-xl border border-subtle bg-background px-3 py-2.5 text-sm font-medium text-foreground"
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-foreground">{t('routines.applyMode')}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {APPLY_MODES.map((value) => {
                const selected = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={selected}
                    className={`rounded-xl border px-3 py-3 text-start transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-subtle bg-background hover:bg-elevated/80'
                    }`}
                  >
                    <span className={`block text-sm font-bold ${selected ? 'text-primary' : 'text-foreground'}`}>
                      {modeLabel(value)}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {t(value === 'append' ? 'routines.mode.appendHint' : 'routines.mode.replaceHint')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-subtle bg-background/60 px-4 py-3">
            <span
              aria-hidden
              className="inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
            />
            <p className="text-sm font-medium text-foreground">{t('routines.loading')}</p>
          </div>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
            <RoutineCardSkeleton />
            <RoutineCardSkeleton />
          </div>
        </div>
      ) : null}

      {!loading && routines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-subtle bg-background/50 px-5 py-8 text-center">
          <span className="material-symbols-outlined mb-3 text-4xl text-muted">fitness_center</span>
          <p className="text-sm leading-relaxed text-muted">{t('routines.empty')}</p>
        </div>
      ) : null}

      {!loading && routines.length > 0 ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
          {routines.map((routine) => {
            const routineAdvice = advice[routine.id];
            const isApplying = applyingId === routine.id;
            const isAdvising = advisingId === routine.id;
            return (
              <article
                key={routine.id}
                className="flex flex-col rounded-2xl border border-subtle bg-background/80 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-foreground">{routine.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {routine.focus || t('routines.workoutDay')} ·{' '}
                      {t('routines.exerciseCount', { count: String(routine.exerciseCount) })}
                    </p>
                  </div>
                  <span className="material-symbols-outlined shrink-0 text-primary">event_repeat</span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {routine.exercises.slice(0, 4).map((exercise, index) => (
                    <li key={exercise.id} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-elevated text-[11px] font-bold text-muted">
                        {index + 1}
                      </span>
                      <span className="leading-snug">{exercise.name}</span>
                    </li>
                  ))}
                  {routine.exercises.length > 4 ? (
                    <li className="ps-7 text-sm font-medium text-muted">
                      {t('routines.moreExercises', { count: String(routine.exercises.length - 4) })}
                    </li>
                  ) : null}
                </ul>

                {routineAdvice ? (
                  <p className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm leading-relaxed text-primary">
                    {t('routines.advice', {
                      mode:
                        routineAdvice.recommendMode === 'append'
                          ? t('routines.adviceMode.append')
                          : t('routines.adviceMode.replace'),
                      reason: routineAdvice.reason,
                    })}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isAdvising}
                    onClick={() => void askAdvice(routine)}
                    className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border border-primary/30 px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                    {isAdvising ? t('routines.loading') : t('routines.askAdvice')}
                  </button>
                  <button
                    type="button"
                    disabled={isApplying}
                    onClick={() => void applyRoutine(routine)}
                    className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    {isApplying ? t('routines.applying') : t('routines.apply')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
