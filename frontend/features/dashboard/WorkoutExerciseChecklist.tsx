import { LogWorkoutView } from './LogWorkoutView';
import type { TodayWorkoutExercise } from '../../services/exerciseService';

export function WorkoutExerciseChecklist({
  workoutPlan,
  plannedExercises,
  date,
  todayKey,
  dayLabel,
  isRestDay,
  userId,
  onRefresh,
}: {
  workoutPlan: { title: string; durationMin: number; hasLoggedToday: boolean };
  plannedExercises: TodayWorkoutExercise[];
  date: string;
  todayKey: string;
  dayLabel?: string;
  isRestDay?: boolean;
  userId?: string;
  onRefresh?: () => Promise<void>;
}) {
  return (
    <LogWorkoutView
      workoutPlan={workoutPlan}
      plannedExercises={plannedExercises}
      date={date}
      todayKey={todayKey}
      dayLabel={dayLabel}
      isRestDay={isRestDay}
      userId={userId}
      onRefresh={onRefresh}
    />
  );
}

export type { WorkoutEditEntry } from './WorkoutExerciseChecklist.types';
