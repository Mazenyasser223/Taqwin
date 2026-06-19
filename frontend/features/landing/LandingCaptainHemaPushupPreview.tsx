import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as THREE from 'three';
import { useI18n } from '../../lib/i18n/useI18n';
import { useMotionPrefs } from '../../lib/motion';
import { CanvasErrorBoundary } from '../muscle-wiki/components/CanvasErrorBoundary';
import { MODEL_PATH } from '../muscle-wiki/components/CaptainHemaCanvas';

const PUSHUP_FBX_PATH = '/cap-hema-eye/push-up.fbx';
const MODEL_SCALE = 2;
const MODEL_BASE_Y = -0.98;

const HIPS_BONE_NAMES = [
  'mixamorigHips',
  'mixamorig:Hips',
  'Hips',
  'hips',
  'Root',
  'root',
];

function findBone(root: THREE.Object3D, names: string[]) {
  for (const name of names) {
    const bone = root.getObjectByName(name);
    if (bone) return bone;
  }
  return null;
}

function PushupCamera() {
  const { camera } = useThree();
  const lookAt = useMemo(() => new THREE.Vector3(0, 0.1, 0), []);

  useEffect(() => {
    camera.position.set(2.75, 0.55, 0.15);
    camera.lookAt(lookAt);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 40;
      camera.near = 0.1;
      camera.far = 50;
      camera.updateProjectionMatrix();
    }
  }, [camera, lookAt]);

  return null;
}

/** Shared ref: FBX mixer writes normalized phase [0..1], body reads it. */
type PhaseRef = React.MutableRefObject<number | null>;

function FbxPushupDriver({
  active,
  reduceMotion,
  phaseRef,
}: {
  active: boolean;
  reduceMotion: boolean;
  phaseRef: PhaseRef;
}) {
  const fbxSource = useLoader(FBXLoader, PUSHUP_FBX_PATH);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const hipsRef = useRef<THREE.Object3D | null>(null);
  const hipsYRef = useRef({ min: Infinity, max: -Infinity, ready: false });

  const fbx = useMemo(() => {
    const clone = fbxSource.clone(true);
    clone.scale.setScalar(0.01);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.visible = false;
    });
    hipsRef.current = findBone(clone, HIPS_BONE_NAMES);
    return clone;
  }, [fbxSource]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(fbx);
    mixerRef.current = mixer;

    const clip = fbxSource.animations[0];
    if (clip) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      if (reduceMotion) {
        action.paused = true;
        action.time = clip.duration * 0.35;
        mixer.update(0);
      }
    }

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [fbx, fbxSource, reduceMotion]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    const clip = fbxSource.animations[0];
    if (!mixer || !clip) return;

    if (active && !reduceMotion) {
      mixer.update(delta);
    }

    phaseRef.current = clip.duration > 0 ? (mixer.time % clip.duration) / clip.duration : 0;

    const hips = hipsRef.current;
    if (hips) {
      const y = hips.position.y;
      const range = hipsYRef.current;
      if (!range.ready) {
        range.min = Math.min(range.min, y);
        range.max = Math.max(range.max, y);
        if (mixer.time > clip.duration * 0.5) range.ready = true;
      } else if (range.max > range.min) {
        phaseRef.current = (y - range.min) / (range.max - range.min);
      }
    }
  });

  return <primitive object={fbx} />;
}

function PushupCaptainHemaBody({
  active,
  reduceMotion,
  phaseRef,
}: {
  active: boolean;
  reduceMotion: boolean;
  phaseRef: PhaseRef;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_PATH);
  const model = useMemo(() => scene.clone(true), [scene]);
  const clockPhase = useRef(0);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    let phase: number;
    if (phaseRef.current !== null) {
      phase = phaseRef.current;
    } else if (reduceMotion) {
      phase = 0.35;
    } else if (active) {
      clockPhase.current += delta * 0.85;
      phase = (Math.sin(clockPhase.current * Math.PI) + 1) / 2;
    } else {
      phase = 0.12;
    }

    const lift = phase * 0.12;
    group.position.y = MODEL_BASE_Y + lift;
    group.rotation.set(-Math.PI / 2 + phase * 0.05, Math.PI / 2, 0);
  });

  return (
    <group ref={groupRef} scale={MODEL_SCALE}>
      <primitive object={model} />
    </group>
  );
}

function PushupScene({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const phaseRef = useRef<number | null>(null);

  return (
    <>
      <PushupCamera />
      <color attach="background" args={['#e8e8e8']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 3]} intensity={1.65} />
      <directionalLight position={[-2, 3, -1]} intensity={0.5} />
      <hemisphereLight args={['#f8fafc', '#94a3b8', 0.4]} />

      <Suspense fallback={null}>
        <PushupCaptainHemaBody active={active} reduceMotion={reduceMotion} phaseRef={phaseRef} />
      </Suspense>

      <Suspense fallback={null}>
        <FbxPushupDriver active={active} reduceMotion={reduceMotion} phaseRef={phaseRef} />
      </Suspense>
    </>
  );
}

type Props = {
  active: boolean;
  className?: string;
};

export function LandingCaptainHemaPushupPreview({ active, className = '' }: Props) {
  const { t } = useI18n();
  const { shouldSimplify } = useMotionPrefs();

  useEffect(() => {
    useGLTF.preload(MODEL_PATH);
    useLoader.preload(FBXLoader, PUSHUP_FBX_PATH);
  }, []);

  return (
    <div className={`absolute inset-0 ${className}`}>
      <CanvasErrorBoundary
          fallback={
            <div className="flex h-full items-center justify-center bg-[#e8e8e8]">
              <span className="material-symbols-outlined text-4xl text-slate-500">accessibility_new</span>
            </div>
          }
        >
          <Canvas
            className="!h-full !w-full"
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 1.75]}
            style={{ display: 'block', width: '100%', height: '100%' }}
          >
            <PushupScene active={active} reduceMotion={shouldSimplify} />
          </Canvas>
        </CanvasErrorBoundary>

      <span className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#ADFF2F] border border-[#7CFC00]/40 backdrop-blur-sm">
        <span className="size-1.5 rounded-full bg-[#7CFC00] animate-pulse" />
        {t('landing.mockCapHemaEye3dPushup')}
      </span>
    </div>
  );
}
