import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Mesh, MeshStandardMaterial } from 'three'
import { Logo } from '../../../components/shared/Logo'
import { useI18n } from '../../../lib/i18n/useI18n'
import {
  highlightColorForMappedMesh,
  isLinkedCalfMeshName,
  isMappedMuscleMesh,
  muscleRegionKey,
  regionForMappedMeshName,
} from '../muscleRegions'
import { DEFAULT_MODEL_CAMERA, getRegionCameraTarget } from '../muscleCamera'
import { formatWikiExerciseCount, libraryCountForWikiRegion } from '../muscleWikiCount'
import type { MuscleRegion, MuscleZone } from '../types'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { MuscleZonePicker } from './MuscleZonePicker'

export const MODEL_PATH = '/captain_hema_fixed_final2.glb'

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

const EMISSIVE_INTENSITY = 0.35
const LERP_SPEED = 10
const CAMERA_LERP_SPEED = 3.5

const MODEL_SCALE = 2
/** GLB feet at y=0; offset + scale 2 places the figure center near the origin. */
const MODEL_OFFSET: [number, number, number] = [0, -0.98, 0]

const DEFAULT_CAMERA = DEFAULT_MODEL_CAMERA

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = (width: number, height: number) => {
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }

    update(el.clientWidth, el.clientHeight)

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      update(width, height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return size
}

function deriveCanvasViewport(size: { width: number; height: number }) {
  const { width, height } = size
  const aspect = width > 0 && height > 0 ? width / height : 1.35
  const compactHeight = height > 0 && height < 500
  const laptopSplit = width > 0 && width < 860 && aspect >= 0.85

  const fov = aspect >= 1.35 ? 39 : aspect >= 1.05 ? 42 : aspect <= 0.82 ? 48 : 44
  const minDistance = compactHeight ? 1.5 : laptopSplit ? 1.35 : 1.2
  const maxDistance = compactHeight ? 3.6 : laptopSplit ? 4 : 5.2
  const zoomSpeed = compactHeight ? 0.7 : 0.85
  const dprCap = compactHeight ? 1.5 : 2

  return { aspect, fov, minDistance, maxDistance, zoomSpeed, dprCap, compactHeight, laptopSplit }
}

/** Keeps perspective FOV in sync when the canvas container is resized (laptop split layout). */
function ResponsiveCamera({ fov }: { fov: number }) {
  const { camera, size } = useThree()

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    camera.fov = fov
    camera.aspect = size.width / Math.max(size.height, 1)
    camera.updateProjectionMatrix()
  }, [camera, fov, size.height, size.width])

  return null
}

interface DefaultCameraState {
  position: THREE.Vector3
  target: THREE.Vector3
}

/** Raycast / render sort priority: mapped muscle meshes beat Tripo base body hulls. */
function meshZonePriority(object: THREE.Object3D): number {
  let current: THREE.Object3D | null = object
  while (current) {
    if (isMappedMuscleMesh(current.name)) return 3
    if (current.name.endsWith('_mesh') || current.name.endsWith('_mesh2')) return 3
    if (/tripo_mesh_[^.]+\.\d+/.test(current.name)) return 2
    if (current.name.startsWith('tripo_mesh_')) return 0
    current = current.parent
  }
  return 1
}

function resolveMappedMeshName(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    if (regionForMappedMeshName(current.name)) return current.name
    current = current.parent
  }
  return null
}

function shouldHighlightMesh(mesh: Mesh, region: MuscleRegion, hovered: MuscleRegion | null): boolean {
  if (!hovered) return false

  const mappedName = mesh.userData.mappedMeshName as string | undefined

  if (hovered === 'calves') {
    return mappedName ? isLinkedCalfMeshName(mappedName) : region === 'calves'
  }

  if (hovered === 'glutes') {
    return mappedName === 'glutes_mesh'
  }

  return region === hovered
}

const BLACK = new THREE.Color('#000000')

type ColorMaterial = MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshLambertMaterial

function hasColor(material: THREE.Material): material is ColorMaterial {
  return 'color' in material && material.color instanceof THREE.Color
}

