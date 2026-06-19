import type { TranslationKey } from '../../lib/i18n/translations'
import type { MuscleZone } from './types'

export function muscleZoneKey(zone: MuscleZone): TranslationKey {
  return `muscleWiki.zone.${zone}` as TranslationKey
}

export const MUSCLE_ZONES: MuscleZone[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'calves',
  'glutes',
]

/** Featured exercise name hints per coarse zone — resolved to library IDs in muscleFeaturedExercises.generated.ts */

export const MUSCLE_LABELS: Record<MuscleZone, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  glutes: 'Glutes',
}

export const MUSCLE_BADGE_COLORS: Record<MuscleZone, string> = {
  chest: 'bg-cyan-500/20 text-cyan-300 ring-cyan-400/40',
  back: 'bg-cyan-500/20 text-cyan-300 ring-cyan-400/40',
  shoulders: 'bg-violet-500/20 text-violet-300 ring-violet-400/40',
  biceps: 'bg-cyan-500/20 text-cyan-300 ring-cyan-400/40',
  triceps: 'bg-cyan-500/20 text-cyan-300 ring-cyan-400/40',
  forearms: 'bg-indigo-500/20 text-indigo-300 ring-indigo-400/40',
  abs: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40',
  quads: 'bg-purple-500/20 text-purple-300 ring-purple-400/40',
  hamstrings: 'bg-violet-500/20 text-violet-300 ring-violet-400/40',
  calves: 'bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-400/40',
  glutes: 'bg-pink-500/20 text-pink-300 ring-pink-400/40',
}
