'use client';

import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';

export interface CharacterMovement {
  speed: number;
}
interface ChibiProps {
  color: string;
  variant?: string;
  movement?: RefObject<CharacterMovement>;
  talking?: boolean;
  listening?: boolean;
  reducedMotion?: boolean;
}

const LOOKS: Record<
  string,
  {
    hair: string;
    skin: string;
    eyes: string;
    style: 'short' | 'bob' | 'pony' | 'cap';
    scarf: string;
  }
> = {
  player: {
    hair: '#55352f',
    skin: '#f3c79d',
    eyes: '#3286af',
    style: 'short',
    scarf: '#f2d07c',
  },
  mina: {
    hair: '#d18b6f',
    skin: '#f4d0ad',
    eyes: '#478d88',
    style: 'pony',
    scarf: '#f7d895',
  },
  kiro: {
    hair: '#293747',
    skin: '#ebbf97',
    eyes: '#5eaac4',
    style: 'short',
    scarf: '#f79a58',
  },
  bram: {
    hair: '#694b3a',
    skin: '#c8936f',
    eyes: '#647e6a',
    style: 'cap',
    scarf: '#edc577',
  },
  lyra: {
    hair: '#a285b6',
    skin: '#f5d1b1',
    eyes: '#645b9c',
    style: 'bob',
    scarf: '#eacd88',
  },
  rook: {
    hair: '#453e4d',
    skin: '#b78165',
    eyes: '#a87241',
    style: 'short',
    scarf: '#e5be79',
  },
  veyra: {
    hair: '#d6dce7',
    skin: '#efc9b0',
    eyes: '#8272ae',
    style: 'bob',
    scarf: '#d98389',
  },
};

