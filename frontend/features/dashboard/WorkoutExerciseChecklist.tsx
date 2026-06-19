import { LogWorkoutView } from './LogWorkoutView';
import type { PlanViewMode } from './PlanViewModeToggle';
import type { TodayWorkoutExercise } from '../../services/exerciseService';

export function WorkoutExerciseChecklist({
  workoutPlan,
  plannedExercises,
  date,
  todayKey,
  dayLabel,
  isRestDay,
  userId,
  viewMode,
  onRequestViewMode,
  onRefresh,
}: {
  workoutPlan: { title: string; durationMin: number; hasLoggedToday: boolean };
  plannedExercises: TodayWorkoutExercise[];
  date: string;
  todayKey: string;
  dayLabel?: string;
  isRestDay?: boolean;
  userId?: string;
  viewMode?: PlanViewMode;
  onRequestViewMode?: (mode: PlanViewMode) => void;
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
      viewMode={viewMode}
      onRequestViewMode={onRequestViewMode}
      onRefresh={onRefresh}
    />
  );
}

export type { WorkoutEditEntry } from './WorkoutExerciseChecklist.types';
