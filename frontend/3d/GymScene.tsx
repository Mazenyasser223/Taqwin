
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { FitnessOrbContent } from './FitnessOrb';
import { Dumbbell, Kettlebell, WeightPlate, Barbell, WorkoutBench, YogaMat, HexDumbbell, MedicineBall, SpeedRope, FoamRoller } from './GymGear';
import { Float, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { useConfigStore } from '../store/useConfigStore';
import { BRAND_ORANGE, BRAND_TEAL } from '../lib/brandColors';

// Aliases for intrinsic elements to satisfy JSX type checks
const Group = 'group' as any;
const AmbientLight = 'ambientLight' as any;
const PointLight = 'pointLight' as any;
const SpotLight = 'spotLight' as any;

export const GymScene: React.FC<{ staticFallback?: React.ReactNode; showOrb?: boolean }> = ({
  staticFallback,
  showOrb = true,
}) => {
  const { performanceMode } = useConfigStore();

  if (performanceMode) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background -z-10">{staticFallback}</div>;
  }

  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
      <Canvas shadows dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={50} />
        
        <Suspense fallback={null}>
          <Group>
            {/* Core Energy source / particle field */}
            <FitnessOrbContent showSphere={showOrb} />

            {/* Orbiting Satellites - Adjusted for full background feel */}
            <Float speed={1.2} rotationIntensity={1} floatIntensity={2}>
              <Barbell position={[-6, 4, -8]} scale={0.6} rotation={[0, 0.5, 0.2]} />
            </Float>

            <Float speed={1.5} rotationIntensity={2} floatIntensity={1.5}>
              <Dumbbell position={[-10, 2, -4]} scale={0.8} />
            </Float>

            <Float speed={1} rotationIntensity={2} floatIntensity={1.2}>
              <HexDumbbell position={[10, 5, -5]} scale={0.9} />
            </Float>
            
            <Float speed={2} rotationIntensity={1.5} floatIntensity={2.5}>
              <Kettlebell position={[8, -3, -3]} scale={1.1} />
            </Float>

            <Float speed={1.8} rotationIntensity={3} floatIntensity={4}>
              <WeightPlate position={[-8, -6, -6]} scale={0.7} />
            </Float>

            <Float speed={1.4} rotationIntensity={1.2} floatIntensity={2}>
              <MedicineBall position={[-12, -2, -2]} scale={1} />
            </Float>

            <Float speed={2.2} rotationIntensity={2} floatIntensity={3}>
              <SpeedRope position={[2, -8, -4]} scale={1.2} />
            </Float>

            <Float speed={1.3} rotationIntensity={1} floatIntensity={1}>
              <FoamRoller position={[-4, 7, -6]} scale={0.9} />
            </Float>

            <Float speed={0.8} rotationIntensity={0.5} floatIntensity={0.8}>
              <WorkoutBench position={[12, 0, -10]} scale={0.6} rotation={[0.5, 0.8, 0.5]} />
            </Float>

            <Float speed={1.6} rotationIntensity={1} floatIntensity={1.5}>
              <YogaMat position={[6, -9, -7]} scale={1.4} />
            </Float>
          </Group>

          {/* Lighting optimized for immersion */}
          <AmbientLight intensity={0.4} />
          <SpotLight position={[15, 15, 15]} angle={0.3} penumbra={1} intensity={5} castShadow color={BRAND_TEAL} />
          <PointLight position={[-15, 10, -10]} intensity={4} color={BRAND_ORANGE} />
          <PointLight position={[0, -15, 5]} intensity={2} color="#0d2b38" />

          <ContactShadows 
            position={[0, -10, 0]} 
            opacity={0.3} 
            scale={60} 
            blur={4} 
            far={15} 
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
