import {
  MUSCLE_BADGE_COLORS,
  MUSCLE_EXERCISES,
  MUSCLE_LABELS,
} from '../muscleExercises'
import type { MuscleZone } from '../types'

export interface ExercisePanelProps {
  selectedMuscle: MuscleZone | null
  hoveredMuscle?: MuscleZone | null
}

export function ExercisePanel({ selectedMuscle, hoveredMuscle = null }: ExercisePanelProps) {
  const previewMuscle = !selectedMuscle ? hoveredMuscle : null
  const hoverPreview =
    hoveredMuscle && selectedMuscle && hoveredMuscle !== selectedMuscle ? hoveredMuscle : null

  if (!selectedMuscle && !previewMuscle) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center backdrop-blur-xl">
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
        <h2 className="text-lg font-semibold text-white">Click on Captain Hema to discover target exercises</h2>
      </div>
    )
  }

  if (previewMuscle) {
    const label = MUSCLE_LABELS[previewMuscle]
    const badgeClass = MUSCLE_BADGE_COLORS[previewMuscle]
    const count = MUSCLE_EXERCISES[previewMuscle].length

    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/25 bg-cyan-500/5 p-8 text-center backdrop-blur-xl ring-1 ring-cyan-400/20">
        <span
          className={`mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${badgeClass}`}
        >
          {label}
        </span>
        <h2 className="text-lg font-semibold text-white">Hover preview</h2>
        <p className="mt-2 text-sm text-slate-400">
          {count} exercises ready — click the model to lock this zone
        </p>
      </div>
    )
  }

  const exercises = MUSCLE_EXERCISES[selectedMuscle!]
  const label = MUSCLE_LABELS[selectedMuscle!]
  const badgeClass = MUSCLE_BADGE_COLORS[selectedMuscle!]

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
      {hoverPreview && (
        <div className="mb-4 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-200/90">
          Hovering: <span className="font-semibold">{MUSCLE_LABELS[hoverPreview]}</span>
        </div>
      )}
      <div className="mb-6 flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${badgeClass}`}
        >
          {label}
        </span>
        <span className="text-sm text-slate-400">Recommended exercises</span>
      </div>
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {exercises.map((exercise) => (
          <li
            key={exercise}
            className="group rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/80 p-4 shadow-lg shadow-black/20 transition hover:border-cyan-400/30 hover:from-slate-800/80"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white group-hover:text-cyan-100">{exercise}</h3>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 group-hover:text-cyan-400/80">
                View
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Focused movement for {label.toLowerCase()} development and strength.
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
