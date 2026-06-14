import React, { useCallback, useEffect, useState } from 'react';
import plansService, {
  type RoutineAdvice,
  type RoutineApplyMode,
  type SavedWorkoutRoutine,
} from '../../services/plansService';

type Props = {
  onMessage: (message: string) => void;
  className?: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const RoutineLibraryPanel: React.FC<Props> = ({ onMessage, className }) => {
  const [routines, setRoutines] = useState<SavedWorkoutRoutine[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(todayIso);
  const [mode, setMode] = useState<RoutineApplyMode>('append');
  const [advice, setAdvice] = useState<Record<string, RoutineAdvice>>({});

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
    const res = await plansService.getRoutineAdvice(routine.id, targetDate);
    if (res.error || !res.data) {
      onMessage(res.error || 'Could not get routine advice');
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
      onMessage(res.error || 'Could not apply routine');
      return;
    }
    onMessage(
      res.data.added === 0
        ? `No new exercises added — everything in "${routine.name}" is already on this day.`
        : `Applied ${routine.name}: ${res.data.added} exercises added${
            res.data.duplicateExerciseIds.length
              ? `, ${res.data.duplicateExerciseIds.length} duplicates skipped`
              : ''
          }`
    );
  };

  return (
    <section className={className ?? 'mt-6 rounded-3xl border border-subtle bg-surface/70 p-5 shadow-sm'}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Routine library</p>
          <h2 id="routine-library-title" className="text-xl font-black text-foreground">Saved workout days</h2>
          <p className="mt-1 text-sm font-medium text-muted">Apply a saved day wherever it fits.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="rounded-xl border border-subtle bg-background px-3 py-2 text-sm"
          />
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as RoutineApplyMode)}
            className="rounded-xl border border-subtle bg-background px-3 py-2 text-sm font-bold"
          >
            <option value="append">Append</option>
            <option value="replace">Replace</option>
          </select>
        </div>
      </div>

      {loading ? <p className="mt-4 text-sm font-bold text-muted">Loading routines...</p> : null}
      {!loading && routines.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-subtle p-4 text-sm font-bold text-muted">
          Save a workout day from the dashboard to build your routine library.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {routines.map((routine) => {
          const routineAdvice = advice[routine.id];
          return (
            <article key={routine.id} className="rounded-2xl border border-subtle bg-background/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-foreground">{routine.name}</h3>
                  <p className="mt-1 text-xs font-bold text-muted">
                    {routine.focus || 'Workout day'} · {routine.exerciseCount} exercises
                  </p>
                </div>
                <span className="material-symbols-outlined text-primary">event_repeat</span>
              </div>
              <ul className="mt-3 space-y-1 text-xs font-semibold text-muted">
                {routine.exercises.slice(0, 4).map((exercise) => (
                  <li key={exercise.id}>• {exercise.name}</li>
                ))}
                {routine.exercises.length > 4 ? <li>+ {routine.exercises.length - 4} more</li> : null}
              </ul>
              {routineAdvice ? (
                <p className="mt-3 rounded-xl bg-primary/10 p-3 text-xs font-bold text-primary">
                  Advice: use {routineAdvice.recommendMode}. {routineAdvice.reason}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void askAdvice(routine)}
                  className="rounded-xl border border-primary/30 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary"
                >
                  Ask AI advice
                </button>
                <button
                  type="button"
                  disabled={applyingId === routine.id}
                  onClick={() => void applyRoutine(routine)}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {applyingId === routine.id ? 'Applying...' : `Apply (${mode})`}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
