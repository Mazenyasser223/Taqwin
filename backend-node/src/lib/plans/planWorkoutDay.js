/**
 * Shared workout-day rest/training inference (persist + API + dashboard).
 */

const FOCUS_DEFAULT_EXERCISE = {
  legs: 'Goblet Squat',
  push: 'Dumbbell Chest Press',
  pull: 'Dumbbell Row',
  core: 'Plank',
  full: 'Goblet Squat',
};

/**
 * Empty Postgres day (no focus, no exercises) — not an intentional rest day.
 * @param {{ focus?: string|null, type?: string|null, exercises?: Array<unknown> }} day
 */
function isScaffoldWorkoutDay(day) {
  if (!day) return true;
  if ((day.exercises || []).length > 0) return false;
  const focus = String(day.focus ?? day.type ?? '')
    .toLowerCase()
    .trim();
  return !focus;
}

/**
 * @param {{ isRestDay?: boolean, isRest?: boolean, focus?: string|null, type?: string|null, exercises?: Array<unknown> }} day
 * @param {{ legacyFallback?: boolean }} [opts]
 */
function resolveIsRestWorkoutDay(day, opts) {
  if (!day || isScaffoldWorkoutDay(day)) {
    return opts?.legacyFallback ?? false;
  }
  return inferIsRestWorkoutDay(day);
}

/**
 * @param {{ isRestDay?: boolean, isRest?: boolean, focus?: string|null, type?: string|null, exercises?: Array<{ exerciseId?: string|null, exercise?: { id?: string } }> }} day
 */
function inferIsRestWorkoutDay(day) {
  if (!day) return true;
  const linked = (day.exercises || []).some((e) => e.exerciseId || e.exercise?.id);
  if (linked) return false;

  const focus = String(day.focus || day.type || '')
    .toLowerCase()
    .trim();
  if (focus && focus !== 'rest') return false;

  return Boolean(day.isRestDay ?? day.isRest);
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {Array<{ exerciseId?: string|null, name?: string, sets?: number, reps?: number|string, restSec?: number, notes?: string }>} rawExercises
 */
async function resolveExercisesForPersist(tx, rawExercises) {
  const rows = [];
  for (let idx = 0; idx < (rawExercises || []).length; idx += 1) {
    const e = rawExercises[idx];
    let exerciseId = e.exerciseId || null;
    const name = String(e.name || e.notes || '').trim();

    if (!exerciseId && name) {
      const exact = await tx.exercise.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      exerciseId = exact?.id ?? null;
      if (!exerciseId) {
        const token = name.split(/\s+/)[0];
        if (token.length >= 3) {
          const fuzzy = await tx.exercise.findFirst({
            where: { name: { contains: token, mode: 'insensitive' } },
            select: { id: true },
          });
          exerciseId = fuzzy?.id ?? null;
        }
      }
    }

    if (!exerciseId) continue;

    rows.push({
      exerciseId,
      sortOrder: rows.length,
      sets: e.sets ?? 3,
      reps: String(e.reps ?? 10),
      restSec: e.restSec ?? 90,
      notes: e.notes || name || null,
    });
  }
  return rows;
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ focus?: string|null, type?: string|null, isRest?: boolean }} day
 */
async function defaultExerciseRowForFocus(tx, day) {
  const focus = String(day.focus || day.type || '')
    .toLowerCase()
    .trim();
  if (!focus || focus === 'rest' || day.isRest) return null;

  const targetName = FOCUS_DEFAULT_EXERCISE[focus] || FOCUS_DEFAULT_EXERCISE.full;
  const found = await tx.exercise.findFirst({
    where: { name: { contains: targetName.split(' ')[0], mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!found) return null;

  return {
    exerciseId: found.id,
    sortOrder: 0,
    sets: 3,
    reps: focus === 'core' ? '1' : '12',
    restSec: focus === 'core' ? 60 : 90,
    notes: found.name,
  };
}

module.exports = {
  isScaffoldWorkoutDay,
  resolveIsRestWorkoutDay,
  inferIsRestWorkoutDay,
  resolveExercisesForPersist,
  defaultExerciseRowForFocus,
  FOCUS_DEFAULT_EXERCISE,
};
