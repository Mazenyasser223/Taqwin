import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { FitnessOrbContent } from '../../../3d/FitnessOrb';
import { useConfigStore } from '../../../store/useConfigStore';

export const OnboardingHero3D: React.FC<{ className?: string }> = ({ className = 'h-44 w-full' }) => {
  const { performanceMode } = useConfigStore();
  if (performanceMode) {
    return (
      <div
        className={`${className} rounded-3xl bg-gradient-to-br from-primary/25 via-surface to-accent/15 border border-subtle`}
      />
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${className} rounded-3xl overflow-hidden border border-subtle bg-[#0a1218] relative`}
    >
      <Canvas gl={{ alpha: true, antialias: true }} dpr={[1, 1.5]} className="!absolute inset-0">
        <PerspectiveCamera makeDefault position={[0, 0, 5.5]} fov={42} />
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <FitnessOrbContent />
        </Suspense>
      </Canvas>
      <motion.div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
    </motion.div>
  );
};