/** A small articulated local mesh: hip, knee, shoulder, elbow, head and face. */
export function ChibiCharacter({
  color,
  variant = 'player',
  movement,
  talking = false,
  listening = false,
  reducedMotion = false,
}: ChibiProps) {
  const look = LOOKS[variant] ?? LOOKS.player;
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftElbow = useRef<THREE.Group>(null);
  const rightElbow = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftKnee = useRef<THREE.Group>(null);
  const rightKnee = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const scarf = useRef<THREE.Mesh>(null);
  const stride = useRef(0);
  const blend = useRef(0);
  const talkBlend = useRef(0);
  const offset =
    variant.split('').reduce((sum, letter) => sum + letter.charCodeAt(0), 0) *
    0.17;

  useFrame(({ clock }, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    const t = clock.elapsedTime + offset;
    blend.current = THREE.MathUtils.damp(
      blend.current,
      movement?.current.speed ?? 0,
      12,
      delta,
    );
    talkBlend.current = THREE.MathUtils.damp(
      talkBlend.current,
      talking ? 1 : 0,
      8,
      delta,
    );
    const walk = blend.current;
    const talk = talkBlend.current;
    stride.current += delta * (7 + walk * 5);
    const wave = Math.sin(stride.current) * walk * (reducedMotion ? 0.35 : 0.7);
    if (body.current) {
      body.current.position.y = reducedMotion
        ? 0
        : Math.abs(Math.sin(stride.current)) * 0.055 * walk +
          Math.sin(t * 2) * 0.012;
      body.current.rotation.z = reducedMotion
        ? 0
        : Math.sin(stride.current) * 0.035 * walk;
    }
    if (leftLeg.current) leftLeg.current.rotation.x = wave;
    if (rightLeg.current) rightLeg.current.rotation.x = -wave;
    if (leftKnee.current)
      leftKnee.current.rotation.x = Math.max(0, -wave) * 0.7;
    if (rightKnee.current)
      rightKnee.current.rotation.x = Math.max(0, wave) * 0.7;
    if (leftArm.current) {
      leftArm.current.rotation.x =
        -wave * 0.75 - talk * (0.3 + Math.sin(t * 3.6) * 0.18);
      leftArm.current.rotation.z = 0.12 + talk * 0.16;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x =
        wave * 0.75 - talk * (0.6 + Math.sin(t * 4.1) * 0.22);
      rightArm.current.rotation.z = -0.12 - talk * 0.23;
    }
    if (leftElbow.current) leftElbow.current.rotation.x = -0.12 - talk * 0.4;
    if (rightElbow.current)
      rightElbow.current.rotation.x =
        -0.12 - talk * (0.75 + Math.sin(t * 4) * 0.15);
    if (head.current) {
      head.current.rotation.x = reducedMotion
        ? 0
        : Math.sin(t * (talking ? 4.3 : 1.7)) *
          (talking ? 0.07 : listening ? 0.045 : 0.018);
      head.current.rotation.z = reducedMotion
        ? 0
        : Math.sin(t * 1.9) * (talking ? 0.065 : 0.018);
    }
    const blink = t % 4.7;
    if (eyes.current) eyes.current.scale.y = blink < 0.14 ? 0.08 : 1;
    if (mouth.current)
      mouth.current.scale.y =
        0.35 + talk * (0.4 + Math.abs(Math.sin(t * 13)) * 1.2);
    if (scarf.current && !reducedMotion)
      scarf.current.rotation.x = 0.15 + walk * 0.3 + Math.sin(t * 5) * 0.08;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial
          color="#263c51"
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      <group ref={body}>
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            ref={side === -1 ? leftLeg : rightLeg}
            position={[side * 0.16, 0.62, 0]}
          >
            <mesh castShadow position={[0, -0.13, 0]}>
              <cylinderGeometry args={[0.135, 0.115, 0.27, 8]} />
              <meshStandardMaterial color="#344453" flatShading />
            </mesh>
            <group
              ref={side === -1 ? leftKnee : rightKnee}
              position={[0, -0.26, 0]}
            >
              <mesh position={[0, -0.12, 0]}>
                <cylinderGeometry args={[0.115, 0.1, 0.24, 8]} />
                <meshStandardMaterial color="#344453" flatShading />
              </mesh>
              <mesh castShadow position={[0, -0.24, 0.06]}>
                <boxGeometry args={[0.26, 0.22, 0.38]} />
                <meshStandardMaterial color="#67473a" roughness={0.9} />
              </mesh>
              <mesh position={[0, -0.12, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.08, 8]} />
                <meshStandardMaterial color="#e7c596" />
              </mesh>
            </group>
          </group>
        ))}
        <mesh castShadow position={[0, 0.84, 0]}>
          <cylinderGeometry args={[0.29, 0.34, 0.54, 8]} />
          <meshStandardMaterial color={color} flatShading roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.86, 0.265]}>
          <boxGeometry args={[0.24, 0.42, 0.055]} />
          <meshStandardMaterial color="#faf0d8" />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.344, 0.344, 0.09, 8]} />
          <meshStandardMaterial color="#795540" />
        </mesh>
        <mesh position={[0, 0.62, 0.327]}>
          <boxGeometry args={[0.12, 0.115, 0.05]} />
          <meshStandardMaterial
            color="#edc566"
            metalness={0.3}
            roughness={0.55}
          />
        </mesh>
        <mesh position={[0.28, 0.67, 0.19]} rotation={[0, -0.35, -0.12]}>
          <boxGeometry args={[0.2, 0.25, 0.19]} />
          <meshStandardMaterial color="#a77246" />
        </mesh>
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            ref={side === -1 ? leftArm : rightArm}
            position={[side * 0.34, 1.04, 0]}
          >
            <mesh castShadow position={[0, -0.12, 0]}>
              <cylinderGeometry args={[0.145, 0.115, 0.28, 8]} />
              <meshStandardMaterial color={color} flatShading />
            </mesh>
            <group
              ref={side === -1 ? leftElbow : rightElbow}
              position={[0, -0.26, 0]}
            >
              <mesh position={[0, -0.1, 0]}>
                <cylinderGeometry args={[0.098, 0.08, 0.21, 8]} />
                <meshStandardMaterial color={look.skin} flatShading />
              </mesh>
              <mesh position={[0, -0.22, 0.012]}>
                <sphereGeometry args={[0.11, 8, 6]} />
                <meshStandardMaterial color={look.skin} />
              </mesh>
            </group>
          </group>
        ))}
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.22, 0.26, 0.12, 8]} />
          <meshStandardMaterial color={look.scarf} flatShading />
        </mesh>
        <mesh
          ref={scarf}
          position={[-0.12, 0.99, -0.27]}
          rotation={[0.15, 0, -0.2]}
        >
          <boxGeometry args={[0.17, 0.39, 0.04]} />
          <meshStandardMaterial color={look.scarf} side={THREE.DoubleSide} />
        </mesh>
        <group ref={head} position={[0, 1.51, 0]}>
          <mesh castShadow scale={[1, 1.04, 0.86]}>
            <sphereGeometry args={[0.46, 16, 12]} />
            <meshStandardMaterial color={look.skin} roughness={0.85} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.45, -0.02, 0]}
              scale={[0.7, 1, 0.6]}
            >
              <sphereGeometry args={[0.095, 8, 6]} />
              <meshStandardMaterial color={look.skin} />
            </mesh>
          ))}
          <mesh
            castShadow
            position={[0, 0.07, -0.04]}
            scale={[1.02, 1.02, 0.91]}
          >
            <sphereGeometry
              args={[0.475, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.53]}
            />
            <meshStandardMaterial
              color={look.hair}
              flatShading
              roughness={0.95}
            />
          </mesh>
          {[-2, -1, 0, 1, 2].map((index) => (
            <mesh
              key={index}
              castShadow
              position={[index * 0.16, 0.23 - Math.abs(index) * 0.045, 0.305]}
              rotation={[0.22, 0.15, Math.PI + index * 0.22]}
            >
              <coneGeometry args={[0.155, index === -1 ? 0.5 : 0.35, 4]} />
              <meshStandardMaterial color={look.hair} flatShading />
            </mesh>
          ))}
          {(look.style === 'bob' || look.style === 'pony') &&
            [-1, 1].map((side) => (
              <mesh
                key={side}
                castShadow
                position={[side * 0.37, -0.05, -0.12]}
                rotation={[0, 0, side * 0.12]}
              >
                <coneGeometry args={[0.19, 0.68, 5]} />
                <meshStandardMaterial color={look.hair} flatShading />
              </mesh>
            ))}
          {look.style === 'pony' && (
            <mesh
              castShadow
              position={[0.3, 0.02, -0.47]}
              rotation={[-0.5, 0, -0.2]}
            >
              <capsuleGeometry args={[0.15, 0.4, 3, 6]} />
              <meshStandardMaterial color={look.hair} flatShading />
            </mesh>
          )}
          {look.style === 'cap' && (
            <group position={[0, 0.31, 0]}>
              <mesh castShadow>
                <sphereGeometry
                  args={[0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]}
                />
                <meshStandardMaterial color="#d09245" flatShading />
              </mesh>
              <mesh position={[0, 0.015, 0.29]}>
                <boxGeometry args={[0.61, 0.08, 0.4]} />
                <meshStandardMaterial color="#bb7937" />
              </mesh>
            </group>
          )}
          <group ref={eyes} position={[0, -0.035, 0]}>
            {[-1, 1].map((side) => (
              <group
                key={side}
                position={[side * 0.174, 0, 0.357]}
                rotation={[0, side * 0.16, 0]}
              >
                <mesh scale={[0.105, 0.135, 0.025]}>
                  <sphereGeometry args={[1, 10, 8]} />
                  <meshStandardMaterial color="#fffcf1" />
                </mesh>
                <mesh
                  position={[0, -0.008, 0.024]}
                  scale={[0.063, 0.102, 0.022]}
                >
                  <sphereGeometry args={[1, 10, 8]} />
                  <meshStandardMaterial color={look.eyes} />
                </mesh>
                <mesh
                  position={[0, -0.008, 0.041]}
                  scale={[0.027, 0.069, 0.009]}
                >
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshBasicMaterial color="#172735" />
                </mesh>
                <mesh position={[-0.022, 0.036, 0.05]}>
                  <sphereGeometry args={[0.023, 6, 6]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh
                  position={[0, 0.156, -0.004]}
                  rotation={[0, 0, side * -0.12]}
                >
                  <boxGeometry args={[0.145, 0.022, 0.025]} />
                  <meshStandardMaterial color={look.hair} />
                </mesh>
              </group>
            ))}
          </group>
          <mesh position={[0, -0.126, 0.389]} scale={[1, 0.8, 0.65]}>
            <sphereGeometry args={[0.039, 8, 6]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
          <mesh ref={mouth} position={[0, -0.216, 0.363]} scale={[1, 0.35, 1]}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <meshStandardMaterial color="#8f5150" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
