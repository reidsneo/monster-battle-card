'use client';

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DuelCue } from '@/lib/game/battle-director';

type Point = [number, number, number];
export function BattleEffects({
  cue,
  start,
  end,
  reducedMotion,
  density,
  speed,
}: {
  cue: DuelCue;
  start: Point;
  end: Point;
  reducedMotion: boolean;
  density: 'low' | 'high';
  speed: number;
}) {
  const pulse = useRef<THREE.Group>(null);
  const particles = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const projectile = useRef<THREE.Mesh>(null);
  const lifeText = useRef<HTMLSpanElement>(null);
  const born = useRef<number | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: cue.profile.color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [cue.profile.color],
  );
  useEffect(() => () => material.dispose(), [material]);
  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...start).add(new THREE.Vector3(0, 0.2, 0)),
        new THREE.Vector3(
          (start[0] + end[0]) / 2,
          1.6,
          (start[2] + end[2]) / 2,
        ),
        new THREE.Vector3(...end).add(new THREE.Vector3(0, 0.25, 0)),
      ),
    [start, end],
  );
  const trailGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, 36, 0.018, 5, false),
    [curve],
  );
  useEffect(() => () => trailGeometry.dispose(), [trailGeometry]);
  const count = density === 'high' ? 88 : 28;
  const heal = cue.profile.kind === 'heal';
  const shield = ['shield', 'redirect', 'reflect'].includes(cue.profile.kind);
  const slash = ['slash', 'fang'].includes(cue.profile.kind);
  const impact = cue.kind === 'impact';
  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const age = (clock.elapsedTime - born.current) * speed;
    const t = Math.min(1, age / Math.max(0.1, cue.duration / 1000));
    material.opacity = reducedMotion ? 0.55 : Math.pow(1 - t, 0.7);
    if (projectile.current) {
      curve.getPoint(
        reducedMotion ? 0.55 : Math.min(1, age * 1.65),
        projectile.current.position,
      );
      projectile.current.scale.setScalar(0.9 + Math.sin(t * Math.PI) * 0.45);
    }
    if (pulse.current && !reducedMotion) {
      pulse.current.scale.setScalar(
        shield
          ? 0.8 + Math.sin(t * Math.PI) * 0.2
          : 0.4 + Math.pow(t, 0.45) * 1.7,
      );
      pulse.current.rotation.y = heal ? age * 1.8 : 0;
    }
    if (light.current)
      light.current.intensity = reducedMotion
        ? 0
        : (1 - t) * (cue.profile.intensity * 5);
    if (particles.current && !reducedMotion) {
      for (let i = 0; i < count; i++) {
        const angle = i * 2.39996;
        const radial = heal
          ? 0.4 + (i % 7) * 0.09
          : age * (1.1 + (i % 9) * 0.24);
        dummy.position.set(
          Math.cos(angle + (heal ? age : 0)) * radial,
          heal
            ? age * 1.8 + (i % 5) * 0.12
            : Math.max(-0.1, age * (1.5 + (i % 4) * 0.5) - age * age * 1.8),
          Math.sin(angle + (heal ? age : 0)) * radial,
        );
        dummy.rotation.set(angle, age * 3, angle + age);
        const size = (0.035 + (i % 4) * 0.014) * (1 - t);
        dummy.scale.set(size, heal ? size * 1.4 : size * 3, size);
        dummy.updateMatrix();
        particles.current.setMatrixAt(i, dummy.matrix);
      }
      particles.current.instanceMatrix.needsUpdate = true;
    }
    if (lifeText.current && cue.beforeLife != null && cue.afterLife != null)
      lifeText.current.textContent = `${Math.round(THREE.MathUtils.lerp(cue.beforeLife, cue.afterLife, reducedMotion ? 1 : Math.min(1, t * 2)))} LIFE`;
  });
  return (
    <group>
      {cue.kind === 'direction' && (
        <>
          <mesh geometry={trailGeometry}>
            <meshBasicMaterial
              color={cue.profile.color}
              transparent
              opacity={0.8}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={projectile}>
            <icosahedronGeometry args={[0.12, 1]} />
            <meshBasicMaterial color="#fff0cd" />
          </mesh>
          {[start, end].map((point, i) => (
            <mesh
              key={i}
              position={[point[0], 0.3, point[2]]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.72, 0.78, 48]} />
              <meshBasicMaterial
                color={i ? '#f6a4a3' : '#9cdef5'}
                transparent
                opacity={0.9}
              />
            </mesh>
          ))}
        </>
      )}
      {impact && (
        <group position={[end[0], end[1] + 0.3, end[2]]}>
          <pointLight
            ref={light}
            color={cue.profile.color}
            distance={4}
            decay={2}
          />
          <group ref={pulse}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
              <ringGeometry args={[0.75, 0.81, 64]} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
              <ringGeometry args={[0.55, 0.565, 64]} />
            </mesh>
            {shield && (
              <mesh position={[0, 0.35, 0]} material={material}>
                <icosahedronGeometry args={[0.85, 1]} />
                <meshBasicMaterial
                  color={cue.profile.color}
                  wireframe
                  transparent
                  opacity={0.55}
                />
              </mesh>
            )}
            {heal &&
              [0.25, 0.65, 1.05].map((y) => (
                <mesh
                  key={y}
                  position={[0, y, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  material={material}
                >
                  <torusGeometry args={[0.55, 0.015, 5, 40]} />
                </mesh>
              ))}
            {slash &&
              [-1, 0, 1].map((i) => (
                <mesh
                  key={i}
                  position={[i * 0.25, 0.45, 0]}
                  rotation={[0.3, 0, -0.7]}
                  material={material}
                >
                  <torusGeometry args={[0.75, 0.025, 5, 28, Math.PI * 0.7]} />
                </mesh>
              ))}
          </group>
          {!reducedMotion && (
            <instancedMesh
              ref={particles}
              args={[undefined, material, count]}
              frustumCulled={false}
            >
              <octahedronGeometry args={[1, 0]} />
            </instancedMesh>
          )}
          <Html
            center
            position={[0, 1.1, 0]}
            zIndexRange={[18, 17]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="life-burst"
              data-heal={heal}
              data-ko={cue.afterLife === 0}
              data-reduced={reducedMotion}
              style={
                {
                  '--impact-color': cue.profile.color,
                  animationDuration: `${cue.duration / speed}ms`,
                } as React.CSSProperties
              }
            >
              <small>
                {cue.afterLife === 0
                  ? 'KNOCK OUT'
                  : heal
                    ? 'RECOVERY'
                    : shield
                      ? 'GUARD'
                      : cue.response
                        ? 'RESPONSE'
                        : cue.event?.kind === 'damage'
                          ? 'IMPACT'
                          : 'SKILL'}
              </small>
              <strong>
                {cue.event?.kind === 'damage'
                  ? cue.amount
                    ? `−${cue.amount}`
                    : 'BLOCK'
                  : heal
                    ? `+${cue.amount ?? ''}`
                    : cue.profile.kind.toUpperCase()}
              </strong>
              <span ref={lifeText}>
                {cue.afterLife != null
                  ? `${cue.afterLife} LIFE`
                  : cue.targetName}
              </span>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
