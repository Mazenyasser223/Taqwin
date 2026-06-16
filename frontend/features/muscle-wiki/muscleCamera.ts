import type { MuscleRegion } from './types'

export type CameraTarget = {
  position: [number, number, number]
  target: [number, number, number]
}

/**
 * Captain Hema cinematic framing — same concept as cap_hema:
 * fixed camera position + lookAt per region, full lerp on select (no bbox blend).
 * Model is rotated π/2 on Y; front zones use negative Z, back zones use positive Z.
 */
export const DEFAULT_MODEL_CAMERA: CameraTarget = {
  position: [0, 0.15, 3.2],
  target: [0, 0, 0],
}

export const REGION_CAMERA_TARGETS: Record<MuscleRegion, CameraTarget> = {
  // —— 11 coarse zones (match cap_hema) ——
  chest: { position: [0, 0.35, -1.55], target: [0, 0.3, 0] },
  back: { position: [0, 0.4, 1.55], target: [0, 0.35, 0] },
  shoulders: { position: [0, 0.75, 1.45], target: [0, 0.6, 0] },
  biceps: { position: [0.95, 0.35, -1.4], target: [0.25, 0.25, 0] },
  triceps: { position: [-0.95, 0.35, 1.4], target: [-0.25, 0.3, 0] },
  forearms: { position: [1.05, 0.45, -1.25], target: [0.28, 0.45, 0] },
  abs: { position: [0, 0.05, -1.55], target: [0, 0, 0] },
  quads: { position: [0, -0.35, -1.55], target: [0, -0.35, 0] },
  hamstrings: { position: [0, -0.35, 1.55], target: [0, -0.35, 0] },
  calves: { position: [0, -0.6, 1.4], target: [0, -0.55, 0] },
  glutes: { position: [0, -0.15, 1.5], target: [0, -0.2, 0] },

  // —— fine back subdivisions ——
  lats: { position: [0.78, 0.42, 1.42], target: [0.22, 0.35, 0] },
  lowerback: { position: [0, 0.18, 1.55], target: [0, 0.12, 0] },
  traps: { position: [0, 0.68, 1.48], target: [0, 0.58, 0] },
  trapsmiddle: { position: [0, 0.52, 1.5], target: [0, 0.45, 0] },

  // —— fine front / sides ——
  frontshoulders: { position: [0, 0.75, -1.48], target: [0, 0.62, 0] },
  rearshoulders: { position: [0.88, 0.72, 1.38], target: [0.28, 0.58, 0] },
  hands: { position: [1.08, 0.38, -1.22], target: [0.32, 0.35, 0] },
  abdominals: { position: [0, 0.05, -1.55], target: [0, 0, 0] },
  obliques: { position: [0.42, 0.08, -1.52], target: [0.12, 0.02, 0] },
}

export function getRegionCameraTarget(region: MuscleRegion): CameraTarget {
  return REGION_CAMERA_TARGETS[region]
}
