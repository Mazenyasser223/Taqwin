
import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, Torus, Cylinder, PerspectiveCamera, Points, PointMaterial, Box } from '@react-three/drei';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';

// Aliases for intrinsic elements to satisfy JSX type checks
const AmbientLight = 'ambientLight' as any;
const PointLight = 'pointLight' as any;
const MeshStandardMaterial = 'meshStandardMaterial' as any;
const Group = 'group' as any;
const Mesh = 'mesh' as any;
const SphereGeometry = 'sphereGeometry' as any;

// Common wrapper for page-specific 3D to ensure consistent performance checks
const SceneWrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "w-full h-full" }) => {
  const { performanceMode } = useConfigStore();
  if (performanceMode) return null;
  return (
    <div className={className}>
      <Canvas alpha dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <Suspense fallback={null}>
          <AmbientLight intensity={0.5} />
          <PointLight position={[10, 10, 10]} intensity={2} color="#158b8d" />
          <PointLight position={[-10, -10, -10]} intensity={1} color="#f37021" />
          {children}
        </Suspense>
      </Canvas>
    </div>
  );
};

export const DashboardVisual = () => (
  <SceneWrapper>
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <Torus args={[1.5, 0.02, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshStandardMaterial color="#158b8d" emissive="#158b8d" emissiveIntensity={2} />
      </Torus>
      <Torus args={[1.2, 0.01, 16, 100]} rotation={[Math.PI / 4, 0.5, 0]}>
        <MeshStandardMaterial color="#f37021" emissive="#f37021" emissiveIntensity={1} />
      </Torus>
      <Sphere args={[0.4, 32, 32]}>
        <MeshDistortMaterial color="#158b8d" speed={3} distort={0.4} />
      </Sphere>
    </Float>
  </SceneWrapper>
);

export const WorkoutsVisual = () => (
  <SceneWrapper>
    <Float speed={1.5} rotationIntensity={2} floatIntensity={1}>
      <Group rotation={[0.5, 0.5, 0]}>
        <Cylinder args={[0.05, 0.05, 3, 12]} rotation={[0, 0, Math.PI / 2]}>
          <MeshStandardMaterial color="#94a3b8" metalness={1} roughness={0.1} />
        </Cylinder>
        {[-1, -1.2, 1, 1.2].map((x, i) => (
          <Cylinder key={i} args={[0.5, 0.5, 0.15, 32]} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <MeshStandardMaterial color="#0c1a21" roughness={0.8} />
          </Cylinder>
        ))}
      </Group>
    </Float>
  </SceneWrapper>
);

export const NutritionVisual = () => (
  <SceneWrapper>
    <Float speed={3} rotationIntensity={1} floatIntensity={2}>
      <Group>
        {[
          [0, 1, 0], [1, -0.5, 0.5], [-1, -0.5, 0.5], [0, -0.5, -1]
        ].map((pos, i) => (
          <Sphere key={i} args={[0.3, 16, 16]} position={pos as any}>
            <MeshStandardMaterial color={i === 0 ? "#f37021" : "#158b8d"} emissive={i === 0 ? "#f37021" : "#158b8d"} emissiveIntensity={0.5} />
          </Sphere>
        ))}
        <Mesh rotation={[0.5, 0.5, 0]}>
          <SphereGeometry args={[1.2, 12, 12]} />
          <MeshStandardMaterial wireframe color="#158b8d" opacity={0.2} transparent />
        </Mesh>
      </Group>
    </Float>
  </SceneWrapper>
);

const ChatVisualContent = () => {
  const pointsRef = useRef<THREE.Points>(null!);
  const points = useMemo(() => {
    const p = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.005;
      pointsRef.current.rotation.x += 0.002;
    }
  });

  return (
    <>
      <Points ref={pointsRef} positions={points}>
        <PointMaterial color="#158b8d" size={0.05} transparent opacity={0.8} sizeAttenuation />
      </Points>
      <Sphere args={[1, 64, 64]}>
        <MeshDistortMaterial color="#158b8d" speed={2} distort={0.3} transparent opacity={0.4} />
      </Sphere>
    </>
  );
};

export const ChatVisual = () => (
  <SceneWrapper>
    <ChatVisualContent />
  </SceneWrapper>
);

export const CommunityVisual = () => (
  <SceneWrapper>
    <Float speed={4} rotationIntensity={0.5} floatIntensity={1}>
      <Group>
        {Array.from({ length: 3 }).map((_, i) => (
          <Torus key={i} args={[1 + i * 0.4, 0.01, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
            <MeshDistortMaterial color="#158b8d" speed={2 + i} distort={0.2} transparent opacity={0.5 - i * 0.1} />
          </Torus>
        ))}
      </Group>
    </Float>
  </SceneWrapper>
);

export const MarketplaceVisual = () => (
  <SceneWrapper>
    <Float speed={2} rotationIntensity={2} floatIntensity={1}>
      <Group>
        <Cylinder args={[1.2, 1.2, 0.2, 32]} rotation={[Math.PI / 2, 0, 0]}>
          <MeshStandardMaterial color="#f37021" metalness={1} roughness={0.1} />
        </Cylinder>
        <Torus args={[0.8, 0.05, 16, 100]} position={[0, 0, 0.11]}>
          <MeshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </Torus>
      </Group>
    </Float>
  </SceneWrapper>
);

export const TrainersVisual = () => (
  <SceneWrapper>
    <Float speed={1.5} rotationIntensity={1} floatIntensity={1.5}>
      <Group>
        <Sphere args={[1, 32, 32]}>
          <MeshStandardMaterial color="#158b8d" wireframe />
        </Sphere>
        <Torus args={[1.5, 0.01, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
          <MeshStandardMaterial color="#f37021" emissive="#f37021" emissiveIntensity={1} />
        </Torus>
      </Group>
    </Float>
  </SceneWrapper>
);

export const GymsVisual = () => (
  <SceneWrapper>
    <Float speed={1} rotationIntensity={0.5} floatIntensity={1}>
      <Box args={[1.5, 2, 1.5]}>
        <MeshStandardMaterial color="#158b8d" wireframe />
      </Box>
    </Float>
  </SceneWrapper>
);

export const OrdersVisual = () => (
  <SceneWrapper>
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <Group>
        <Box args={[1.2, 0.1, 1.2]} position={[0, 0, 0]}>
          <MeshStandardMaterial color="#158b8d" />
        </Box>
        <Box args={[1, 0.05, 1]} position={[0, 0.2, 0]}>
          <MeshStandardMaterial color="#f37021" />
        </Box>
      </Group>
    </Float>
  </SceneWrapper>
);

export const ClientsVisual = () => (
  <SceneWrapper>
    <Float speed={1.5} rotationIntensity={1} floatIntensity={1}>
      <Group>
        {[...Array(5)].map((_, i) => (
          <Sphere key={i} args={[0.2, 16, 16]} position={[Math.sin(i) * 2, Math.cos(i) * 2, 0]}>
             <MeshStandardMaterial color="#158b8d" emissive="#158b8d" emissiveIntensity={1} />
          </Sphere>
        ))}
        <Torus args={[2, 0.02, 16, 100]}>
           <MeshStandardMaterial color="#f37021" opacity={0.3} transparent />
        </Torus>
      </Group>
    </Float>
  </SceneWrapper>
);
