import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ParticleSphere = ({ status }) => {
  const pointsRef = useRef();
  const particleCount = 2000;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 1.6 + Math.random() * 0.3;

    positions[i] = r * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i + 2] = r * Math.cos(phi);
  }

  useFrame((state) => {
    const { clock } = state;
    if (pointsRef.current) {
      // Status er upor base kore speed change hobe
      let speed = 0.5;
      if (status === 'listening') speed = 1.5;
      if (status === 'thinking') speed = 3.0;
      if (status === 'speaking') speed = 2.0;

      pointsRef.current.rotation.y = clock.getElapsedTime() * speed;
      pointsRef.current.rotation.x = clock.getElapsedTime() * (speed * 0.5);

      if (status === 'speaking' || status === 'thinking') {
        const scale = 1 + Math.sin(clock.getElapsedTime() * 15) * 0.1;
        pointsRef.current.scale.set(scale, scale, scale);
      } else {
        pointsRef.current.scale.set(1, 1, 1);
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        color="#ff3366"
        transparent={true}
        opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default function AssistantOrb({ status }) {
  return (
    <div style={{ width: '220px', height: '220px', margin: '10px auto' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.6} />
        <ParticleSphere status={status} />
      </Canvas>
    </div>
  );
}