function hasEmissive(material: THREE.Material): material is MeshStandardMaterial {
  return 'emissive' in material && material.emissive instanceof THREE.Color
}

/**
 * World-space Y (and X spread) fallback when mesh names are unknown or Tripo-suffixed.
 * Thresholds tuned for the scaled model (~scale 2, Y offset -0.98).
 */
function inferZoneFromBounds(mesh: Mesh): MuscleZone {
  const box = new THREE.Box3().setFromObject(mesh)
  const center = box.getCenter(new THREE.Vector3())
  const absX = Math.abs(center.x)

  if (center.y < 0.28) {
    if (center.y < -0.12) return 'calves'
    if (center.y < 0.02) return center.z < -0.015 ? 'hamstrings' : 'quads'
    if (center.y < 0.16) return 'calves'
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

/** Resolves region from GLB node name; bounds inference is legacy fallback only. */
function assignRegion(mesh: Mesh): MuscleRegion {
  const cached = mesh.userData.muscleRegion as MuscleRegion | undefined
  if (cached) return cached

  const mappedName = resolveMappedMeshName(mesh)
  if (mappedName) {
    const region = regionForMappedMeshName(mappedName)!
    mesh.userData.mappedMeshName = mappedName
    mesh.userData.muscleRegion = region
    return region
  }

  const region = inferZoneFromBounds(mesh)
  mesh.userData.muscleRegion = region
  return region
}

function getMeshRegion(mesh: Mesh): MuscleRegion {
  return assignRegion(mesh)
}

/**
 * Walks raycast hits and parent chains; returns immediately when a Blender named
 * mesh (priority 3) is found so the Tripo base body cannot win the whole body.
 */
function resolveRegionFromIntersections(
  intersections: THREE.Intersection[],
): MuscleRegion | null {
  for (const hit of intersections) {
    const mappedName = resolveMappedMeshName(hit.object)
    if (mappedName) {
      const region = regionForMappedMeshName(mappedName)
      if (region) return region
    }
  }

  let bestRegion: MuscleRegion | null = null
  let bestPriority = -1

  for (const hit of intersections) {
    let current: THREE.Object3D | null = hit.object
    while (current) {
      if ((current as Mesh).isMesh) {
        const mesh = current as Mesh
        const region = getMeshRegion(mesh)
        const priority = meshZonePriority(mesh)
        if (priority > bestPriority) {
          bestPriority = priority
          bestRegion = region
        }
        if (priority === 3) return bestRegion
      }
      current = current.parent
    }
  }

  return bestRegion
}

function forEachMuscleMesh(
  root: THREE.Object3D,
  callback: (mesh: Mesh, region: MuscleRegion) => void,
) {
  root.traverse((child) => {
    if (!(child as Mesh).isMesh) return
    const mesh = child as Mesh
    callback(mesh, getMeshRegion(mesh))
  })
}

function forEachColorMaterial(mesh: Mesh, callback: (material: ColorMaterial) => void) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach((material) => {
    if (hasColor(material)) callback(material)
  })
}

interface CaptainHemaModelProps {
  hoveredRegion: MuscleRegion | null
  onHoverRegion: (region: MuscleRegion | null) => void
  onMuscleSelect: (region: MuscleRegion) => void
}

function tagMuscleMeshNode(mesh: Mesh, mappedName: string, region: MuscleRegion) {
  mesh.userData.mappedMeshName = mappedName
  mesh.userData.muscleRegion = region
  mesh.userData.highlightColor = new THREE.Color(
    highlightColorForMappedMesh(mappedName, region),
  )
  if (isLinkedCalfMeshName(mappedName)) {
    mesh.renderOrder = 12
  }
}

function tagMuscleMeshesFromRoots(root: THREE.Object3D) {
  // Muscle nodes may be direct mesh children or nested under a "Scene" group from GLTFLoader.
  root.traverse((node) => {
    const region = regionForMappedMeshName(node.name)
    if (!region) return

    if ((node as Mesh).isMesh) {
      tagMuscleMeshNode(node as Mesh, node.name, region)
    }

    node.traverse((desc) => {
      if (!(desc as Mesh).isMesh || desc === node) return
      tagMuscleMeshNode(desc as Mesh, node.name, region)
    })
  })
}

function CaptainHemaModel({
  hoveredRegion,
  onHoverRegion,
  onMuscleSelect,
}: CaptainHemaModelProps) {
  const { scene } = useGLTF(MODEL_PATH)

  useLayoutEffect(() => {
    scene.position.set(0, 0, 0)
    scene.rotation.set(0, 0, 0)
    scene.scale.set(1, 1, 1)

    tagMuscleMeshesFromRoots(scene)

    scene.traverse((child) => {
      if (!(child as Mesh).isMesh) return
      const mesh = child as Mesh
      if (!mesh.geometry) return

      const region = assignRegion(mesh)
      const mappedName = mesh.userData.mappedMeshName as string | undefined
      const priority = isLinkedCalfMeshName(mappedName ?? '') ? 12 : meshZonePriority(mesh)
      mesh.renderOrder = priority

      // Tripo hull meshes cover the whole body; skip raycasts so named muscle meshes win.
      if (
        mesh.name === 'backleg_mesh_Clone' ||
        mesh.name === 'tripo_mesh_a39b6e1e' ||
        mesh.name === 'tripo_node_a39b6e1e' ||
        (mesh.name.startsWith('tripo_mesh_') && priority < 3)
      ) {
        mesh.raycast = () => undefined
        mesh.userData.skipHighlight = true
      }

      mesh.userData.highlightColor = new THREE.Color(
        highlightColorForMappedMesh(
          mesh.userData.mappedMeshName as string | undefined,
          region,
        ),
      )
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
  }, [scene])

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      const region = resolveRegionFromIntersections(e.intersections)
      onHoverRegion(region)
      document.body.style.cursor = region ? 'pointer' : 'auto'
    },
    [onHoverRegion],
  )

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHoverRegion(null)
      document.body.style.cursor = 'auto'
    },
    [onHoverRegion],
  )

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      const region = resolveRegionFromIntersections(e.intersections)
      if (region) onMuscleSelect(region)
    },
    [onMuscleSelect],
  )

  /** Smooth per-mesh lerp; only the hovered region's mesh(es) highlight with their own tint. */
  useFrame((_, delta) => {
    const step = Math.min(1, delta * LERP_SPEED)

    forEachMuscleMesh(scene, (mesh, region) => {
      if (mesh.userData.skipHighlight) return

      const target = shouldHighlightMesh(mesh, region, hoveredRegion) ? 1 : 0
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

      const mappedName = mesh.userData.mappedMeshName as string | undefined
      const highlightColor = new THREE.Color(
        highlightColorForMappedMesh(mappedName, region),
      )
      const emissiveBoost =
        hoveredRegion === 'calves' && mappedName && isLinkedCalfMeshName(mappedName) ? 0.55 : EMISSIVE_INTENSITY

      forEachColorMaterial(mesh, (material) => {
        const original = material.userData.originalColor as THREE.Color | undefined
        if (!original) return

        material.color.lerpColors(original, highlightColor, blend)

        if (hasEmissive(material)) {
          material.emissive.lerpColors(BLACK, highlightColor, blend)
          material.emissiveIntensity = blend * emissiveBoost
        }
      })
    })
  })

  return (
    <group position={MODEL_OFFSET} scale={MODEL_SCALE} rotation={[0, Math.PI / 2, 0]}>
      <primitive
        object={scene}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />
    </group>
  )
}

