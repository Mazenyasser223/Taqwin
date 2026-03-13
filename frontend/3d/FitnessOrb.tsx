
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';

// Aliases for intrinsic elements to satisfy JSX type checks
const Group = 'group' as any;
const PointLight = 'pointLight' as any;

export const FitnessOrbContent = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const pointsRef = useRef<THREE.Points>(null!);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.12;
      meshRef.current.rotation.z = time * 0.08;
      // Heartbeat pulse effect
      const pulse = 1 + Math.sin(time * 1.5) * 0.08;
      meshRef.current.scale.set(pulse, pulse, pulse);
    }
    if (pointsRef.current) {
      pointsRef.current.rotation.y = -time * 0.04;
      pointsRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
  });

  const particlePositions = useMemo(() => {
    const count = 1500; // Increased density
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const phi = THREE.MathUtils.randFloat(0, Math.PI);
      const r = THREE.MathUtils.randFloat(2.5, 5.0); // Wider spread
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  return (
    <Group>
      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.3}>
        <Sphere ref={meshRef} args={[1.8, 64, 64]}>
          <MeshDistortMaterial
            color="#0891b2"
            speed={2.5}
            distort={0.4} 
            radius={1}
            emissive="#0891b2"
            emissiveIntensity={1.2}
            metalness={1}
            roughness={0}
            transparent
            opacity={0.85}
          />
        </Sphere>
      </Float>
      
      <Points ref={pointsRef} positions={particlePositions}>
        <PointMaterial
          transparent
          color="#f97316" // Orange particles for energy contrast
          size={0.05}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.7}
        />
      </Points>

      {/* Split Core Glow: Teal and Orange */}
      <PointLight position={[1, 1, 1]} intensity={2} color="#0891b2" />
      <PointLight position={[-1, -1, -1]} intensity={1.5} color="#f97316" />
    </Group>
  );
};
