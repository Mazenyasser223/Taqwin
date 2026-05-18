
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { WeightPlate } from './GymGear';
import { PerspectiveCamera } from '@react-three/drei';
import { useConfigStore } from '../store/useConfigStore';

// Aliases for intrinsic elements to satisfy JSX type checks
const AmbientLight = 'ambientLight' as any;
const PointLight = 'pointLight' as any;

export const HeaderAccent: React.FC = () => {
  const { performanceMode } = useConfigStore();

  if (performanceMode) return null;

  return (
    <div className="absolute right-0 top-0 w-48 h-full pointer-events-none opacity-40">
      <Canvas gl={{ alpha: true }} dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault position={[0, 0, 3]} />
        <Suspense fallback={null}>
          <WeightPlate position={[1, 0, 0]} scale={1.2} />
          <AmbientLight intensity={0.5} />
          <PointLight position={[5, 5, 5]} intensity={1} color="#13a4ec" />
        </Suspense>
      </Canvas>
    </div>
  );
};