/** Smoothly lerps the camera toward the selected region or back to default on reset. */
function CinematicCamera({
  selectedRegion,
  onSettled,
  orbitControlsRef,
  defaultCameraRef,
}: {
  selectedRegion: MuscleRegion | null
  onSettled: (settled: boolean) => void
  orbitControlsRef: RefObject<OrbitControlsImpl | null>
  defaultCameraRef: RefObject<DefaultCameraState>
}) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3(...DEFAULT_CAMERA.target))
  const settledRef = useRef(true)
  const prevSelectedRegion = useRef<MuscleRegion | null | undefined>(undefined)

  useLayoutEffect(() => {
    camera.position.set(...DEFAULT_CAMERA.position)
    currentLook.current.set(...DEFAULT_CAMERA.target)
    camera.lookAt(currentLook.current)
    defaultCameraRef.current.position.set(...DEFAULT_CAMERA.position)
    defaultCameraRef.current.target.set(...DEFAULT_CAMERA.target)
    const controls = orbitControlsRef.current
    if (controls) {
      controls.target.set(...DEFAULT_CAMERA.target)
      controls.update()
    }
  }, [camera, defaultCameraRef, orbitControlsRef])

  useEffect(() => {
    if (prevSelectedRegion.current === undefined) {
      prevSelectedRegion.current = selectedRegion
      return
    }
    prevSelectedRegion.current = selectedRegion

    if (selectedRegion) {
      const zone = getRegionCameraTarget(selectedRegion)
      targetPos.current.set(...zone.position)
      targetLook.current.set(...zone.target)
    } else {
      targetPos.current.copy(defaultCameraRef.current.position)
      targetLook.current.copy(defaultCameraRef.current.target)
    }
    settledRef.current = false
    onSettled(false)
  }, [selectedRegion, onSettled, defaultCameraRef])

  useFrame((_, delta) => {
    if (settledRef.current) return

    const speed = delta * CAMERA_LERP_SPEED
    camera.position.lerp(targetPos.current, speed)
    currentLook.current.lerp(targetLook.current, speed)
    camera.lookAt(currentLook.current)

    const posClose = camera.position.distanceTo(targetPos.current) < 0.02
    const lookClose = currentLook.current.distanceTo(targetLook.current) < 0.01

    if (posClose && lookClose) {
      camera.position.copy(targetPos.current)
      currentLook.current.copy(targetLook.current)
      camera.lookAt(currentLook.current)
      settledRef.current = true
      onSettled(true)

      const controls = orbitControlsRef.current
      if (controls) {
        controls.target.copy(currentLook.current)
        controls.update()
      }
    }
  })

  return null
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
  onMuscleSelect: (region: MuscleRegion | null) => void
  onMuscleHover?: (region: MuscleRegion | null) => void
  selectedMuscle?: MuscleRegion | null
  muscleCounts?: Record<string, number> | null
  muscleCountsLoading?: boolean
  /** Hide Taqwin logo overlay (e.g. landing page preview). */
  showBranding?: boolean
  /** Brighter presentation for marketing / landing embeds. */
  variant?: 'app' | 'landing'
}

