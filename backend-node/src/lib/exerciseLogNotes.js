function parseSetDetails(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.map((row) => ({
    kg: row?.kg != null && Number.isFinite(Number(row.kg)) ? Number(row.kg) : null,
    reps: row?.reps != null && Number.isFinite(Number(row.reps)) ? Math.round(Number(row.reps)) : null,
    completed: Boolean(row?.completed),
  }));
}

function aggregateFromSetDetails(setDetails) {
  const completed = setDetails.filter((s) => s.completed && s.reps != null);
  const sets = setDetails.length || completed.length || 1;
  const reps =
    completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + (s.reps ?? 0), 0) / completed.length)
      : setDetails[0]?.reps ?? 10;
  return {
    sets: Math.max(1, Math.min(50, sets)),
    reps: Math.max(1, Math.min(500, reps)),
  };
}

function parseExerciseLogNotes(notes) {
  const fallback = { sets: 3, reps: 10, setDetails: null, userNotes: '', durationSec: 0 };
  if (!notes) return fallback;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed.sets === 'number' && typeof parsed.reps === 'number') {
      const setDetails = parseSetDetails(parsed.setDetails);
      const agg = setDetails?.length ? aggregateFromSetDetails(setDetails) : { sets: parsed.sets, reps: parsed.reps };
      return {
        sets: Math.max(1, Math.min(50, Math.round(agg.sets))),
        reps: Math.max(1, Math.min(500, Math.round(agg.reps))),
        setDetails,
        userNotes: typeof parsed.userNotes === 'string' ? parsed.userNotes : '',
        durationSec: typeof parsed.durationSec === 'number' ? Math.max(0, Math.round(parsed.durationSec)) : 0,
      };
    }
  } catch {
    /* plain text notes */
  }
  return fallback;
}

function encodeExerciseLogNotes({ sets, reps, setDetails, userNotes, durationSec }) {
  const payload = {
    sets: Math.max(1, Math.min(50, Math.round(sets))),
    reps: Math.max(1, Math.min(500, Math.round(reps))),
    v: setDetails?.length ? 2 : 1,
  };
  if (setDetails?.length) payload.setDetails = setDetails;
  if (userNotes) payload.userNotes = String(userNotes).slice(0, 1000);
  if (durationSec != null) payload.durationSec = Math.max(0, Math.round(durationSec));
  return JSON.stringify(payload);
}

function formatPreviousLabel(setDetails) {
  if (!setDetails?.length) return null;
  const last = [...setDetails].reverse().find((s) => s.completed && s.kg != null && s.reps != null);
  if (!last) return null;
  return `${last.kg}kg x ${last.reps}`;
}

function sumPlannedSets(plannedExercises = []) {
  return plannedExercises.reduce(
    (sum, ex) => sum + Math.max(1, Math.round(ex.sets ?? 3)),
    0
  );
}

/** Count explicitly checked sets vs total set rows in the logged session (or plan when nothing logged yet). */
function countWorkoutSetCompletion(exerciseLogs, plannedExercises = []) {
  let completedSets = 0;
  let loggedSetRows = 0;

  for (const log of exerciseLogs) {
    const parsed = parseExerciseLogNotes(log.notes);
    if (parsed.setDetails?.length) {
      loggedSetRows += parsed.setDetails.length;
      completedSets += parsed.setDetails.filter((s) => s.completed).length;
    } else {
      const sets = Math.max(1, parsed.sets || 1);
      loggedSetRows += sets;
      completedSets += sets;
    }
  }

  const totalSets = loggedSetRows > 0 ? loggedSetRows : sumPlannedSets(plannedExercises);
  return { completedSets, totalSets };
}

/** Share of planned/logged sets explicitly marked completed (0–100). */
function computeWorkoutSetCompletionPct(exerciseLogs, plannedExercises = []) {
  const { completedSets, totalSets } = countWorkoutSetCompletion(exerciseLogs, plannedExercises);
  if (totalSets <= 0) return 0;
  return Math.min(100, Math.round((completedSets / totalSets) * 100));
}

/** Week completion = total checked sets ÷ total sets across the week (incl. missed sessions). */
function computeWeekWorkoutCompletionPct(exerciseLogs, plannedExercises = [], plannedTrainingDays = 4) {
  const byDay = new Map();
  for (const log of exerciseLogs) {
    const key = new Date(log.loggedAt).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(log);
  }

  let completedSets = 0;
  let totalSets = 0;

  for (const logs of byDay.values()) {
    const day = countWorkoutSetCompletion(logs, plannedExercises);
    completedSets += day.completedSets;
    totalSets += day.totalSets;
  }

  const avgSetsPerSession =
    byDay.size > 0 ? Math.round(totalSets / byDay.size) : sumPlannedSets(plannedExercises);
  const missingSessions = Math.max(0, plannedTrainingDays - byDay.size);
  totalSets += missingSessions * avgSetsPerSession;

  if (totalSets <= 0) return 0;
  return Math.min(100, Math.round((completedSets / totalSets) * 100));
}

module.exports = {
  parseExerciseLogNotes,
  encodeExerciseLogNotes,
  formatPreviousLabel,
  aggregateFromSetDetails,
  computeWorkoutSetCompletionPct,
  computeWeekWorkoutCompletionPct,
  countWorkoutSetCompletion,
  sumPlannedSets,
};
