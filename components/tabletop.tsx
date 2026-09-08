'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CARD_BY_ID, MONSTER_BY_ID } from '@/lib/game/cards';
import type { GameState, PlayerIndex } from '@/lib/game/types';

type Point = [number, number, number];
interface CombatVisual {
  key: string;
  kind: 'POW' | 'INT';
  start: Point;
  end: Point;
}

interface CutInVisual {
  key: string;
  stage: 'attack' | 'defense';
  attackIds: string[];
  modifierIds: string[];
  defenseIds: string[];
  targetId: string;
}

const monsterPosition = (player: PlayerIndex, index: number): Point => [(index - 1) * 2.15, .16, player === 0 ? .68 : -2.25];

function CameraRig({ combat }: { combat: CombatVisual | null }) {
  const { camera, pointer } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 7.7, 9.7), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (combat) {
      look.set((combat.start[0] + combat.end[0]) / 2, 0, (combat.start[2] + combat.end[2]) / 2);
      desired.set(look.x * .18, 7.15, 8.8 + look.z * .08);
    } else {
      look.set(pointer.x * .18, 0, -.2 + pointer.y * .08);
      desired.copy(base).add(new THREE.Vector3(pointer.x * .32, pointer.y * .12, 0));
    }
    camera.position.lerp(desired, combat ? .075 : .035);
    camera.lookAt(look);
  });
  return null;
}

function CardPlane({
  url, position, rotation = 0, onSelect, dim = false, active = false, from,
}: {
  url: string;
  position: Point;
  rotation?: number;
  onSelect?: () => void;
  dim?: boolean;
  active?: boolean;
  from?: Point;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const progress = useRef(from ? 0 : 1);
  const destination = useMemo(() => new THREE.Vector3(...position), [position]);
  const origin = useMemo(() => new THREE.Vector3(...(from ?? position)), [from, position]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#17363d', transparent: true }), []);

  useEffect(() => {
    let mounted = true;
    const loaded = new THREE.TextureLoader().load(url, (next) => {
      next.colorSpace = THREE.SRGBColorSpace;
      next.anisotropy = 4;
      next.needsUpdate = true;
      if (mounted) setTexture(next); else next.dispose();
    });
    return () => { mounted = false; loaded.dispose(); setTexture(null); };
  }, [url]);
  useEffect(() => {
    material.map = texture;
    material.color.set(texture ? '#ffffff' : '#17363d');
    material.opacity = dim ? .38 : 1;
    material.needsUpdate = true;
  }, [dim, material, texture]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    if (progress.current < 1) progress.current = Math.min(1, progress.current + delta * 2.5);
    const eased = 1 - Math.pow(1 - progress.current, 3);
    group.current.position.x = THREE.MathUtils.lerp(origin.x, destination.x, eased);
    group.current.position.z = THREE.MathUtils.lerp(origin.z, destination.z, eased);
    const lift = active ? .7 + Math.sin(clock.elapsedTime * 5) * .055 : hovered ? .24 : .02;
    const pathY = THREE.MathUtils.lerp(origin.y, destination.y, eased);
    group.current.position.y += (pathY + lift - group.current.position.y) * .13;
    group.current.rotation.y += (rotation - group.current.rotation.y) * .1;
    group.current.rotation.z = active ? Math.sin(clock.elapsedTime * 2.3) * .025 : 0;
  });

  return (
    <group ref={group} position={origin} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[1.2, .065, 1.69]} />
        <meshStandardMaterial color={dim ? '#293132' : '#e8e8dc'} roughness={.64} metalness={.04} />
      </mesh>
      <mesh
        position={[0, .036, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = ''; }}
        onClick={(event) => { event.stopPropagation(); onSelect?.(); }}
      >
        <planeGeometry args={[1.16, 1.63]} />
        <primitive object={material} attach="material" />
      </mesh>
      {(active || hovered) && <pointLight position={[0, .45, 0]} color={active ? '#ffd75b' : '#65e7d1'} intensity={active ? 2.4 : 1} distance={2.8} />}
    </group>
  );
}

function Pile({ position, color, count, rotation = 0 }: { position: Point; color: string; count: number; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: Math.min(5, Math.max(1, Math.ceil(count / 9))) }, (_, index) => (
        <mesh key={index} castShadow position={[0, index * .045, 0]}>
          <boxGeometry args={[1.08, .045, 1.52]} />
          <meshStandardMaterial color={color} roughness={.7} metalness={.06} />
        </mesh>
      ))}
    </group>
  );
}