export function CaptainHemaCanvas({
  onMuscleSelect,
  onMuscleHover,
  selectedMuscle = null,
  muscleCounts = null,
  muscleCountsLoading = false,
  showBranding = true,
  variant = 'app',
}: CaptainHemaCanvasProps) {
  const { t } = useI18n()
  const [hoveredRegion, setHoveredRegion] = useState<MuscleRegion | null>(null)
  const [isCinematicSettled, setIsCinematicSettled] = useState(true)
  const [modelReady, setModelReady] = useState<boolean | null>(null)
  const [canvasFailed, setCanvasFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerSize = useElementSize(containerRef)
  const viewport = deriveCanvasViewport(containerSize)
  const orbitControlsRef = useRef<OrbitControlsImpl>(null)
  const defaultCameraRef = useRef<DefaultCameraState>({
    position: new THREE.Vector3(...DEFAULT_CAMERA.position),
    target: new THREE.Vector3(...DEFAULT_CAMERA.target),
  })
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMuscleClear = useCallback(() => {
    onMuscleSelect(null)
  }, [onMuscleSelect])

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedMuscle) handleMuscleClear()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMuscle, handleMuscleClear])

  const handleMuscleSelect = useCallback(
    (region: MuscleRegion) => {
      onMuscleSelect(region)
    },
    [onMuscleSelect],
  )

  const handleCinematicSettled = useCallback((settled: boolean) => {
    setIsCinematicSettled(settled)
  }, [])

  const resetCamera = useCallback(() => {
    handleMuscleClear()
  }, [handleMuscleClear])

  const handleHoverRegion = useCallback(
    (region: MuscleRegion | null) => {
      setHoveredRegion(region)
      onMuscleHover?.(region)
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
    setHoveredRegion(null)
    onMuscleHover?.(null)
    document.body.style.cursor = 'auto'
  }, [onMuscleHover])

  const exerciseCount = hoveredRegion ? libraryCountForWikiRegion(hoveredRegion, muscleCounts) : null
  const exerciseCountLabel =
    muscleCountsLoading && exerciseCount == null
      ? t('muscleWiki.exerciseCountLoading')
      : formatWikiExerciseCount(exerciseCount, t)
  const useFallback = modelReady === false || canvasFailed
  const isLanding = variant === 'landing'
  const shellClass = isLanding
    ? 'relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-600/30 via-slate-700/25 to-slate-800/40 shadow-xl shadow-cyan-500/10'
    : 'relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 shadow-2xl shadow-black/40'

  return (
    <div
      ref={containerRef}
      className={shellClass}
      onPointerMove={useFallback ? undefined : handleContainerPointerMove}
      onPointerLeave={useFallback ? undefined : handleContainerPointerLeave}
    >
      {showBranding ? (
        <div className="logo-pulse pointer-events-none absolute start-3 top-3 z-10 sm:start-4 sm:top-4" aria-hidden>
          <Logo size="sm" />
        </div>
      ) : null}

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
          {selectedMuscle && (
            <div
              className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-700"
              style={{
                background:
                  'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
              }}
            />
          )}

          {selectedMuscle && (
            <button
              type="button"
              onClick={resetCamera}
              className="absolute bottom-3 end-3 z-20 flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/90 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 backdrop-blur-sm transition hover:border-cyan-400/30 hover:text-cyan-300 sm:bottom-4 sm:end-4 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 12a9 9 0 1 0 9-9M3 3v4h4" strokeLinecap="round" />
              </svg>
              {t('community.resetZoom')} (ESC)
            </button>
          )}

          {hoveredRegion && (
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
                {t(muscleRegionKey(hoveredRegion))}
              </p>
              <p className="text-[11px] text-slate-400">{exerciseCountLabel}</p>
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
              className="!h-full !w-full touch-none"
              style={{ display: 'block', width: '100%', height: '100%' }}
              gl={{ antialias: true, alpha: true }}
              dpr={[1, viewport.dprCap]}
              camera={{ position: DEFAULT_CAMERA.position, fov: viewport.fov, near: 0.1, far: 100 }}
              resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
              onPointerMissed={() => {
                handleMuscleClear()
                setHoveredRegion(null)
                onMuscleHover?.(null)
                document.body.style.cursor = 'auto'
              }}
            >
              <ResponsiveCamera fov={viewport.fov} />
              <color attach="background" args={[isLanding ? '#243447' : '#0a0f18']} />
              <ambientLight intensity={isLanding ? 0.95 : 0.55} />
              <directionalLight position={[4, 8, 4]} intensity={isLanding ? 1.85 : 1.1} />
              <directionalLight position={[-3, 4, -2]} intensity={isLanding ? 0.75 : 0.35} />
              {isLanding ? (
                <>
                  <directionalLight position={[0, 3, 7]} intensity={0.55} color="#e0f2fe" />
                  <hemisphereLight args={['#bae6fd', '#475569', 0.45]} />
                </>
              ) : null}
              <Suspense fallback={<SceneLoader />}>
                <CaptainHemaModel
                  hoveredRegion={hoveredRegion}
                  onHoverRegion={handleHoverRegion}
                  onMuscleSelect={handleMuscleSelect}
                />
              </Suspense>
              <OrbitControls
                ref={orbitControlsRef}
                target={DEFAULT_CAMERA.target}
                enabled={isCinematicSettled}
                enableZoom
                enablePan={false}
                minDistance={viewport.minDistance}
                maxDistance={viewport.maxDistance}
                zoomSpeed={viewport.zoomSpeed}
                makeDefault
              />
              <CinematicCamera
                selectedRegion={selectedMuscle}
                onSettled={handleCinematicSettled}
                orbitControlsRef={orbitControlsRef}
                defaultCameraRef={defaultCameraRef}
              />
            </Canvas>
          </CanvasErrorBoundary>
        </>
      )}
    </div>
  )
}
