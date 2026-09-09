'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Gamepad2,
  Map,
  MessageCircle,
  Move,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  dialogueFor,
  festivalUnlocked,
  NPCS,
  npcUnlocked,
  OUTFIT_PALETTES,
  WORLDS,
} from '@/lib/game/campaign';
import { loadCampaign, saveCampaign } from '@/lib/game/persistence';
import type {
  CampaignSaveV1,
  NpcDefinition,
  WorldAreaId,
} from '@/lib/game/types';

type Motion = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
};
const EMPTY_MOTION: Motion = {
  forward: false,
  back: false,
  left: false,
  right: false,
};

function Tree({
  position,
  tone = '#4d9254',
  scale = 1,
}: {
  position: [number, number, number];
  tone?: string;
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.14, 0.23, 1.5, 7]} />
        <meshStandardMaterial color="#765237" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 1.75, 0]}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color={tone} roughness={1} flatShading />
      </mesh>
      <mesh castShadow position={[0.42, 1.9, -0.1]}>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color={tone} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function LowPolyPerson({
  color,
  active = false,
}: {
  color: string;
  active?: boolean;
}) {
  return (
    <group>
      <mesh castShadow position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshStandardMaterial color="#d99b73" roughness={0.8} flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <coneGeometry args={[0.42, 1.18, 7]} />
        <meshStandardMaterial color={color} roughness={0.8} flatShading />
      </mesh>
      <mesh castShadow position={[-0.21, 0.35, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.75, 6]} />
        <meshStandardMaterial color="#28383c" />
      </mesh>
      <mesh castShadow position={[0.21, 0.35, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.75, 6]} />
        <meshStandardMaterial color="#28383c" />
      </mesh>
      {active && (
        <pointLight
          position={[0, 1.2, 0]}
          color="#ffd65a"
          intensity={2.6}
          distance={2.4}
        />
      )}
    </group>
  );
}

function Windmill() {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.z -= delta * 0.35;
  });
  return (
    <group position={[-7, 0, -6]}>
      <mesh castShadow position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.7, 1.05, 3.6, 7]} />
        <meshStandardMaterial color="#dec78e" roughness={0.9} flatShading />
      </mesh>
      <mesh castShadow position={[0, 3.8, 0]}>
        <coneGeometry args={[1.05, 1.1, 7]} />
        <meshStandardMaterial color="#8a5240" roughness={0.9} />
      </mesh>
      <group ref={blades} position={[0, 3, 0.82]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[0, 1.08, 0]}
            rotation={[0, 0, (i * Math.PI) / 2]}
          >
            <boxGeometry args={[0.18, 1.95, 0.08]} />
            <meshStandardMaterial color="#f0dfb2" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function RanchArea() {
  return (
    <>
      <color attach="background" args={['#8ec8c0']} />
      <fog attach="fog" args={['#a5d4c0', 14, 31]} />
      <mesh receiveShadow position={[0, -0.25, 0]}>
        <boxGeometry args={[22, 0.5, 20]} />
        <meshStandardMaterial color="#648f50" roughness={1} />
      </mesh>
      <Windmill />
      <Tree position={[-7, 0, 3]} scale={1.4} />
      <Tree position={[7, 0, -1]} scale={1.25} />
      <Tree position={[6, 0, 5]} />
      <Tree position={[-4, 0, -7]} />
      {[-8, -5.3, -2.6, 0, 2.6, 5.3, 8].map((x) => (
        <group key={x} position={[x, 0.38, -8]}>
          <mesh castShadow>
            <boxGeometry args={[0.14, 0.9, 0.14]} />
            <meshStandardMaterial color="#8b6942" />
          </mesh>
          <mesh castShadow position={[0, 0.2, 0]}>
            <boxGeometry args={[2.7, 0.12, 0.1]} />
            <meshStandardMaterial color="#8b6942" />
          </mesh>
        </group>
      ))}
      <mesh castShadow position={[0, 0.08, 7.8]}>
        <boxGeometry args={[3.4, 0.18, 1.2]} />
        <meshStandardMaterial color="#d5c176" roughness={0.9} />
      </mesh>
    </>
  );
}

