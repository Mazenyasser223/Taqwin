import React, { Suspense, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerspectiveCamera, Stars } from '@react-three/drei';
import {
  Barbell,
  Dumbbell,
  FoamRoller,
  HexDumbbell,
  Kettlebell,
  MedicineBall,
  SpeedRope,
  WeightPlate,
  WorkoutBench,
  YogaMat,
} from '../../../3d/GymGear';
import { FitnessOrbContent } from '../../../3d/FitnessOrb';
import { useConfigStore } from '../../../store/useConfigStore';
import type { QuestionnaireFlowId } from '../flows/types';

const AmbientLight = 'ambientLight' as any;
const PointLight = 'pointLight' as any;

type GearComponent = React.ComponentType<Record<string, unknown>>;

interface GearPlacement {
  Component: GearComponent;
  position: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
  speed?: number;
  floatIntensity?: number;
  rotationIntensity?: number;
}

function FloatingGear({
  Component,
  position,
  scale = 1,
  rotation = [0, 0, 0],
  speed = 1.4,
  floatIntensity = 0.55,
  rotationIntensity = 0.3,
}: GearPlacement) {
  return (
    <Float speed={speed} floatIntensity={floatIntensity} rotationIntensity={rotationIntensity}>
      <Component position={position} scale={scale} rotation={rotation} />
    </Float>
  );
}

function GearField({ items }: { items: GearPlacement[] }) {
  return (
    <>
      {items.map((item, i) => (
        <FloatingGear key={`${item.Component.name}-${i}`} {...item} />
      ))}
    </>
  );
}

/** Shared gym props visible in every flow (edges of the scene). */
const BASE_GYM_GEAR: GearPlacement[] = [
  { Component: Dumbbell, position: [-3.6, 0.5, -2.2], scale: 0.55, rotation: [0.5, 0.4, 0.2], speed: 1.2 },
  { Component: HexDumbbell, position: [3.8, 0.2, -2], scale: 0.5, rotation: [0.1, -0.6, 0.15], speed: 1.35 },
  { Component: WeightPlate, position: [-2.2, -1.4, -2.8], scale: 0.38, rotation: [0.3, 0.8, 0.1], speed: 1.5, floatIntensity: 0.45 },
  { Component: Kettlebell, position: [2.4, -1.3, -2.6], scale: 0.42, rotation: [0.2, 0.3, 0], speed: 1.25 },
  { Component: Dumbbell, position: [0.8, 2.1, -3], scale: 0.35, rotation: [1.1, 0.5, 0.4], speed: 1.6, floatIntensity: 0.4 },
  { Component: WeightPlate, position: [-3.8, 1.6, -2.4], scale: 0.32, rotation: [0.6, -0.2, 0.5], speed: 1.7 },
  { Component: HexDumbbell, position: [3.2, -1.8, -2.5], scale: 0.4, rotation: [0.3, 0.4, 0.2], speed: 1.45 },
  { Component: Dumbbell, position: [-1.1, 2.4, -2.8], scale: 0.38, rotation: [0.8, -0.2, 0.3], speed: 1.55 },
  { Component: Dumbbell, position: [4.1, 1.4, -2.3], scale: 0.36, rotation: [0.2, 0.9, 0.1], speed: 1.5 },
];

