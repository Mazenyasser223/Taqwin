
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Torus, Cylinder, Sphere, Box, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

// Aliases for intrinsic elements to satisfy JSX type checks
const Group = 'group' as any;
const MeshStandardMaterial = 'meshStandardMaterial' as any;

const SHARED_METAL = { metalness: 0.9, roughness: 0.1, color: "#94a3b8" };
const SHARED_RUBBER = { metalness: 0.2, roughness: 0.8, color: "#0c1a21" };
const TEAL_GLOW = { emissive: "#0891b2", emissiveIntensity: 0.8, color: "#0891b2" };
const ORANGE_GLOW = { emissive: "#f97316", emissiveIntensity: 0.6, color: "#f97316" };

export const Dumbbell = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((state) => {
    groupRef.current.rotation.x += 0.01;
    groupRef.current.rotation.z += 0.005;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Cylinder args={[0.08, 0.08, 0.8, 12]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Cylinder>
      <Cylinder args={[0.32, 0.32, 0.18, 16]} position={[0, 0.35, 0]}>
        <MeshStandardMaterial {...SHARED_RUBBER} />
      </Cylinder>
      <Cylinder args={[0.32, 0.32, 0.18, 16]} position={[0, -0.35, 0]}>
        <MeshStandardMaterial {...SHARED_RUBBER} />
      </Cylinder>
    </Group>
  );
};

export const HexDumbbell = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((state) => {
    groupRef.current.rotation.y += 0.008;
    groupRef.current.rotation.x += 0.003;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Cylinder args={[0.08, 0.08, 0.7, 12]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Cylinder>
      <Cylinder args={[0.35, 0.35, 0.3, 6]} position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshStandardMaterial {...SHARED_RUBBER} />
      </Cylinder>
      <Cylinder args={[0.35, 0.35, 0.3, 6]} position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshStandardMaterial {...SHARED_RUBBER} />
      </Cylinder>
    </Group>
  );
};

export const Barbell = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    groupRef.current.rotation.y += 0.005;
    groupRef.current.rotation.z += 0.002;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Cylinder args={[0.04, 0.04, 3, 12]} rotation={[0, 0, Math.PI / 2]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Cylinder>
      {[1.2, 1.35, -1.2, -1.35].map((pos, i) => (
        <Cylinder key={i} args={[0.45, 0.45, 0.1, 24]} position={[pos, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <MeshStandardMaterial {...SHARED_RUBBER} />
        </Cylinder>
      ))}
    </Group>
  );
};

export const Kettlebell = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    groupRef.current.rotation.y += 0.012;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Sphere args={[0.42, 32, 32]} position={[0, -0.1, 0]}>
        <MeshStandardMaterial {...SHARED_RUBBER} />
      </Sphere>
      <Torus args={[0.22, 0.07, 12, 24, Math.PI]} position={[0, 0.28, 0]}>
        <MeshStandardMaterial {...TEAL_GLOW} />
      </Torus>
    </Group>
  );
};

export const WeightPlate = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    groupRef.current.rotation.z += 0.015;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Cylinder args={[0.55, 0.55, 0.12, 32]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshStandardMaterial {...TEAL_GLOW} metalness={0.6} />
      </Cylinder>
      <Cylinder args={[0.12, 0.12, 0.14, 16]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshStandardMaterial {...ORANGE_GLOW} emissiveIntensity={1} />
      </Cylinder>
    </Group>
  );
};

export const SpeedRope = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((state) => {
    groupRef.current.rotation.z += 0.02;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Torus args={[0.8, 0.01, 8, 48]} rotation={[Math.PI / 2, 0.2, 0]}>
        <MeshStandardMaterial {...TEAL_GLOW} emissiveIntensity={1} />
      </Torus>
      <Cylinder args={[0.04, 0.04, 0.3, 12]} position={[0, 0.8, 0]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Cylinder>
      <Cylinder args={[0.04, 0.04, 0.3, 12]} position={[0, -0.8, 0]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Cylinder>
    </Group>
  );
};

export const MedicineBall = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((state) => {
    groupRef.current.rotation.y += 0.01;
    groupRef.current.position.y += Math.sin(state.clock.getElapsedTime() * 2) * 0.05;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Sphere args={[0.35, 32, 32]}>
        <MeshStandardMaterial {...SHARED_RUBBER} color="#112129" />
      </Sphere>
      <Torus args={[0.36, 0.02, 16, 32]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshStandardMaterial {...ORANGE_GLOW} />
      </Torus>
    </Group>
  );
};

export const FoamRoller = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((state) => {
    groupRef.current.rotation.x += 0.005;
    groupRef.current.rotation.y += 0.005;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Cylinder args={[0.25, 0.25, 0.9, 24]}>
        <MeshStandardMaterial color="#1b323d" roughness={0.9} />
      </Cylinder>
    </Group>
  );
};

export const WorkoutBench = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    groupRef.current.rotation.y -= 0.008;
  });

  return (
    <Group ref={groupRef} {...props}>
      <RoundedBox args={[0.8, 0.15, 2]} radius={0.05} smoothness={4} position={[0, 0.4, 0]}>
        <MeshStandardMaterial {...SHARED_RUBBER} color="#0a161c" />
      </RoundedBox>
      <Box args={[0.2, 0.6, 0.2]} position={[0, 0, 0.8]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Box>
      <Box args={[0.2, 0.6, 0.2]} position={[0, 0, -0.8]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Box>
      <Box args={[1, 0.1, 0.2]} position={[0, -0.3, 0.8]}>
        <MeshStandardMaterial {...SHARED_METAL} />
      </Box>
    </Group>
  );
};

export const YogaMat = (props: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((state) => {
    groupRef.current.rotation.y += 0.006;
  });

  return (
    <Group ref={groupRef} {...props}>
      <Cylinder args={[0.15, 0.15, 1.2, 24]} rotation={[0, 0, Math.PI / 2]}>
        <MeshStandardMaterial color="#0891b2" roughness={0.9} />
      </Cylinder>
    </Group>
  );
};