function FestivalArea() {
  return (
    <>
      <color attach="background" args={['#d29a68']} />
      <fog attach="fog" args={['#e0bd85', 15, 31]} />
      <mesh receiveShadow position={[0, -0.24, 0]}>
        <boxGeometry args={[22, 0.48, 20]} />
        <meshStandardMaterial color="#b69b70" roughness={1} />
      </mesh>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <circleGeometry args={[6.3, 12]} />
        <meshStandardMaterial color="#c9b68e" roughness={0.95} flatShading />
      </mesh>
      {[-7, 7].map((x) =>
        [-6, -2, 2, 6].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh castShadow position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.38, 0.48, 2.4, 8]} />
              <meshStandardMaterial color="#d6c394" roughness={1} />
            </mesh>
            <mesh castShadow position={[0, 2.55, 0]}>
              <boxGeometry args={[0.95, 0.24, 0.95]} />
              <meshStandardMaterial color="#8b4250" />
            </mesh>
          </group>
        )),
      )}
      {[-5, -3, -1, 1, 3, 5].map((x) => (
        <group key={x} position={[x, 0, 5.8]}>
          <LowPolyPerson color={x % 2 ? '#6e4e8a' : '#47788d'} />
        </group>
      ))}
      <Tree position={[-7.5, 0, 6]} tone="#8b7044" />
      <Tree position={[7.5, 0, 6]} tone="#8b7044" />
    </>
  );
}