function CombatParticles({ visual }: { visual: CombatVisual }) {
  const count = 74;
  const stream = useRef<THREE.Points>(null);
  const burst = useRef<THREE.Points>(null);
  const shockwave = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);
  const positions = useMemo(() => new Float32Array(count * 3), []);
  const burstPositions = useMemo(() => new Float32Array(count * 3), []);
  const directions = useMemo(() => Array.from({ length: count }, (_, index) => {
    const angle = index * 2.39996;
    const spread = .3 + ((index * 47) % 29) / 24;
    return new THREE.Vector3(Math.cos(angle) * spread, .18 + ((index * 17) % 11) / 10, Math.sin(angle) * spread);
  }), []);
  const color = visual.kind === 'POW' ? '#ff7048' : '#62dcff';

  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const age = clock.elapsedTime - born.current;
    const start = new THREE.Vector3(...visual.start);
    const end = new THREE.Vector3(...visual.end);
    const attribute = stream.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const burstAttribute = burst.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    for (let index = 0; index < count; index += 1) {
      const t = (age * 1.15 + index / count) % 1;
      const arc = Math.sin(t * Math.PI) * (visual.kind === 'INT' ? 1.35 : .75);
      const offset = Math.sin(index * 9.2 + age * 12) * .055;
      positions[index * 3] = THREE.MathUtils.lerp(start.x, end.x, t) + offset;
      positions[index * 3 + 1] = THREE.MathUtils.lerp(start.y + .35, end.y + .25, t) + arc;
      positions[index * 3 + 2] = THREE.MathUtils.lerp(start.z, end.z, t) + Math.cos(index * 5.7 + age * 9) * .055;
      const burstAge = Math.max(0, age - .35);
      const radius = Math.min(1.25, burstAge * 2.3);
      burstPositions[index * 3] = end.x + directions[index].x * radius;
      burstPositions[index * 3 + 1] = end.y + .16 + directions[index].y * radius;
      burstPositions[index * 3 + 2] = end.z + directions[index].z * radius;
    }
    if (attribute) attribute.needsUpdate = true;
    if (burstAttribute) burstAttribute.needsUpdate = true;
    if (burst.current) (burst.current.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - Math.max(0, age - .55) * 1.8);
    if (shockwave.current) {
      const pulse = 1 + Math.max(0, age - .32) * 2.5;
      shockwave.current.scale.setScalar(Math.min(3.2, pulse));
      (shockwave.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, .72 - Math.max(0, age - .32) * .65);
    }
  });

  return (
    <group>
      <points ref={stream}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial color={color} size={visual.kind === 'POW' ? .13 : .095} transparent opacity={.94} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points ref={burst}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[burstPositions, 3]} /></bufferGeometry>
        <pointsMaterial color={color} size={.12} transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <mesh ref={shockwave} position={[visual.end[0], .08, visual.end[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[.18, .25, 40]} />
        <meshBasicMaterial color={color} transparent opacity={.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight position={[visual.end[0], .8, visual.end[2]]} color={color} intensity={4.5} distance={4} />
    </group>
  );
}

function CutInCards({ ids, side, role }: { ids: string[]; side: 'left' | 'right'; role: string }) {
  return (
    <div className={`cutin-chain cutin-${side}`}>
      <small>{role}</small>
      <div className="cutin-card-row">
        {ids.map((id, index) => {
          const card = CARD_BY_ID[id];
          return (
            <div className="cutin-card" key={`${id}-${index}`} style={{ '--cutin-index': index } as React.CSSProperties}>
              <span>{index + 1}</span>
              <img src={card.image.replace('/detail/', '/scene/')} alt="" />
              <strong>{card.name}</strong>
              <em>{card.type} · {card.guts} Guts</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BattleCutIn({ visual }: { visual: CutInVisual }) {
  const attackIds = [...visual.attackIds, ...visual.modifierIds];
  const target = MONSTER_BY_ID[visual.targetId];
  return (
    <output className="battle-cutin" data-stage={visual.stage} aria-live="polite">
      <div className="cutin-speedlines" />
      <CutInCards ids={attackIds} side="left" role={visual.modifierIds.length ? 'ATTACK CHAIN + MODIFIER' : visual.attackIds.length > 1 ? 'ATTACK CHAIN' : 'ATTACK CARD'} />
      <div className="cutin-versus">
        <span>{visual.stage === 'defense' ? 'RESPONSE' : 'ENGAGE'}</span>
        <strong>{visual.stage === 'defense' ? `CHAIN ${visual.defenseIds.length}` : 'VS'}</strong>
        <i />
      </div>
      {visual.defenseIds.length ? <CutInCards ids={visual.defenseIds} side="right" role={visual.defenseIds.length > 1 ? 'ORDERED DEFENSE CHAIN' : 'DEFENSE CARD'} /> : (
        <div className="cutin-target">
          <small>TARGET</small>
          <img src={target.image.replace('/detail/', '/scene/')} alt="" />
          <strong>{target.name}</strong>
        </div>
      )}
    </output>
  );
}

function Arena({ state, onCard, combat }: { state: GameState; onCard: (id: string) => void; combat: CombatVisual | null }) {
  const hand = state.players[0].hand;
  const pendingCard = state.pendingAttack?.attackCards[0];
  const pendingOrigin = combat?.start ?? [0, .2, 2.8] as Point;
  return (
    <>
      <color attach="background" args={['#041113']} />
      <fog attach="fog" args={['#041113', 11.5, 20]} />
      <ambientLight intensity={1.35} />
      <hemisphereLight args={['#bff9ed', '#07100f', 1.15]} />
      <directionalLight castShadow position={[-3, 8, 5]} intensity={2.35} color="#fff0bd" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 3.2, -1]} intensity={1.2} color="#35d7bc" distance={10} />

      <mesh receiveShadow position={[0, -.22, 0]}>
        <boxGeometry args={[14, .34, 9]} />
        <meshStandardMaterial color="#0b352f" roughness={.93} metalness={.03} />
      </mesh>
      <mesh position={[0, -.035, -.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.15, 3.45, 72]} />
        <meshBasicMaterial color="#ceb94d" transparent opacity={.13} depthWrite={false} />
      </mesh>
      <gridHelper args={[14, 28, '#2e7468', '#17493f']} position={[0, -.04, 0]} />
      <mesh position={[0, .01, -4.33]}><boxGeometry args={[13.7, .18, .14]} /><meshStandardMaterial color="#e5c653" emissive="#765f13" emissiveIntensity={.7} /></mesh>

      {state.players[1].monsters.map((monster, index) => <CardPlane key={`e-${index}`} url={MONSTER_BY_ID[monster.definitionId].image.replace('/detail/', '/scene/')} position={monsterPosition(1, index)} rotation={(index - 1) * -.055} dim={monster.life <= 0} onSelect={() => onCard(monster.definitionId)} />)}
      {state.players[0].monsters.map((monster, index) => <CardPlane key={`p-${index}`} url={MONSTER_BY_ID[monster.definitionId].image.replace('/detail/', '/scene/')} position={monsterPosition(0, index)} rotation={(index - 1) * .055} dim={monster.life <= 0} onSelect={() => onCard(monster.definitionId)} />)}
      {hand.map((instance, index) => {
        const middle = (hand.length - 1) / 2;
        return <CardPlane key={instance.instanceId} url={CARD_BY_ID[instance.cardId].image.replace('/detail/', '/scene/')} position={[(index - middle) * .9, .24 + Math.abs(index - middle) * .025, 3.28 + Math.abs(index - middle) * .13]} rotation={(index - middle) * -.095} onSelect={() => onCard(instance.cardId)} />;
      })}
      {pendingCard && <CardPlane key={`active-${pendingCard.instanceId}`} url={CARD_BY_ID[pendingCard.cardId].image.replace('/detail/', '/scene/')} position={[0, .38, -.48]} from={pendingOrigin} active onSelect={() => onCard(pendingCard.cardId)} />}
      <Pile position={[-5.35, .02, 2.2]} color="#174d65" count={state.players[0].drawPile.length} rotation={-.07} />
      <Pile position={[5.35, .02, 2.2]} color="#6a4627" count={state.players[0].discard.length} rotation={.07} />
      <Pile position={[-5.35, .02, -2.45]} color="#254b5d" count={state.players[1].drawPile.length} rotation={.05} />
      <Pile position={[5.35, .02, -2.45]} color="#573b31" count={state.players[1].discard.length} rotation={-.05} />
      {combat && <CombatParticles key={combat.key} visual={combat} />}
      <CameraRig combat={combat} />
    </>
  );
}

export function Tabletop({ state, onCard }: { state: GameState; onCard: (id: string) => void }) {
  const [webgl, setWebgl] = useState(true);
  const [combat, setCombat] = useState<CombatVisual | null>(null);
  const [cutIn, setCutIn] = useState<CutInVisual | null>(null);
  const visualTimer = useRef<number | null>(null);
  const cutInTimer = useRef<number | null>(null);
  const seenVisual = useRef('');
  useEffect(() => {
    try { const canvas = document.createElement('canvas'); setWebgl(Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))); } catch { setWebgl(false); }
  }, []);
  useEffect(() => {
    const pending = state.pendingAttack;
    if (!pending) return;
    const target = pending.targets[pending.targetCursor];
    const key = `${pending.attackCards[0]?.instanceId}-${pending.targetCursor}-${state.eventSequence}`;
    if (!target || seenVisual.current === key) return;
    seenVisual.current = key;
    const start = pending.attackerMonster === null ? [0, .2, pending.sourcePlayer === 0 ? 2.65 : -3.35] as Point : monsterPosition(pending.sourcePlayer, pending.attackerMonster);
    const next = { key, kind: pending.type, start, end: monsterPosition(target.player, target.monster) } satisfies CombatVisual;
    setCombat(next);
    if (visualTimer.current) window.clearTimeout(visualTimer.current);
    visualTimer.current = window.setTimeout(() => setCombat(null), 1450);
  }, [state.eventSequence, state.pendingAttack]);
  useEffect(() => {
    const pending = state.pendingAttack;
    const latest = state.events.at(-1);
    if (!pending || !latest || (latest.kind !== 'play' && latest.kind !== 'defense')) return;
    const target = pending.targets[pending.targetCursor];
    if (!target) return;
    const next: CutInVisual = {
      key: `cutin-${state.eventSequence}`,
      stage: latest.kind === 'defense' ? 'defense' : 'attack',
      attackIds: pending.attackCards.map((card) => card.cardId),
      modifierIds: pending.modifierCards.map((card) => card.cardId),
      defenseIds: (pending.defenseCards ?? []).map((card) => card.cardId),
      targetId: state.players[target.player].monsters[target.monster].definitionId,
    };
    setCutIn(next);
    if (cutInTimer.current) window.clearTimeout(cutInTimer.current);
    cutInTimer.current = window.setTimeout(() => setCutIn(null), latest.kind === 'defense' ? 1750 : 1450);
  }, [state.eventSequence, state.events, state.pendingAttack, state.players]);
  useEffect(() => () => {
    if (visualTimer.current) window.clearTimeout(visualTimer.current);
    if (cutInTimer.current) window.clearTimeout(cutInTimer.current);
    document.body.style.cursor = '';
  }, []);

  const labels = useMemo(() => ([0, 1] as PlayerIndex[]).flatMap((player) => state.players[player].monsters.map((monster, index) => ({ player, index, monster, definition: MONSTER_BY_ID[monster.definitionId] }))), [state]);
  if (!webgl) return <div className="webgl-fallback"><strong>WebGL is unavailable.</strong><p>The rules engine and controls still work. Enable hardware acceleration to restore the 3D tabletop.</p></div>;
  return (
    <div className="tabletop-wrap perspective-table">
      <Canvas shadows camera={{ position: [0, 7.7, 9.7], fov: 45, near: .1, far: 40 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}>
        <Arena state={state} onCard={onCard} combat={combat} />
      </Canvas>
      <div className="perspective-hint" aria-hidden="true">BATTLE CAM // TACTICAL 03</div>
      {cutIn && <BattleCutIn key={cutIn.key} visual={cutIn} />}
      <div className="monster-labels" aria-label="Monster life totals">
        {labels.map(({ player, index, monster, definition }) => <button key={`${player}-${index}`} className={`monster-chip player-${player}`} data-ko={monster.life <= 0} onClick={() => onCard(monster.definitionId)}><span>{definition.name}</span><strong>{monster.life}/{definition.life}</strong><small>{monster.attribute}{monster.attacked ? ' · used' : ''}</small></button>)}
      </div>
      <div className="pile-label draw-label">DECK<br /><strong>{state.players[0].drawPile.length}</strong></div>
      <div className="pile-label discard-label">DISCARD<br /><strong>{state.players[0].discard.length}</strong></div>
    </div>
  );
}
