/**
 * Ensures every MuscleRegion has a preset cinematic camera (cap_hema style).
 * Run: node scripts/validate-muscle-cameras.mjs
 */
import {
  DEFAULT_MODEL_CAMERA,
  REGION_CAMERA_TARGETS,
} from '../features/muscle-wiki/muscleCamera.ts'

const ALL_REGIONS = [
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

let missing = 0
console.log('Preset muscle camera validation\n')
console.log(`Default overview: pos ${DEFAULT_MODEL_CAMERA.position.join(', ')}`)

for (const region of ALL_REGIONS) {
  const target = REGION_CAMERA_TARGETS[region]
  if (!target) {
    missing += 1
    console.log(`MISS ${region}`)
    continue
  }
  const [px, py, pz] = target.position
  const dist = Math.hypot(px - target.target[0], py - target.target[1], pz - target.target[2])
  console.log(`OK   ${region.padEnd(14)} dist ${dist.toFixed(2)}  target y ${target.target[1].toFixed(2)}`)
}

console.log(`\n${missing} region(s) missing preset cameras.`)
process.exit(missing > 0 ? 1 : 0)
