import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Stage, useGLTF } from '@react-three/drei'
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import * as THREE from 'three'
import type { Mesh, MeshStandardMaterial } from 'three'
import { Logo } from '../../../components/shared/Logo'
import { useI18n } from '../../../lib/i18n/useI18n'
import { MUSCLE_EXERCISES, muscleZoneKey } from '../muscleExercises'
import type { MuscleZone } from '../types'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { MuscleZonePicker } from './MuscleZonePicker'

export const MODEL_PATH = '/captain_hema_fixed_final.glb'

async function modelAssetExists(): Promise<boolean> {
  try {
    const res = await fetch(MODEL_PATH, { method: 'HEAD' })
    if (!res.ok) return false
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    return !ct.includes('text/html')
  } catch {
    return false
  }
}

/** Per-zone highlight tints used for albedo lerp and emissive glow on hover. */
const ZONE_HIGHLIGHT_COLORS: Record<MuscleZone, string> = {
  chest: '#0ea5e9',
  back: '#06b6d4',
  biceps: '#3b82f6',
  triceps: '#6366f1',
  shoulders: '#8b5cf6',
  abs: '#10b981',
  forearms: '#14b8a6',
  quads: '#a855f7',
  hamstrings: '#7c3aed',
  calves: '#c026d3',
  glutes: '#ec4899',
}

const EMISSIVE_INTENSITY = 0.35
const LERP_SPEED = 10

/** Named Blender muscle meshes; Tripo base body is fallback only when no named mesh is hit. */
const MESH_TO_ZONE: Record<string, MuscleZone> = {
  abs_mesh: 'abs',
  abs_mesh2: 'abs',
  back_mesh: 'back',
  backleg_mesh: 'hamstrings',
  biceps_mesh: 'biceps',
  calf_mesh: 'calves',
  chest_mesh: 'chest',
  frontleg_mesh: 'quads',
  glutes_mesh: 'glutes',
  shoulders_mesh: 'shoulders',
  try_mesh: 'triceps',
  wrist_mesh: 'forearms',
  tripo_mesh_a39b6e1e: 'chest',
}

const BLACK = new THREE.Color('#000000')

type ColorMaterial = MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshLambertMaterial

function hasColor(material: THREE.Material): material is ColorMaterial {
  return 'color' in material && material.color instanceof THREE.Color
}

function hasEmissive(material: THREE.Material): material is MeshStandardMaterial {
  return 'emissive' in material && material.emissive instanceof THREE.Color
}

/** Raycast / render sort priority: Blender named meshes beat Tripo base body. */
function meshZonePriority(name: string): number {
  if (name.endsWith('_mesh') || name.endsWith('_mesh2')) return 3
  if (/tripo_mesh_[^.]+\.\d+/.test(name)) return 2
  if (name.startsWith('tripo_mesh_')) return 0
  return 1
}

function getZoneFromMeshName(name: string): MuscleZone | null {
  return MESH_TO_ZONE[name] ?? null
}

/**
 * World-space Y (and X spread) fallback when mesh names are unknown or Tripo-suffixed.
 * Thresholds tuned for the scaled model in Stage (~0.65 scale, -0.6 Y offset).
 */
function inferZoneFromBounds(mesh: Mesh): MuscleZone {
  const box = new THREE.Box3().setFromObject(mesh)
  const center = box.getCenter(new THREE.Vector3())
  const absX = Math.abs(center.x)

  if (center.y < 0.28) {
    if (center.y < -0.12) return 'calves'
    if (center.y < 0.02) return center.z < -0.015 ? 'hamstrings' : 'quads'
    return 'glutes'
  }
  if (center.y < 0.44) {
    if (absX > 0.035) return center.z < -0.015 ? 'hamstrings' : 'quads'
    return 'abs'
  }
  if (center.y < 0.56) {
    return 'abs'
  }
  if (absX > 0.032) {
    if (center.y > 0.76) return 'shoulders'
    if (center.y > 0.66) return 'biceps'
    if (center.z < -0.015) return 'triceps'
    return 'forearms'
  }
  if (center.y > 0.7) return 'chest'
  if (center.z < -0.015) return 'back'
  return 'chest'
}

/** Resolves zone: explicit name map first, then Y-centroid inference. Cached on mesh.userData. */
function assignZone(mesh: Mesh): MuscleZone {
  const cached = mesh.userData.muscleZone as MuscleZone | undefined
  if (cached) return cached

  const zone = getZoneFromMeshName(mesh.name) ?? inferZoneFromBounds(mesh)
  mesh.userData.muscleZone = zone
  return zone
}

function getMeshZone(mesh: Mesh): MuscleZone {
  return assignZone(mesh)
}

/**
 * Walks raycast hits and parent chains; returns immediately when a Blender named
 * mesh (priority 3) is found so the Tripo base body cannot win the whole body.
 */
