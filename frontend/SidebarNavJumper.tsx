import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useAnimations, useFBX } from '@react-three/drei'
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import * as THREE from 'three'

const JUMP_MODEL_PATH = '/Jumping%20Down.fbx'
const MASCOT_WIDTH = 120
const MASCOT_HEIGHT = 200
/** Padding from the Muscle Wiki row edge (inside the nav link). */
const MASCOT_EDGE_INSET_PX = -30
/** Pixels from canvas bottom to feet — align feet on the nav row baseline. */
const FEET_INSET_FROM_CANVAS_BOTTOM_PX = 70
const MODEL_CANVAS_Y_OFFSET = -0.35

useFBX.preload(JUMP_MODEL_PATH)

export interface SidebarNavJumperProps {
  /** Muscle Wiki nav link — mascot stays anchored beside this row. */
  anchorRef: RefObject<HTMLElement | null>
  navRef: RefObject<HTMLElement | null>
  /** Increment to replay Jumping Down.fbx (e.g. on Muscle Wiki click). */
  jumpTrigger: number
  isRtl?: boolean
}

function fitModelToView(root: THREE.Object3D, targetHeight = 1.15) {
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) return

  const size = box.getSize(new THREE.Vector3())
  const scale = targetHeight / Math.max(size.y, 0.001)
  root.scale.setScalar(scale)

  box.setFromObject(root)
  root.position.set(-box.getCenter(new THREE.Vector3()).x, -box.min.y, -box.getCenter(new THREE.Vector3()).z)
  root.position.y += MODEL_CANVAS_Y_OFFSET
}

function tuneMaterialForSidebar(material: THREE.Material) {
  if (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhysicalMaterial
  ) {
    material.roughness = 0.2
    material.metalness = 0.5
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace
    material.needsUpdate = true
    return
  }

  if (material instanceof THREE.MeshPhongMaterial) {
    material.shininess = 28
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace
    material.needsUpdate = true
  }
}

function prepareFbxForSidebar(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    mesh.castShadow = true
    mesh.receiveShadow = false

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (material) tuneMaterialForSidebar(material)
    }
  })
}

type MascotPhase = 'jumping' | 'landed'

function freezeAtLastFrame(action: THREE.AnimationAction) {
  const clip = action.getClip()
  action.clampWhenFinished = true
  action.time = Math.max(0, clip.duration - 0.001)
  action.paused = true
}

function JumperCharacter({
  phase,
  onJumpFinished,
  onReady,
}: {
  phase: MascotPhase
  onJumpFinished: () => void
  onReady: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const fbx = useFBX(JUMP_MODEL_PATH)
  const { actions, mixer, names } = useAnimations(fbx.animations, groupRef)
  const finishedRef = useRef(onJumpFinished)
  const readyRef = useRef(false)

  finishedRef.current = onJumpFinished

  useLayoutEffect(() => {
    if (fbx.userData.sidebarFittedV3) return
    prepareFbxForSidebar(fbx)
    fitModelToView(fbx)
    fbx.userData.sidebarFittedV3 = true
  }, [fbx])

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true
      onReady()
    }
  }, [fbx, onReady])

  useEffect(() => {
    const clipName = names[0]
    if (!clipName) return
    const action = actions[clipName]
    if (!action) return

    if (phase === 'jumping') {
      action.reset()
      action.paused = false
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      return
    }

    if (action.time > 0.01) freezeAtLastFrame(action)
  }, [phase, actions, names, mixer])

  useFrame(() => {
    if (phase !== 'jumping') return
    const clipName = names[0]
    if (!clipName) return
    const action = actions[clipName]
    if (!action || !action.isRunning()) return

    const clip = action.getClip()
    if (action.time >= clip.duration - 0.02) {
      freezeAtLastFrame(action)
      finishedRef.current()
    }
  })

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[2.4, 2.4]} />
        <shadowMaterial transparent opacity={0.42} color="#000000" />
      </mesh>
      <primitive object={fbx} />
      <ambientLight intensity={0.3} color="#b8e8f0" />
      <directionalLight
        position={[2, 7, 4]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-left={-1.2}
        shadow-camera-right={1.2}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-0.2}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
      />
      <directionalLight position={[-3, 2, 2]} intensity={0.4} />
    </group>
  )
}