const FLOW_GEAR: Record<QuestionnaireFlowId, GearPlacement[]> = {
  core: [
    { Component: Dumbbell, position: [-2.5, 0.1, -1.3], scale: 0.78, rotation: [0.4, 0.5, 0.1], speed: 1.3 },
    { Component: HexDumbbell, position: [2.9, -0.15, -1.2], scale: 0.72, rotation: [0.2, -0.4, 0.15], speed: 1.45 },
    { Component: Barbell, position: [-0.5, -0.8, -1.8], scale: 0.42, rotation: [0.15, 0.9, 0.25], speed: 1.1 },
    { Component: WeightPlate, position: [1.8, 1.5, -1.9], scale: 0.48, speed: 1.55 },
    { Component: Kettlebell, position: [-1.8, 1.2, -1.6], scale: 0.58, speed: 1.35 },
    { Component: Dumbbell, position: [3.5, 1.1, -2.1], scale: 0.45, rotation: [0.7, -0.3, 0.6], speed: 1.65, floatIntensity: 0.5 },
    { Component: MedicineBall, position: [-3.1, -0.6, -1.5], scale: 0.55, speed: 1.4 },
    { Component: HexDumbbell, position: [0.2, -1.4, -1.9], scale: 0.4, rotation: [0.4, 0.2, 0.5], speed: 1.5 },
    { Component: Dumbbell, position: [-3.4, 1.5, -1.8], scale: 0.4, rotation: [0.6, 0.3, 0.2], speed: 1.6 },
  ],
  workout: [
    { Component: Barbell, position: [-2.6, 0.15, -1.4], scale: 0.58, rotation: [0.2, 0.6, 0.3], speed: 1.15 },
    { Component: HexDumbbell, position: [3.1, -0.35, -1.1], scale: 0.68, rotation: [0.1, -0.5, 0.2], speed: 1.4 },
    { Component: Dumbbell, position: [-1.2, 1.3, -1.7], scale: 0.62, rotation: [0.5, 0.2, 0.3], speed: 1.25 },
    { Component: Dumbbell, position: [1.5, 1.4, -1.6], scale: 0.58, rotation: [-0.3, 0.7, 0.1], speed: 1.3 },
    { Component: WeightPlate, position: [2.3, 1.2, -1.9], scale: 0.52, speed: 1.6 },
    { Component: WeightPlate, position: [-2.8, -0.9, -1.8], scale: 0.44, rotation: [0.4, 1.2, 0], speed: 1.55 },
    { Component: WorkoutBench, position: [0.2, -1.1, -2.2], scale: 0.35, rotation: [0, 0.4, 0], speed: 1.05, floatIntensity: 0.4 },
    { Component: Kettlebell, position: [-3.2, 0.8, -1.5], scale: 0.52, speed: 1.35 },
    { Component: SpeedRope, position: [3.4, 0.9, -2], scale: 0.38, rotation: [0.3, 0, 0.2], speed: 1.75, floatIntensity: 0.65 },
    { Component: HexDumbbell, position: [0.6, 0.5, -1.2], scale: 0.4, rotation: [0.9, 0.1, 0.5], speed: 1.5 },
    { Component: Dumbbell, position: [-0.8, -1.5, -2], scale: 0.5, rotation: [0.3, 0.4, 0.6], speed: 1.35 },
    { Component: WeightPlate, position: [3.6, -0.6, -2.2], scale: 0.36, speed: 1.7 },
  ],
  diet: [
    { Component: Kettlebell, position: [-2.4, 0.45, -1.35], scale: 0.68, speed: 1.35 },
    { Component: MedicineBall, position: [2.8, -0.25, -1.5], scale: 0.72, speed: 1.45 },
    { Component: Dumbbell, position: [1.2, 1.3, -1.7], scale: 0.52, rotation: [0.3, 0.6, 0.2], speed: 1.3 },
    { Component: HexDumbbell, position: [-1.5, -0.9, -1.6], scale: 0.48, rotation: [0.2, -0.3, 0.4], speed: 1.4 },
    { Component: WeightPlate, position: [3.2, 0.7, -2], scale: 0.4, speed: 1.6 },
    { Component: Dumbbell, position: [-3, -0.3, -1.8], scale: 0.42, rotation: [0.8, 0.5, 0.3], speed: 1.55 },
    { Component: MedicineBall, position: [0.4, -1.2, -2.1], scale: 0.48, speed: 1.25, floatIntensity: 0.5 },
  ],
  wellness: [
    { Component: MedicineBall, position: [-2.2, 0.05, -1.45], scale: 0.62, speed: 1.3 },
    { Component: Kettlebell, position: [2.9, 0.55, -1.25], scale: 0.58, rotation: [0.3, 0.2, 0], speed: 1.45 },
    { Component: YogaMat, position: [-1, -1, -2], scale: 0.42, rotation: [0, 0.5, 0], speed: 1.1, floatIntensity: 0.4 },
    { Component: FoamRoller, position: [1.6, -0.85, -1.9], scale: 0.48, rotation: [0.4, 0.8, 0.2], speed: 1.35 },
    { Component: Dumbbell, position: [3.3, -0.5, -1.7], scale: 0.5, rotation: [0.5, -0.4, 0.2], speed: 1.4 },
    { Component: HexDumbbell, position: [-2.9, 1.1, -1.8], scale: 0.44, rotation: [0.1, 0.7, 0.3], speed: 1.5 },
    { Component: WeightPlate, position: [0.3, 1.6, -2.2], scale: 0.38, speed: 1.65, floatIntensity: 0.45 },
  ],
};

function FlowGear({ flow }: { flow: QuestionnaireFlowId }) {
  const groupRef = useRef<THREE.Group>(null!);
  const backRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y = t * 0.035;
    if (backRef.current) backRef.current.rotation.y = -t * 0.018;
  });

  return (
    <group>
      <group ref={backRef}>
        <GearField items={BASE_GYM_GEAR} />
      </group>
      <group ref={groupRef}>
        <GearField items={FLOW_GEAR[flow]} />
      </group>
    </group>
  );
}

function SceneContent({ flow }: { flow: QuestionnaireFlowId }) {
  return (
    <>
      <AmbientLight intensity={0.35} />
      <PointLight position={[4, 4, 6]} intensity={2.2} color="#1a8a8a" />
      <PointLight position={[-5, -2, 4]} intensity={1.4} color="#f37021" />
      <PointLight position={[0, 3, -2]} intensity={0.8} color="#c9a84c" />
      <Stars radius={90} depth={50} count={1800} factor={4} saturation={0.65} fade speed={0.35} />
      <FitnessOrbContent showSphere={false} />
      <FlowGear flow={flow} />
    </>
  );
}

