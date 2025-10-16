import { Canvas } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function FloatingOrb({ position, color, speed }: { position: [number, number, number]; color: string; speed: number }) {
  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={0.5}>
      <Sphere args={[0.5, 32, 32]} position={position}>
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={0.3}
          speed={2}
          roughness={0.4}
          metalness={0.1}
        />
      </Sphere>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      {/* Food-themed colored orbs */}
      <FloatingOrb position={[-4, 2, -5]} color="#FF6B35" speed={1.5} />
      <FloatingOrb position={[4, -2, -5]} color="#F7931E" speed={2} />
      <FloatingOrb position={[-3, -3, -8]} color="#4A7C59" speed={1.8} />
      <FloatingOrb position={[3, 3, -6]} color="#8B4513" speed={1.3} />
      <FloatingOrb position={[0, 0, -10]} color="#FFA07A" speed={2.2} />
      <FloatingOrb position={[-5, -1, -7]} color="#98D8C8" speed={1.6} />
      <FloatingOrb position={[5, 1, -9]} color="#FFD700" speed={1.9} />
    </>
  );
}

export const ThreeBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 opacity-30">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
};