function SidebarCamera() {
  const camera = useThree((s) => s.camera)

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return
    camera.position.set(2.5, 0.52, 12)
    camera.lookAt(0, 0.52, 0)
    camera.updateProjectionMatrix()
  }, [camera])

  return null
}

function JumperScene({
  phase,
  onJumpFinished,
  onReady,
}: {
  phase: MascotPhase
  onJumpFinished: () => void
  onReady: () => void
}) {
  return (
    <Canvas
      orthographic
      shadows
      frameloop="always"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
      camera={{ zoom: 105, position: [6, 0.52, 12], near: 0.1, far: 50 }}
      style={{
        display: 'block',
        width: MASCOT_WIDTH,
        height: MASCOT_HEIGHT,
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <SidebarCamera />
      <Suspense fallback={null}>
        <JumperCharacter phase={phase} onJumpFinished={onJumpFinished} onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}

export function SidebarNavJumper({ anchorRef, navRef, jumpTrigger, isRtl = false }: SidebarNavJumperProps) {
  const [anchorPos, setAnchorPos] = useState<{ top: number; left: number } | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [phase, setPhase] = useState<MascotPhase>('jumping')
  const lastJumpTriggerRef = useRef(0)
  const hasInitialJumpRef = useRef(false)

  const measureAnchor = useCallback(() => {
    const btn = anchorRef.current
    if (!btn) return

    const top = btn.offsetTop + btn.offsetHeight
    const left = isRtl
      ? btn.offsetLeft + MASCOT_EDGE_INSET_PX
      : btn.offsetLeft + btn.offsetWidth - MASCOT_WIDTH - MASCOT_EDGE_INSET_PX

    setAnchorPos({ top, left })
  }, [anchorRef, isRtl])

  useLayoutEffect(() => {
    measureAnchor()
    const raf = requestAnimationFrame(measureAnchor)

    const nav = navRef.current
    const btn = anchorRef.current
    if (!nav) return () => cancelAnimationFrame(raf)

    const observer = new ResizeObserver(measureAnchor)
    observer.observe(nav)
    if (btn) observer.observe(btn)
    window.addEventListener('resize', measureAnchor)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', measureAnchor)
    }
  }, [measureAnchor, navRef, anchorRef])

  const handleJumpFinished = useCallback(() => {
    setPhase('landed')
  }, [])

  const handleModelReady = useCallback(() => {
    setModelReady(true)
  }, [])

  useEffect(() => {
    if (!modelReady || hasInitialJumpRef.current) return
    hasInitialJumpRef.current = true
    setPhase('jumping')
  }, [modelReady])

  useEffect(() => {
    if (!hasInitialJumpRef.current) return
    if (jumpTrigger === 0 || jumpTrigger === lastJumpTriggerRef.current) return
    lastJumpTriggerRef.current = jumpTrigger
    setPhase('jumping')
  }, [jumpTrigger])

  if (anchorPos == null) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 overflow-visible"
      style={{
        top: anchorPos.top,
        left: anchorPos.left,
        transform: `translate(0, calc(-100% + ${FEET_INSET_FROM_CANVAS_BOTTOM_PX}px))`,
        opacity: modelReady ? 1 : 0.35,
        transition: modelReady ? 'opacity 0.4s ease' : 'none',
      }}
    >
      <div
        style={{ width: MASCOT_WIDTH, height: MASCOT_HEIGHT, minWidth: MASCOT_WIDTH, minHeight: MASCOT_HEIGHT }}
      >
        <JumperScene phase={phase} onJumpFinished={handleJumpFinished} onReady={handleModelReady} />
      </div>
    </div>
  )
}
