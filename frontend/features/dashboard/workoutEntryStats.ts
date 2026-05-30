export function sumExerciseStats(
  entries: Array<{ sets: number; reps: number }>
): { sets: number; reps: number; volume: number } {
  return entries.reduce<{ sets: number; reps: number; volume: number }>(
    (acc, entry) => {
      acc.sets += entry.sets;
      acc.reps += entry.reps * entry.sets;
      acc.volume += entry.sets * entry.reps;
      return acc;
    },
    { sets: 0, reps: 0, volume: 0 }
  );
}