interface QuestionnaireAmbient3DProps {
  flow: QuestionnaireFlowId;
  className?: string;
}

export const QuestionnaireAmbient3D: React.FC<QuestionnaireAmbient3DProps> = ({
  flow,
  className = 'absolute inset-0',
}) => {
  const { performanceMode } = useConfigStore();

  if (performanceMode) return null;

  return (
    <div className={`${className} pointer-events-none opacity-[0.62] sm:opacity-[0.78] lg:opacity-[0.72]`} aria-hidden>
      <Canvas gl={{ alpha: true, antialias: true }} dpr={[1, 1.35]} className="!absolute inset-0">
        <PerspectiveCamera makeDefault position={[0, 0, 8.2]} fov={52} />
        <Suspense fallback={null}>
          <SceneContent flow={flow} />
        </Suspense>
      </Canvas>
    </div>
  );
};

const SPARKLE_COUNT = 42;

const GYM_FLOAT_ICONS: { icon: string; className: string }[] = [
  { icon: 'star', className: 'text-primary/40 text-2xl top-[12%] start-[8%]' },
  { icon: 'star', className: 'text-accent/35 text-xl top-[22%] end-[12%] [animation-delay:0.8s]' },
  { icon: 'fitness_center', className: 'text-primary/35 text-3xl bottom-[28%] start-[6%] [animation-delay:1.4s]' },
  { icon: 'bolt', className: 'text-accent/30 text-2xl bottom-[18%] end-[8%] [animation-delay:0.3s]' },
  { icon: 'exercise', className: 'text-primary/25 text-2xl top-[38%] start-[4%] [animation-delay:1.1s]' },
  { icon: 'sports_gymnastics', className: 'text-accent/28 text-xl top-[8%] end-[22%] [animation-delay:0.5s]' },
  { icon: 'monitor_weight', className: 'text-primary/22 text-2xl bottom-[38%] end-[5%] [animation-delay:1.8s]' },
  { icon: 'directions_run', className: 'text-accent/22 text-xl top-[55%] end-[6%] [animation-delay:0.9s]' },
  { icon: 'self_improvement', className: 'text-primary/20 text-2xl bottom-[12%] start-[18%] [animation-delay:1.2s]' },
  { icon: 'sports_martial_arts', className: 'text-accent/25 text-xl top-[65%] start-[10%] [animation-delay:0.6s]' },
];

const FLOW_ORB_CLASS: Record<QuestionnaireFlowId, string> = {
  core: 'from-primary/30 via-transparent to-accent/20',
  workout: 'from-orange-500/25 via-transparent to-primary/15',
  diet: 'from-emerald-500/22 via-transparent to-primary/18',
  wellness: 'from-violet-500/22 via-transparent to-primary/15',
};

export const QuestionnaireSparkleLayer: React.FC<{ flow: QuestionnaireFlowId }> = ({ flow }) => {
  const sparkles = useMemo(
    () =>
      Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
        id: i,
        left: `${(i * 17 + 7) % 100}%`,
        top: `${(i * 23 + 11) % 100}%`,
        size: 2 + (i % 4),
        delay: (i % 7) * 0.35,
        duration: 2.2 + (i % 5) * 0.4,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className={`absolute -top-[20%] -start-[15%] w-[70%] h-[55%] rounded-full bg-gradient-to-br ${FLOW_ORB_CLASS[flow]} blur-3xl opacity-80 questionnaire-orb-drift`}
      />
      <div
        className={`absolute -bottom-[25%] -end-[10%] w-[65%] h-[50%] rounded-full bg-gradient-to-br ${FLOW_ORB_CLASS[flow]} blur-3xl opacity-70 questionnaire-orb-drift-reverse`}
      />
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[70%] rounded-full bg-primary/5 blur-[80px]" />

      {sparkles.map((s) => (
        <span
          key={s.id}
          className="questionnaire-sparkle absolute rounded-full bg-white"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}

      {GYM_FLOAT_ICONS.map(({ icon, className }) => (
        <span
          key={icon + className}
          className={`material-symbols-outlined questionnaire-star-float absolute ${className}`}
        >
          {icon}
        </span>
      ))}
    </div>
  );
};

export const QuestionnaireAmbientBackground: React.FC<{ flow: QuestionnaireFlowId }> = ({
  flow,
}) => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-[#060d12]">
    <QuestionnaireSparkleLayer flow={flow} />
    <QuestionnaireAmbient3D flow={flow} />
    <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/35 to-background/75 lg:from-background/20 lg:via-background/55 lg:to-background/90" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_88%)] lg:bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_78%)]" />
  </div>
);