function resolveZoneFromIntersections(
  intersections: THREE.Intersection[],
): MuscleZone | null {
  let bestZone: MuscleZone | null = null
  let bestPriority = -1

  for (const hit of intersections) {
    let current: THREE.Object3D | null = hit.object
    while (current) {
      if ((current as Mesh).isMesh) {
        const mesh = current as Mesh
        const zone = getMeshZone(mesh)
        const priority = meshZonePriority(mesh.name)
        if (priority > bestPriority) {
          bestPriority = priority
          bestZone = zone
        }
        if (priority === 3) return bestZone
      }
      current = current.parent
    }
  }

  return bestZone
}

function forEachMuscleMesh(
  root: THREE.Object3D,
  callback: (mesh: Mesh, zone: MuscleZone) => void,
) {
  root.traverse((child) => {
    if (!(child as Mesh).isMesh) return
    const mesh = child as Mesh
    callback(mesh, getMeshZone(mesh))
  })
}

function forEachColorMaterial(mesh: Mesh, callback: (material: ColorMaterial) => void) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((material) => {
    if (hasColor(material)) callback(material)
  })
}

interface CaptainHemaModelProps {
  hoveredZone: MuscleZone | null
  onHoverZone: (zone: MuscleZone | null) => void
  onMuscleSelect: (zone: MuscleZone) => void
}

function CaptainHemaModel({ hoveredZone, onHoverZone, onMuscleSelect }: CaptainHemaModelProps) {
  const { scene } = useGLTF(MODEL_PATH)
  const highlightColorsRef = useRef<Map<MuscleZone, THREE.Color>>(new Map())

  useLayoutEffect(() => {
    scene.position.set(0, 0, 0)
    scene.rotation.set(0, 0, 0)
    scene.scale.set(1, 1, 1)

    const colorMap = new Map<MuscleZone, THREE.Color>()

    scene.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      const mesh = child as Mesh
      if (!mesh.geometry) return

      const zone = assignZone(mesh)
      const priority = meshZonePriority(mesh.name)
      mesh.renderOrder = priority

      // Tripo hull meshes cover the whole body; skip raycasts so named muscle meshes win.
      if (
        mesh.name === 'tripo_mesh_a39b6e1e' ||
        mesh.name === 'tripo_node_a39b6e1e' ||
        (mesh.name.startsWith('tripo_mesh_') && priority < 3)
      ) {
        mesh.raycast = () => undefined
        mesh.userData.skipHighlight = true
      }

      if (!colorMap.has(zone)) {
        colorMap.set(zone, new THREE.Color(ZONE_HIGHLIGHT_COLORS[zone]))
      }

      mesh.userData.hoverBlend = 0

      // GLB exports often share one material across all meshes; clone so zone hover is isolated.
      if (!mesh.userData.materialCloned) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone())
        } else {
          mesh.material = mesh.material.clone()
        }
        mesh.userData.materialCloned = true
      }

      forEachColorMaterial(mesh, (material) => {
        if (!material.userData.originalColor) {
          material.userData.originalColor = material.color.clone()
        }
        if (hasEmissive(material) && !material.userData.originalEmissive) {
          material.userData.originalEmissive = material.emissive.clone()
        }
      })
    })

    highlightColorsRef.current = colorMap
  }, [scene])

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      const zone = resolveZoneFromIntersections(e.intersections)
      onHoverZone(zone)
      document.body.style.cursor = zone ? 'pointer' : 'auto'
    },
    [onHoverZone],
  )

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHoverZone(null)
      document.body.style.cursor = 'auto'
    },
    [onHoverZone],
  )

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      const zone = resolveZoneFromIntersections(e.intersections)
      if (zone) onMuscleSelect(zone)
    },
    [onMuscleSelect],
  )

  /** Smooth per-mesh lerp toward zone highlight; all meshes in the same zone share hoveredZone. */
  useFrame((_, delta) => {
    const step = Math.min(1, delta * LERP_SPEED)

    forEachMuscleMesh(scene, (mesh, zone) => {
      if (mesh.userData.skipHighlight) return

      const target = hoveredZone === zone ? 1 : 0
      const current = (mesh.userData.hoverBlend as number) ?? 0
      const blend = THREE.MathUtils.lerp(current, target, step)
      mesh.userData.hoverBlend = blend

      if (blend < 0.001 && target === 0) {
        forEachColorMaterial(mesh, (material) => {
          const original = material.userData.originalColor as THREE.Color | undefined
          if (original) material.color.copy(original)
          if (hasEmissive(material)) {
            const originalEmissive = material.userData.originalEmissive as THREE.Color | undefined
            if (originalEmissive) material.emissive.copy(originalEmissive)
            material.emissiveIntensity = 0
          }
        })
        return
      }

      const highlightColor =
        highlightColorsRef.current.get(zone) ?? new THREE.Color(ZONE_HIGHLIGHT_COLORS[zone])

      forEachColorMaterial(mesh, (material) => {
        const original = material.userData.originalColor as THREE.Color | undefined
        if (!original) return

        material.color.lerpColors(original, highlightColor, blend)

        if (hasEmissive(material)) {
          material.emissive.lerpColors(BLACK, highlightColor, blend)
          material.emissiveIntensity = blend * EMISSIVE_INTENSITY
        }
      })
    })
  })

  return (
    <Stage adjustCamera={1.2} intensity={0.65} shadows={false}>
      <group position={[0, -0.8, 0]} scale={[0.9,0.9, 0.9]}>
        <primitive
          object={scene}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
      </group>
    </Stage>
  )
}

