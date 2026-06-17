import type { TranslationKey } from '../../lib/i18n/translations'
import type { FineMuscleRegion, MuscleRegion } from './types'

export function muscleRegionKey(region: MuscleRegion): TranslationKey {
  return `muscleWiki.zone.${region}` as TranslationKey
}

/** GLB mesh object name → selectable muscle region (fine-grained where noted). */
export const MESH_TO_REGION: Record<string, MuscleRegion> = {
  lats_mesh: 'lats',
  lowerback_mesh: 'lowerback',
  traps_mesh: 'traps',
  trapsmiddle_mesh: 'trapsmiddle',
  frontshoulders_mesh: 'frontshoulders',
  rearshoulders_mesh: 'rearshoulders',
  hands_mesh: 'hands',
  abdominals_mesh: 'abdominals',
  obliques: 'obliques',
  chest_mesh: 'chest',
  biceps_mesh: 'biceps',
  triceps_mesh: 'triceps',
  forearms_mesh: 'forearms',
  quads_mesh: 'quads',
  hamstrings_mesh: 'hamstrings',
  calves_mesh: 'calves',
  'calves_mesh.001': 'calves',
  /** Three.js GLTFLoader strips dots from Blender duplicate names. */
  calves_mesh001: 'calves',
  glutes_mesh: 'glutes',
  // legacy model
  abs_mesh: 'abs',
  abs_mesh2: 'abs',
  back_mesh: 'back',
  backleg_mesh: 'hamstrings',
  calf_mesh: 'calves',
  frontleg_mesh: 'quads',
  shoulders_mesh: 'shoulders',
  try_mesh: 'triceps',
  wrist_mesh: 'forearms',
  tripo_mesh_a39b6e1e: 'chest',
}

/** Default GLB mesh used for cinematic framing when no raycast mesh is available. */
export const PRIMARY_MESH_BY_REGION: Partial<Record<MuscleRegion, string>> = {
  chest: 'chest_mesh',
  biceps: 'biceps_mesh',
  triceps: 'triceps_mesh',
  forearms: 'forearms_mesh',
  quads: 'quads_mesh',
  hamstrings: 'hamstrings_mesh',
  calves: 'calves_mesh',
  glutes: 'glutes_mesh',
  lats: 'lats_mesh',
  lowerback: 'lowerback_mesh',
  traps: 'traps_mesh',
  trapsmiddle: 'trapsmiddle_mesh',
  frontshoulders: 'frontshoulders_mesh',
  rearshoulders: 'rearshoulders_mesh',
  hands: 'hands_mesh',
  abdominals: 'abdominals_mesh',
  obliques: 'obliques',
  shoulders: 'traps_mesh',
  back: 'lowerback_mesh',
  abs: 'abdominals_mesh',
}

/** Shared fuchsia hover for calves_mesh + calves_mesh.001 (rear). */
export const CALVES_HOVER_COLOR = '#c026d3'

export const REGION_HIGHLIGHT_COLORS: Record<MuscleRegion, string> = {
  chest: '#ff00ff',
  back: '#06b6d4',
  shoulders: '#8b5cf6',
  biceps: '#2eff00',
  triceps: '#2eff00',
  forearms: '#0004ff',
  abs: '#10b981',
  quads: '#a855f7',
  hamstrings: '#7c3aed',
  calves: CALVES_HOVER_COLOR,
  glutes: '#ec4899',
  lats: '#ff4700',
  lowerback: '#ff4700',
  traps: '#ff4700',
  trapsmiddle: '#ff4700',
  frontshoulders: '#a78bfa',
  rearshoulders: '#7c3aed',
  hands: '#ffd200',
  abdominals: '#34d399',
  obliques: '#059669',
}

export const REGION_BADGE_COLORS: Record<MuscleRegion, string> = {
  chest: 'bg-cyan-500/20 text-cyan-300 ring-cyan-400/40',
  back: 'bg-cyan-500/20 text-cyan-300 ring-cyan-400/40',
  shoulders: 'bg-violet-500/20 text-violet-300 ring-violet-400/40',
  biceps: 'bg-blue-500/20 text-blue-300 ring-blue-400/40',
  triceps: 'bg-indigo-500/20 text-indigo-300 ring-indigo-400/40',
  forearms: 'bg-teal-500/20 text-teal-300 ring-teal-400/40',
  abs: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40',
  quads: 'bg-purple-500/20 text-purple-300 ring-purple-400/40',
  hamstrings: 'bg-violet-500/20 text-violet-300 ring-violet-400/40',
  calves: 'bg-fuchsia-500/20 text-fuchsia-300 ring-fuchsia-400/40',
  glutes: 'bg-pink-500/20 text-pink-300 ring-pink-400/40',
  lats: 'bg-sky-500/20 text-sky-300 ring-sky-400/40',
  lowerback: 'bg-cyan-600/20 text-cyan-200 ring-cyan-500/40',
  traps: 'bg-teal-500/20 text-teal-300 ring-teal-400/40',
  trapsmiddle: 'bg-teal-600/20 text-teal-200 ring-teal-500/40',
  frontshoulders: 'bg-violet-500/20 text-violet-300 ring-violet-400/40',
  rearshoulders: 'bg-purple-500/20 text-purple-300 ring-purple-400/40',
  hands: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40',
  abdominals: 'bg-green-500/20 text-green-300 ring-green-400/40',
  obliques: 'bg-lime-500/20 text-lime-300 ring-lime-400/40',
}

/** GLB node names that highlight together (front + rear calf meshes). */
export const LINKED_CALF_MESHES = ['calves_mesh', 'calves_mesh.001', 'calves_mesh001'] as const

export function isLinkedCalfMeshName(name: string): boolean {
  return (LINKED_CALF_MESHES as readonly string[]).includes(name)
}

/** Pin ambiguous lower-body GLB nodes to the correct hover/select region. */
export function regionForMappedMeshName(name: string): MuscleRegion | null {
  if (isLinkedCalfMeshName(name)) return 'calves'
  if (name === 'glutes_mesh') return 'glutes'
  return MESH_TO_REGION[name] ?? null
}

export const FINE_MUSCLE_REGIONS: FineMuscleRegion[] = [
  'lats',
  'lowerback',
  'traps',
  'trapsmiddle',
  'frontshoulders',
  'rearshoulders',
  'hands',
  'abdominals',
  'obliques',
]

export function isMappedMuscleMesh(name: string): boolean {
  return Boolean(regionForMappedMeshName(name))
}

/** Shared hover tint for both calf GLB nodes. */
export function highlightColorForMappedMesh(
  mappedName: string | undefined,
  region: MuscleRegion,
): string {
  if (mappedName && isLinkedCalfMeshName(mappedName)) return CALVES_HOVER_COLOR
  if (region === 'calves') return CALVES_HOVER_COLOR
  return REGION_HIGHLIGHT_COLORS[region]
}
