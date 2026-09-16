'use client';

import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import {
  Building,
  TownTree,
  Lantern,
  Petals,
} from '@/components/world/town-environment';
import { TOWN_BUILDINGS } from '@/lib/game/world-layout';

function Inlay({
  x,
  z,
  color,
  scale = 1,
}: {
  x: number;
  z: number;
  color: string;
  scale?: number;
}) {
  return (
    <group
      position={[x, 0.026, z]}
      scale={scale}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh>
        <ringGeometry args={[0.92, 0.935, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[0.85, 0.87, 4]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

export const SakuraArena = memo(function SakuraArena({
  reducedMotion,
  owner,
  particles,
}: {
  reducedMotion: boolean;
  owner: number;
  particles: boolean;
}) {
  const cloth = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#233c4b';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = y % 8 ? '#2b4652' : '#29404d';
      ctx.fillRect(0, y, 256, 1);
    }
    for (let x = 0; x < 256; x += 4) {
      ctx.fillStyle = '#c9c9bb08';
      ctx.fillRect(x, 0, 1, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 4);
    texture.anisotropy = 4;
    return texture;
  }, []);
  useEffect(() => () => cloth.dispose(), [cloth]);
  return (
    <>
      <color attach="background" args={['#c1b5bd']} />
      <fog attach="fog" args={['#cbb8ba', 19, 43]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#ffecd9', '#798eab', 1.55]} />
      <directionalLight
        position={[-7, 12, 5]}
        intensity={2.1}
        color="#ffe0ba"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-normalBias={0.025}
      />
      <mesh
        position={[0, -0.58, -3]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 70]} />
        <meshStandardMaterial color="#c5bab1" roughness={0.96} />
      </mesh>
      <gridHelper
        args={[50, 50, '#b3a79d', '#b9afa7']}
        position={[0, -0.572, -3]}
      />
      <group position={[0, -0.55, -1]}>
        {TOWN_BUILDINGS.slice(0, 4).map((building, index) => (
          <Building
            key={index}
            building={{ ...building, z: -11.3, height: building.height * 0.75 }}
            index={index}
            reducedMotion={reducedMotion}
          />
        ))}
        {[
          [-8, -4.7],
          [8, -4.8],
          [-9.3, 2.7],
          [9.3, 3],
        ].map(([x, z], index) => (
          <TownTree
            key={index}
            x={x}
            z={z}
            blossom
            reducedMotion={reducedMotion}
          />
        ))}
        {[-7.4, 7.4].map((x) => (
          <group key={x} position={[x, 0, -5.5]}>
            <mesh castShadow position={[0, 1.45, 0]}>
              <cylinderGeometry args={[0.1, 0.14, 2.9, 8]} />
              <meshStandardMaterial color="#4c4a55" />
            </mesh>
            <mesh position={[0, 2.9, 0]}>
              <boxGeometry args={[0.82, 0.13, 0.82]} />
              <meshStandardMaterial color="#534957" />
            </mesh>
            <Lantern
              position={[0, 2.8, 0]}
              reducedMotion={reducedMotion}
              phase={x}
            />
          </group>
        ))}
        {[-6, -3, 0, 3, 6].map((x) => (
          <group key={x} position={[x, 0.4, -7.4]}>
            <mesh castShadow>
              <boxGeometry args={[2.8, 0.14, 0.2]} />
              <meshStandardMaterial color="#90665d" />
            </mesh>
            <mesh position={[1.4, -0.1, 0]}>
              <boxGeometry args={[0.18, 0.8, 0.25]} />
              <meshStandardMaterial color="#90665d" />
            </mesh>
          </group>
        ))}
      </group>
      {/* Lacquered tournament dais: the card plane remains at the original engine coordinates. */}
      <RoundedBox
        args={[14.45, 0.34, 9.85]}
        radius={0.15}
        smoothness={3}
        position={[0, -0.32, -0.32]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color="#3d353f"
          roughness={0.6}
          metalness={0.16}
        />
      </RoundedBox>
      <RoundedBox
        args={[14.12, 0.14, 9.5]}
        radius={0.06}
        smoothness={3}
        position={[0, -0.1, -0.32]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#c3a978"
          roughness={0.43}
          metalness={0.4}
        />
      </RoundedBox>
      <RoundedBox
        args={[13.94, 0.1, 9.32]}
        radius={0.04}
        smoothness={3}
        position={[0, -0.045, -0.32]}
        receiveShadow
      >
        <meshStandardMaterial map={cloth} roughness={0.86} />
      </RoundedBox>
      {[-4.92, 4.28].map((z, i) => (
        <mesh key={z} position={[0, 0.017, z]}>
          <boxGeometry args={[12.9, 0.025, 0.025]} />
          <meshBasicMaterial
            color={i ? '#73d6ed' : '#ec888d'}
            transparent
            opacity={owner === (i ? 0 : 1) ? 0.92 : 0.3}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.019, -0.86]}>
        <boxGeometry args={[12.5, 0.012, 0.016]} />
        <meshBasicMaterial color="#c6ad80" transparent opacity={0.26} />
      </mesh>
      <Inlay x={0} z={-0.86} color="#d8c195" scale={1.4} />
      {[0, 1].flatMap((player) =>
        [-2.23, 0, 2.23].map((x) => (
          <Inlay
            key={`${player}-${x}`}
            x={x}
            z={player ? -2.42 : 0.72}
            color={player ? '#efa3ac' : '#95dced'}
          />
        )),
      )}
      {[
        [-5.55, 2.25],
        [-4.25, 2.45],
        [5.55, 2.25],
        [5.55, -2.65],
        [4.25, -2.8],
        [-5.55, -2.65],
      ].map(([x, z], index) => (
        <group
          key={index}
          position={[x, 0.02, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <mesh>
            <planeGeometry args={[1.32, 1.85]} />
            <meshBasicMaterial color="#bea77c" transparent opacity={0.21} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[1.28, 1.81]} />
            <meshBasicMaterial color="#263c48" />
          </mesh>
        </group>
      ))}
      {particles && <Petals reducedMotion={reducedMotion} />}
    </>
  );
});