function SceneLoader() {
  return (
    <mesh>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color="#334155" wireframe />
    </mesh>
  )
}

export interface CaptainHemaCanvasProps {
  onMuscleSelect: (zone: MuscleZone) => void
  onMuscleHover?: (zone: MuscleZone | null) => void
  selectedMuscle?: MuscleZone | null
}

export function CaptainHemaCanvas({
  onMuscleSelect,
  onMuscleHover,
  selectedMuscle = null,
}: CaptainHemaCanvasProps) {
  const { t } = useI18n()
  const [hoveredZone, setHoveredZone] = useState<MuscleZone | null>(null)
  const [modelReady, setModelReady] = useState<boolean | null>(null)
  const [canvasFailed, setCanvasFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    let cancelled = false
    modelAssetExists().then((ok) => {
      if (!cancelled) {
        setModelReady(ok)
        if (ok) useGLTF.preload(MODEL_PATH)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleHoverZone = useCallback(
    (zone: MuscleZone | null) => {
      setHoveredZone(zone)
      onMuscleHover?.(zone)
    },
    [onMuscleHover],
  )

  const handleContainerPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const handleContainerPointerLeave = useCallback(() => {
    setHoveredZone(null)
    onMuscleHover?.(null)
    document.body.style.cursor = 'auto'
  }, [onMuscleHover])

  const exerciseCount = hoveredZone ? MUSCLE_EXERCISES[hoveredZone].length : 0
  const useFallback = modelReady === false || canvasFailed

  return (
    <div
      ref={containerRef}
      className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 shadow-2xl shadow-black/40 lg:h-full lg:min-h-[420px] lg:flex-1"
      onPointerMove={useFallback ? undefined : handleContainerPointerMove}
      onPointerLeave={useFallback ? undefined : handleContainerPointerLeave}
    >
      <div className="logo-pulse pointer-events-none absolute left-4 top-4 z-10" aria-hidden>
        <Logo size="sm" />
      </div>

      {useFallback ? (
        <MuscleZonePicker
          selected={selectedMuscle}
          onSelect={onMuscleSelect}
          showMissingHint
        />
      ) : modelReady === null ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          {t('common.loading')}
        </div>
      ) : (
        <>
          {hoveredZone && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-cyan-500/30 bg-slate-950/95 px-3 py-2 shadow-lg shadow-cyan-500/10"
              style={{
                left: Math.min(Math.max(tooltipPos.x, 72), (containerRef.current?.clientWidth ?? 300) - 72),
                top: Math.max(tooltipPos.y - 12, 56),
              }}
              role="status"
              aria-live="polite"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                {t(muscleZoneKey(hoveredZone))}
              </p>
              <p className="text-[11px] text-slate-400">
                {exerciseCount === 1
                  ? t('muscleWiki.exerciseCountOne')
                  : t('muscleWiki.exerciseCount', { count: String(exerciseCount) })}
              </p>
            </div>
          )}

          <CanvasErrorBoundary
            fallback={
              <MuscleZonePicker
                selected={selectedMuscle}
                onSelect={onMuscleSelect}
                showMissingHint
              />
            }
            onError={() => setCanvasFailed(true)}
          >
            <Canvas
              className="absolute inset-0 h-full w-full"
              gl={{ antialias: true, alpha: true }}
              onPointerMissed={() => {
                setHoveredZone(null)
                onMuscleHover?.(null)
                document.body.style.cursor = 'auto'
              }}
            >
              <color attach="background" args={['#0a0f18']} />
              <ambientLight intensity={0.45} />
              <directionalLight position={[4, 6, 3]} intensity={1.15} />
              <directionalLight position={[-3, 2, -2]} intensity={0.35} />
              <Suspense fallback={<SceneLoader />}>
                <CaptainHemaModel
                  hoveredZone={hoveredZone}
                  onHoverZone={handleHoverZone}
                  onMuscleSelect={onMuscleSelect}
                />
              </Suspense>
              <OrbitControls enableZoom={false} enablePan={false} makeDefault />
            </Canvas>
          </CanvasErrorBoundary>
        </>
      )}
    </div>
  )
}
