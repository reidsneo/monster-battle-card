'use client';

import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import {
  NPCS,
  npcUnlocked,
  OUTFIT_PALETTES,
  WORLDS,
} from '@/lib/game/campaign';
import {
  moveWorldPosition,
  safeWorldPosition,
  worldObstacles,
  type WorldPoint,
} from '@/lib/game/world-layout';
import type { CampaignSaveV1, NpcDefinition } from '@/lib/game/types';
import { ChibiCharacter, type CharacterMovement } from './chibi-character';
import { TownEnvironment } from './town-environment';

export type Motion = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
};
export const EMPTY_MOTION: Motion = {
  forward: false,
  back: false,
  left: false,
  right: false,
};
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const NPC_COLORS: Record<string, string> = {
  mina: '#629d8b',
  kiro: '#5b93bd',
  bram: '#c67a51',
  lyra: '#9b7ead',
  rook: '#ad655c',
  veyra: '#4c629b',
};
const angleToward = (current: number, target: number, alpha: number) =>
  current +
  Math.atan2(Math.sin(target - current), Math.cos(target - current)) * alpha;

function PlayerController({
  save,
  motion,
  cameraYaw,
  dialogueNpc,
  reducedMotion,
  position,
  onPosition,
  onNear,
}: {
  save: CampaignSaveV1;
  motion: Motion;
  cameraYaw: number;
  dialogueNpc: NpcDefinition | null;
  reducedMotion: boolean;
  position: RefObject<THREE.Vector3>;
  onPosition: (position: WorldPoint, yaw: number) => void;
  onNear: (npc: NpcDefinition | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const movement = useRef<CharacterMovement>({ speed: 0 });
  const spawn = useRef(safeWorldPosition(save.position, save.areaId));
  const spawnYaw = useRef(save.yaw);
  const obstacles = useMemo(() => worldObstacles(save.areaId), [save.areaId]);
  const cameraObstacles = useMemo(
    () =>
      obstacles
        .filter((item) => item.height > 3)
        .map(
          (item) =>
            new THREE.Box3(
              new THREE.Vector3(
                item.x - item.halfX - 0.3,
                0,
                item.z - item.halfZ - 0.3,
              ),
              new THREE.Vector3(
                item.x + item.halfX + 0.3,
                item.height + 0.3,
                item.z + item.halfZ + 0.3,
              ),
            ),
        ),
    [obstacles],
  );
  const math = useMemo(
    () => ({
      velocity: new THREE.Vector3(),
      camera: new THREE.Vector3(),
      aim: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      ray: new THREE.Ray(),
    }),
    [],
  );
  const lastReport = useRef(-1);
  const lastPosition = useRef(new THREE.Vector3(Infinity, 0, Infinity));
  const lastYaw = useRef(save.yaw);
  const lastNearby = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!group.current) return;
    group.current.position.set(spawn.current[0], 0.07, spawn.current[2]);
    group.current.rotation.y = spawnYaw.current;
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))
      )
        return;
      const key = event.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
        ].includes(key)
      ) {
        event.preventDefault();
        keys.current.add(key);
      }
    };
    const up = (event: KeyboardEvent) =>
      keys.current.delete(event.key.toLowerCase());
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  useEffect(() => {
    if (dialogueNpc) keys.current.clear();
  }, [dialogueNpc]);

  useFrame(({ clock }, frameDelta) => {
    const player = group.current;
    if (!player) return;
    const delta = Math.min(frameDelta, 0.05);
    const { velocity, aim, direction, ray, hit } = math;
    const forward =
      keys.current.has('w') || keys.current.has('arrowup') || motion.forward;
    const back =
      keys.current.has('s') || keys.current.has('arrowdown') || motion.back;
    const left =
      keys.current.has('a') || keys.current.has('arrowleft') || motion.left;
    const right =
      keys.current.has('d') || keys.current.has('arrowright') || motion.right;
    velocity.set(
      Number(right) - Number(left),
      0,
      Number(back) - Number(forward),
    );
    movement.current.speed = 0;
    if (!dialogueNpc && velocity.lengthSq() > 0) {
      velocity.normalize().applyAxisAngle(Y_AXIS, cameraYaw);
      const next = moveWorldPosition(
        [player.position.x, 0, player.position.z],
        velocity.x * delta * 3.6,
        velocity.z * delta * 3.6,
        obstacles,
      );
      const travelled = Math.hypot(
        next[0] - player.position.x,
        next[2] - player.position.z,
      );
      player.position.set(next[0], 0.07, next[2]);
      movement.current.speed = Math.min(
        1,
        travelled / Math.max(0.001, delta * 3.6),
      );
      player.rotation.y = angleToward(
        player.rotation.y,
        Math.atan2(velocity.x, velocity.z),
        1 - Math.exp(-delta * 14),
      );
    } else if (dialogueNpc) {
      player.rotation.y = angleToward(
        player.rotation.y,
        Math.atan2(
          dialogueNpc.position[0] - player.position.x,
          dialogueNpc.position[2] - player.position.z,
        ),
        1 - Math.exp(-delta * 7),
      );
    }
    position.current.copy(player.position);
    aim.set(
      player.position.x - Math.sin(cameraYaw) * 2.5,
      1.5,
      player.position.z - Math.cos(cameraYaw) * 2.5,
    );
    if (dialogueNpc)
      aim.set(
        player.position.x * 0.57 + dialogueNpc.position[0] * 0.43,
        1.2,
        player.position.z * 0.57 + dialogueNpc.position[2] * 0.43,
      );
    const zoom = dialogueNpc && !reducedMotion ? 6.3 : 8.8;
    math.camera.set(
      (dialogueNpc ? aim.x : player.position.x) + Math.sin(cameraYaw) * zoom,
      dialogueNpc && !reducedMotion ? 4.2 : 4.8,
      (dialogueNpc ? aim.z : player.position.z) + Math.cos(cameraYaw) * zoom,
    );
    direction.subVectors(math.camera, aim);
    const fullLength = direction.length();
    ray.set(aim, direction.normalize());
    let distance = fullLength;
    for (const obstacle of cameraObstacles) {
      if (ray.intersectBox(obstacle, hit))
        distance = Math.min(distance, Math.max(2, hit.distanceTo(aim) - 0.45));
    }
    if (distance < fullLength)
      math.camera.copy(aim).addScaledVector(direction, distance);
    camera.position.lerp(
      math.camera,
      reducedMotion ? 1 : 1 - Math.exp(-delta * 5),
    );
    camera.lookAt(aim);
    if (clock.elapsedTime - lastReport.current > 0.2) {
      lastReport.current = clock.elapsedTime;
      if (
        lastPosition.current.distanceToSquared(player.position) > 0.0004 ||
        Math.abs(lastYaw.current - player.rotation.y) > 0.04
      ) {
        lastPosition.current.copy(player.position);
        lastYaw.current = player.rotation.y;
        onPosition(
          [player.position.x, 0, player.position.z],
          player.rotation.y,
        );
      }
      const nearby = WORLDS[save.areaId].npcIds
        .map((id) => NPCS[id])
        .filter((npc) => npcUnlocked(save, npc))
        .map((npc) => ({
          npc,
          distance: Math.hypot(
            npc.position[0] - player.position.x,
            npc.position[2] - player.position.z,
          ),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      const next = nearby && nearby.distance < 2.4 ? nearby.npc : null;
      if ((next?.id ?? null) !== lastNearby.current) {
        lastNearby.current = next?.id ?? null;
        onNear(next);
      }
    }
  });

  return (
    <group ref={group}>
      <ChibiCharacter
        color={OUTFIT_PALETTES[save.outfit].color}
        movement={movement}
        listening={Boolean(dialogueNpc)}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

function NpcActor({
  npc,
  save,
  player,
  talking,
  reducedMotion,
  onNpc,
}: {
  npc: NpcDefinition;
  save: CampaignSaveV1;
  player: RefObject<THREE.Vector3>;
  talking: boolean;
  reducedMotion: boolean;
  onNpc: (npc: NpcDefinition) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const locked = !npcUnlocked(save, npc);
  const defeated = save.defeatedNpcIds.includes(npc.id);
  useFrame(({ clock }, delta) => {
    if (root.current) {
      const distance = Math.hypot(
        player.current.x - npc.position[0],
        player.current.z - npc.position[2],
      );
      const yaw =
        distance < 4 || talking
          ? Math.atan2(
              player.current.x - npc.position[0],
              player.current.z - npc.position[2],
            )
          : Math.atan2(-npc.position[0], -npc.position[2]);
      root.current.rotation.y = angleToward(
        root.current.rotation.y,
        yaw,
        1 - Math.exp(-Math.min(delta, 0.05) * 4),
      );
    }
    if (marker.current && !reducedMotion) {
      marker.current.position.y =
        2.58 + Math.sin(clock.elapsedTime * 2.5 + npc.position[0]) * 0.07;
      marker.current.rotation.y += Math.min(delta, 0.05) * 0.65;
    }
  });
  return (
    <group
      position={[npc.position[0], 0.07, npc.position[2]]}
      onClick={(event) => {
        event.stopPropagation();
        if (
          !locked &&
          Math.hypot(
            player.current.x - npc.position[0],
            player.current.z - npc.position[2],
          ) < 2.7
        )
          onNpc(npc);
      }}
    >
      <group ref={root}>
        <ChibiCharacter
          color={locked ? '#777e8c' : NPC_COLORS[npc.id]}
          variant={npc.id}
          talking={talking}
          reducedMotion={reducedMotion}
        />
      </group>
      <mesh ref={marker} position={[0, 2.58, 0]}>
        <octahedronGeometry args={[0.12]} />
        <meshStandardMaterial
          color={locked ? '#9298a0' : defeated ? '#70bdad' : '#e8bb65'}
          emissive={locked ? '#000000' : '#b27e35'}
          emissiveIntensity={0.3}
        />
      </mesh>
      {!talking && (
        <Html
          center
          position={[0, 2.28, 0]}
          distanceFactor={13}
          zIndexRange={[4, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className={`world-npc-label${locked ? ' is-locked' : ''}`}>
            <span>{npc.name}</span>
            <small>
              {locked ? 'Final trial' : defeated ? 'Rematch' : npc.title}
            </small>
          </div>
        </Html>
      )}
    </group>
  );
}

function Pedestrian({
  index,
  reducedMotion,
}: {
  index: number;
  reducedMotion: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const movement = useRef<CharacterMovement>({ speed: 0.55 });
  const phase = useRef(index * 2.1);
  useFrame((_, frameDelta) => {
    if (!root.current) return;
    phase.current += reducedMotion ? 0 : Math.min(frameDelta, 0.05) * 0.18;
    const x = Math.sin(phase.current) * 5.3;
    const speed = Math.cos(phase.current);
    root.current.position.set(x, 0.07, index % 2 ? -7.7 : 6.9);
    root.current.rotation.y = angleToward(
      root.current.rotation.y,
      speed > 0 ? Math.PI / 2 : -Math.PI / 2,
      0.05,
    );
    movement.current.speed = reducedMotion ? 0 : Math.abs(speed) * 0.65;
  });
  return (
    <group ref={root} scale={0.88}>
      <ChibiCharacter
        color={['#bd9370', '#a290b7', '#7b9da5'][index]}
        variant={['bram', 'lyra', 'kiro'][index]}
        movement={movement}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

export function WorldScene({
  save,
  motion,
  cameraYaw,
  dialogueNpc,
  reducedMotion,
  onPosition,
  onNear,
  onNpc,
}: {
  save: CampaignSaveV1;
  motion: Motion;
  cameraYaw: number;
  dialogueNpc: NpcDefinition | null;
  reducedMotion: boolean;
  onPosition: (position: WorldPoint, yaw: number) => void;
  onNear: (npc: NpcDefinition | null) => void;
  onNpc: (npc: NpcDefinition) => void;
}) {
  const player = useRef(
    new THREE.Vector3(...safeWorldPosition(save.position, save.areaId)),
  );
  return (
    <>
      <TownEnvironment
        area={save.areaId}
        player={player}
        reducedMotion={reducedMotion}
      />
      {WORLDS[save.areaId].npcIds.map((id) => (
        <NpcActor
          key={id}
          npc={NPCS[id]}
          save={save}
          player={player}
          talking={dialogueNpc?.id === id}
          reducedMotion={reducedMotion}
          onNpc={onNpc}
        />
      ))}
      {[0, 1, 2].map((index) => (
        <Pedestrian key={index} index={index} reducedMotion={reducedMotion} />
      ))}
      <PlayerController
        save={save}
        motion={motion}
        cameraYaw={cameraYaw}
        dialogueNpc={dialogueNpc}
        reducedMotion={reducedMotion}
        position={player}
        onPosition={onPosition}
        onNear={onNear}
      />
    </>
  );
}
