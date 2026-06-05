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

export const MUSCLE_EXERCISES: Record<MuscleZone, string[]> = {
  chest: ['Bench Press', 'Push-ups', 'Dumbbell Flyes', 'Incline Press', 'Cable Crossover', 'Chest Dips'],
  back: ['Pull-ups', 'Barbell Rows', 'Lat Pulldown', 'Face Pulls', 'T-Bar Row', 'Deadlift'],
  shoulders: ['Overhead Press', 'Lateral Raises', 'Front Raises', 'Arnold Press', 'Upright Row', 'Shrugs'],
  biceps: ['Barbell Curl', 'Hammer Curls', 'Preacher Curl', 'Concentration Curl', 'Cable Curl', 'Chin-ups'],
  triceps: ['Tricep Pushdown', 'Skull Crushers', 'Overhead Extension', 'Close-Grip Bench', 'Dips', 'Kickbacks'],
  forearms: ['Wrist Curls', 'Reverse Curls', 'Farmer Walks', 'Plate Pinches', 'Hammer Holds', 'Dead Hangs'],
  abs: ['Crunches', 'Planks', 'Leg Raises', 'Russian Twists', 'Hanging Knee Raises', 'Ab Wheel Rollout'],
  quads: [
    'Barbell Back Squat',
    'Leg Press',
    'Hack Squat',
    'Leg Extension',
    'Bulgarian Split Squat',
    'Walking Lunges',
  ],
  hamstrings: [
    'Romanian Deadlift',
    'Lying Leg Curl',
    'Seated Leg Curl',
    'Nordic Hamstring Curl',
    'Glute-Ham Raise',
    'Stiff-Leg Deadlift',
  ],
  calves: [
    'Standing Calf Raise',
    'Seated Calf Raise',
    'Donkey Calf Raise',
    'Single-Leg Calf Raise',
    'Jump Rope',
    'Leg Press Calf Raise',
  ],
  glutes: [
    'Hip Thrust',
    'Bulgarian Split Squat',
    'Romanian Deadlift',
    'Glute Bridge',
    'Cable Kickback',
    'Step-Up',
  ],
}

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