function PlayerController({
  save,
  motion,
  cameraYaw,
  onPosition,
  onNear,
}: {
  save: CampaignSaveV1;
  motion: Motion;
  cameraYaw: number;
  onPosition: (position: [number, number, number], yaw: number) => void;
  onNear: (npc: NpcDefinition | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const lastReport = useRef(0);
  const velocity = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const down = (event: KeyboardEvent) =>
      keys.current.add(event.key.toLowerCase());
    const up = (event: KeyboardEvent) =>
      keys.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  useFrame(({ clock }, delta) => {
    const player = group.current;
    if (!player) return;
    const forward =
      keys.current.has('w') || keys.current.has('arrowup') || motion.forward;
    const back =
      keys.current.has('s') || keys.current.has('arrowdown') || motion.back;
    const left =
      keys.current.has('a') || keys.current.has('arrowleft') || motion.left;
    const right =
      keys.current.has('d') || keys.current.has('arrowright') || motion.right;
    velocity.set(
      (right ? 1 : 0) - (left ? 1 : 0),
      0,
      (back ? 1 : 0) - (forward ? 1 : 0),
    );
    if (velocity.lengthSq() > 0) {
      velocity
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      const speed = Math.min(delta, 0.05) * 4.1;
      player.position.addScaledVector(velocity, speed);
      player.position.x = THREE.MathUtils.clamp(player.position.x, -8.2, 8.2);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -7.2, 7.2);
      player.rotation.y = Math.atan2(velocity.x, velocity.z);
      player.position.y = Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.045;
    }
    const cameraTarget = new THREE.Vector3(
      player.position.x + Math.sin(cameraYaw) * 7.4,
      5.8,
      player.position.z + Math.cos(cameraYaw) * 7.4,
    );
    camera.position.lerp(cameraTarget, 0.06);
    camera.lookAt(
      player.position.x - Math.sin(cameraYaw) * 1.2,
      0.8,
      player.position.z - Math.cos(cameraYaw) * 1.2,
    );
    if (clock.elapsedTime - lastReport.current > 0.15) {
      lastReport.current = clock.elapsedTime;
      const position: [number, number, number] = [
        player.position.x,
        0,
        player.position.z,
      ];
      onPosition(position, player.rotation.y);
      const nearby = WORLDS[save.areaId].npcIds
        .map((id) => NPCS[id])
        .filter((npc) => npcUnlocked(save, npc))
        .sort(
          (a, b) =>
            new THREE.Vector3(...a.position).distanceTo(player.position) -
            new THREE.Vector3(...b.position).distanceTo(player.position),
        )[0];
      onNear(
        nearby &&
          new THREE.Vector3(...nearby.position).distanceTo(player.position) <
            1.75
          ? nearby
          : null,
      );
    }
  });
  return (
    <group ref={group} position={save.position}>
      <LowPolyPerson color={OUTFIT_PALETTES[save.outfit].color} active />
    </group>
  );
}

function WorldScene({
  save,
  motion,
  cameraYaw,
  onPosition,
  onNear,
  onNpc,
}: {
  save: CampaignSaveV1;
  motion: Motion;
  cameraYaw: number;
  onPosition: (position: [number, number, number], yaw: number) => void;
  onNear: (npc: NpcDefinition | null) => void;
  onNpc: (npc: NpcDefinition) => void;
}) {
  return (
    <>
      <ambientLight intensity={1.55} />
      <hemisphereLight args={['#fff1c6', '#405b42', 1.35]} />
      <directionalLight
        castShadow
        position={[-6, 10, 5]}
        intensity={2.4}
        color="#ffe4ad"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {save.areaId === 'ranch' ? <RanchArea /> : <FestivalArea />}
      {WORLDS[save.areaId].npcIds.map((id) => {
        const npc = NPCS[id];
        const locked = !npcUnlocked(save, npc);
        return (
          <group
            key={id}
            position={npc.position}
            onClick={(event) => {
              event.stopPropagation();
              if (!locked) onNpc(npc);
            }}
          >
            <LowPolyPerson
              color={
                locked
                  ? '#666a68'
                  : npc.difficulty === 'hard'
                    ? '#243a75'
                    : npc.difficulty === 'normal'
                      ? '#9e4953'
                      : '#3f8d76'
              }
              active={!locked}
            />
            <mesh position={[0, 2.35, 0]}>
              <octahedronGeometry args={[0.16, 0]} />
              <meshBasicMaterial color={locked ? '#777' : '#ffd75b'} />
            </mesh>
          </group>
        );
      })}
      <PlayerController
        save={save}
        motion={motion}
        cameraYaw={cameraYaw}
        onPosition={onPosition}
        onNear={onNear}
      />
    </>
  );
}

export function WorldClient() {
  const params = useSearchParams();
  const [save, setSave] = useState<CampaignSaveV1 | null>(null);
  const [motion, setMotion] = useState<Motion>(EMPTY_MOTION);
  const [cameraYaw, setCameraYaw] = useState(0);
  const [nearby, setNearby] = useState<NpcDefinition | null>(null);
  const [dialogueNpc, setDialogueNpc] = useState<NpcDefinition | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const saveTimer = useRef<number | null>(null);
  const cameraDrag = useRef<{ pointerId: number; x: number } | null>(null);
  useEffect(() => {
    void loadCampaign().then(setSave);
    try {
      const canvas = document.createElement('canvas');
      setWebgl(
        Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')),
      );
    } catch {
      setWebgl(false);
    }
  }, []);
  const updatePosition = useCallback(
    (position: [number, number, number], yaw: number) => {
      setSave((current) => (current ? { ...current, position, yaw } : current));
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(
        () =>
          setSave((current) => {
            if (current) void saveCampaign(current);
            return current;
          }),
        450,
      );
    },
    [],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    [],
  );
  useEffect(() => {
    const interact = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'e' && nearby) setDialogueNpc(nearby);
    };
    window.addEventListener('keydown', interact);
    return () => window.removeEventListener('keydown', interact);
  }, [nearby]);
  if (!save)
    return (
      <main className="world-missing">
        <div className="brand-mark">MR</div>
        <h1>No journey found</h1>
        <p>Begin a journey at the title screen before entering the ranch.</p>
        <Link href="/">Return to title</Link>
      </main>
    );
  const world = WORLDS[save.areaId];
  const dialogue = dialogueNpc ? dialogueFor(save, dialogueNpc) : null;
  const resultNpc = params.get('npc') ? NPCS[params.get('npc')!] : undefined;
  const travel = () => {
    const areaId: WorldAreaId = save.areaId === 'ranch' ? 'festival' : 'ranch';
    const next = {
      ...save,
      areaId,
      position: [0, 0, 5.8] as [number, number, number],
      yaw: Math.PI,
    };
    setSave(next);
    void saveCampaign(next);
  };
  return (
    <main
      className="world-shell"
      onPointerDown={(event) => {
        if (!(event.target instanceof HTMLCanvasElement)) return;
        cameraDrag.current = { pointerId: event.pointerId, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (cameraDrag.current?.pointerId !== event.pointerId) return;
        const delta = event.clientX - cameraDrag.current.x;
        cameraDrag.current.x = event.clientX;
        setCameraYaw((yaw) => yaw - delta * 0.008);
      }}
      onPointerUp={(event) => {
        if (cameraDrag.current?.pointerId === event.pointerId) {
          cameraDrag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        cameraDrag.current = null;
      }}
    >
      {webgl === null ? (
        <section className="world-fallback world-fallback-loading">
          <small>PREPARING JOURNEY</small>
          <h2>Opening the ranch…</h2>
        </section>
      ) : webgl ? (
        <Canvas
          shadows
          camera={{ position: [0, 5.8, 12], fov: 49, near: 0.1, far: 60 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <WorldScene
            save={save}
            motion={motion}
            cameraYaw={cameraYaw}
            onPosition={updatePosition}
            onNear={setNearby}
            onNpc={setDialogueNpc}
          />
        </Canvas>
      ) : (
        <section className="world-fallback">
          <small>2D JOURNEY MODE</small>
          <h2>{world.name}</h2>
          <p>Select a breeder to talk or duel.</p>
          <div>
            {world.npcIds.map((id) => {
              const npc = NPCS[id];
              const unlocked = npcUnlocked(save, npc);
              return (
                <button
                  key={id}
                  disabled={!unlocked}
                  aria-label={`${unlocked ? 'Talk to' : 'Locked rival'} ${npc.name}`}
                  onClick={() => setDialogueNpc(npc)}
                >
                  <img src={npc.portrait} alt="" />
                  <span>
                    <strong>{npc.name}</strong>
                    <small>
                      {unlocked
                        ? `${npc.title} · ${npc.difficulty}`
                        : (npc.lockedText ?? 'Locked')}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <header className="world-hud">
        <div>
          <small>BREEDER JOURNEY</small>
          <strong>{world.name}</strong>
          <span>{world.subtitle}</span>
        </div>
        <div className="world-progress">
          <Trophy />
          <strong>{save.defeatedNpcIds.length}/6</strong>
          <span>rivals defeated</span>
        </div>
        <Link href="/" aria-label="Return to title">
          <ArrowLeft />
        </Link>
      </header>
      <section
        className="world-player-hud"
        style={
          {
            '--player-color': OUTFIT_PALETTES[save.outfit].color,
          } as React.CSSProperties
        }
      >
        <img src={OUTFIT_PALETTES[save.outfit].portrait} alt="Player breeder" />
        <div>
          <small>
            {save.campaignComplete ? 'CHAMPION BREEDER' : 'ROOKIE BREEDER'}
          </small>
          <strong>{save.playerName}</strong>
          <span>
            {save.defeatedNpcIds.length >= 2
              ? 'Festival pass earned'
              : `${2 - save.defeatedNpcIds.filter((id) => ['mina', 'kiro', 'bram'].includes(id)).length} ranch wins to Festival`}
          </span>
        </div>
      </section>
      {nearby && !dialogueNpc && (
        <button
          className="interact-prompt"
          onClick={() => setDialogueNpc(nearby)}
        >
          <MessageCircle />
          <span>
            Talk to <strong>{nearby.name}</strong>
          </span>
          <kbd>E</kbd>
        </button>
      )}
      <button
        className="travel-button"
        disabled={save.areaId === 'ranch' && !festivalUnlocked(save)}
        onClick={travel}
      >
        <Map />
        <span>
          {save.areaId === 'ranch' ? 'Festival Courtyard' : 'Ranch Grounds'}
          <small>
            {save.areaId === 'ranch' && !festivalUnlocked(save)
              ? 'Win two ranch duels'
              : 'Travel'}
          </small>
        </span>
        <ChevronRight />
      </button>
      {webgl && (
        <div className="world-help">
          <Move /> WASD / arrows to move · drag to rotate · E to talk
        </div>
      )}
      {webgl && (
        <div className="touch-dpad" aria-label="Movement controls">
          <button
            onPointerDown={() => setMotion((v) => ({ ...v, forward: true }))}
            onPointerUp={() => setMotion((v) => ({ ...v, forward: false }))}
          >
            ▲
          </button>
          <button
            onPointerDown={() => setMotion((v) => ({ ...v, left: true }))}
            onPointerUp={() => setMotion((v) => ({ ...v, left: false }))}
          >
            ◀
          </button>
          <button
            onPointerDown={() => setMotion((v) => ({ ...v, back: true }))}
            onPointerUp={() => setMotion((v) => ({ ...v, back: false }))}
          >
            ▼
          </button>
          <button
            onPointerDown={() => setMotion((v) => ({ ...v, right: true }))}
            onPointerUp={() => setMotion((v) => ({ ...v, right: false }))}
          >
            ▶
          </button>
        </div>
      )}
      {resultNpc && (
        <div className="world-toast">
          <strong>
            {params.get('result') === 'win'
              ? 'Victory recorded'
              : 'Training continues'}
          </strong>
          <span>{resultNpc.name} is ready whenever you are.</span>
        </div>
      )}
      {dialogueNpc && dialogue && (
        <section className="npc-dialogue">
          <img
            src={dialogueNpc.portrait}
            alt={`${dialogueNpc.name} portrait`}
          />
          <div>
            <small>
              {dialogueNpc.title} · {dialogueNpc.difficulty.toUpperCase()}
            </small>
            <h2>{dialogueNpc.name}</h2>
            <p>{dialogue.line}</p>
            <nav>
              {dialogue.choices.map((choice) =>
                choice.id === 'duel' ? (
                  <Link
                    key={choice.id}
                    href={`/play?mode=campaign&npc=${dialogueNpc.id}`}
                  >
                    <Gamepad2 /> {choice.label}
                  </Link>
                ) : (
                  <button key={choice.id} onClick={() => setDialogueNpc(null)}>
                    {choice.label}
                  </button>
                ),
              )}
              <Link href="/rules">
                <BookOpen /> Rules
              </Link>
            </nav>
          </div>
        </section>
      )}
    </main>
  );
}
