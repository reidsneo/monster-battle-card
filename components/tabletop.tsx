'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CARD_BY_ID, MONSTER_BY_ID } from '@/lib/game/cards';
import { effectProfile } from '@/lib/game/presentation';
import type {
  GameState,
  PlayerIndex,
  TargetIntent,
  VisualEffectProfile,
} from '@/lib/game/types';

type Point = [number, number, number];
type PileKind = 'deck' | 'guts' | 'discard';

interface CombatVisual {
  key: string;
  start: Point;
  end: Point;
  profile: VisualEffectProfile;
  stage: 'direction' | 'impact';
}
interface CutInVisual {
  key: string;
  stage: 'attack' | 'defense';
  attackIds: string[];
  modifierIds: string[];
  defenseIds: string[];
  targetId: string;
  damage: number;
}

export interface TabletopProps {
  state: GameState;
  legalHandIds: string[];
  chainOptionIds: string[];
  selectedInstanceIds: string[];
  legalTargets: TargetIntent[];
  inputLocked: boolean;
  reducedMotion: boolean;
  presentationSpeed: 1 | 1.5 | 2;
  onPreview: (id: string | null) => void;
  onInspect: (id: string) => void;
  onHandCard: (instanceId: string) => void;
  onMonster: (player: PlayerIndex, monster: number) => void;
  onDiscard: (player: PlayerIndex) => void;
  onCancel: () => void;
}

const monsterPosition = (player: PlayerIndex, index: number): Point => [
  (index - 1) * 2.23,
  0.17,
  player === 0 ? 0.72 : -2.42,
];

function useCardTexture(url: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let mounted = true;
    const loaded = new THREE.TextureLoader().load(url, (next) => {
      next.colorSpace = THREE.SRGBColorSpace;
      next.anisotropy = 4;
      next.needsUpdate = true;
      if (mounted) setTexture(next);
      else next.dispose();
    });
    return () => {
      mounted = false;
      loaded.dispose();
      setTexture(null);
    };
  }, [url]);
  return texture;
}

function CameraRig({
  combat,
  reducedMotion,
}: {
  combat: CombatVisual | null;
  reducedMotion: boolean;
}) {
  const { camera, pointer } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    if (combat) {
      look.set(
        (combat.start[0] + combat.end[0]) / 2,
        0,
        (combat.start[2] + combat.end[2]) / 2,
      );
      const shake =
        combat.stage === 'impact' && !reducedMotion
          ? combat.profile.shake * 0.035
          : 0;
      desired.set(
        look.x * 0.2 + Math.sin(clock.elapsedTime * 43) * shake,
        7.15,
        8.65 + look.z * 0.08 + Math.cos(clock.elapsedTime * 39) * shake,
      );
    } else {
      look.set(pointer.x * 0.16, 0, -0.35 + pointer.y * 0.08);
      desired.set(pointer.x * 0.26, 7.55 + pointer.y * 0.1, 9.35);
    }
    camera.position.lerp(
      desired,
      reducedMotion ? 0.16 : combat ? 0.075 : 0.035,
    );
    camera.lookAt(look);
  });
  return null;
}

function CardPlane({
  url,
  position,
  rotation = 0,
  scale = 1,
  dim = false,
  glow = false,
  selected = false,
  targetTone,
  damaged = false,
  onSelect,
  onPreview,
  onInspect,
}: {
  url: string;
  position: Point;
  rotation?: number;
  scale?: number;
  dim?: boolean;
  glow?: boolean;
  selected?: boolean;
  targetTone?: TargetIntent['tone'];
  damaged?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
  onInspect?: () => void;
}) {
  const texture = useCardTexture(url);
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const longPress = useRef<number | null>(null);
  const destination = useMemo(() => new THREE.Vector3(...position), [position]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        roughness: 0.55,
        metalness: 0.02,
      }),
    [],
  );
  const glowColor =
    targetTone === 'heal' ? '#65f6a2' : targetTone ? '#ffc85a' : '#52c9ff';

  useEffect(() => {
    material.map = texture;
    material.color.set(texture ? '#ffffff' : '#17363d');
    material.opacity = dim ? 0.38 : 1;
    material.emissive.set(
      damaged ? '#b51616' : selected ? '#317fa4' : '#000000',
    );
    material.emissiveIntensity = damaged ? 0.8 : selected ? 0.3 : 0;
    material.needsUpdate = true;
  }, [damaged, dim, material, selected, texture]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const lift = selected
      ? 0.66
      : glow
        ? 0.2 + Math.sin(clock.elapsedTime * 5) * 0.06
        : hovered
          ? 0.22
          : 0.02;
    group.current.position.x +=
      (destination.x - group.current.position.x) * 0.13;
    group.current.position.z +=
      (destination.z - group.current.position.z) * 0.13;
    group.current.position.y +=
      (destination.y + lift - group.current.position.y) * 0.13;
    group.current.rotation.y += (rotation - group.current.rotation.y) * 0.1;
    const damageShake = damaged ? Math.sin(clock.elapsedTime * 78) * 0.09 : 0;
    group.current.rotation.z =
      damageShake + (selected ? Math.sin(clock.elapsedTime * 2.2) * 0.018 : 0);
  });
  const clearPress = () => {
    if (longPress.current) window.clearTimeout(longPress.current);
    longPress.current = null;
  };

  return (
    <group ref={group} position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.065, 1.69]} />
        <meshStandardMaterial
          color={dim ? '#293132' : '#e8e8dc'}
          roughness={0.64}
        />
      </mesh>
      <mesh
        position={[0, 0.036, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
          onPreview?.();
          document.body.style.cursor = onSelect ? 'pointer' : 'zoom-in';
        }}
        onPointerLeave={() => {
          setHovered(false);
          clearPress();
          document.body.style.cursor = '';
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch' && onInspect)
            longPress.current = window.setTimeout(onInspect, 520);
        }}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        onClick={(event) => {
          event.stopPropagation();
          clearPress();
          onSelect?.();
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
          event.nativeEvent.preventDefault();
          onInspect?.();
        }}
      >
        <planeGeometry args={[1.16, 1.63]} />
        <primitive object={material} attach="material" />
      </mesh>
      {(glow || selected || hovered) && (
        <pointLight
          position={[0, 0.42, 0]}
          color={selected ? '#fff0a3' : glowColor}
          intensity={selected ? 3.2 : glow ? 2.2 : 0.8}
          distance={2.7}
        />
      )}
      {targetTone && (
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.73, 0.84, 40]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.82}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

function Pile({
  kind,
  position,
  count,
  topUrl,
  onSelect,
}: {
  kind: PileKind;
  position: Point;
  count: number;
  topUrl?: string;
  onSelect?: () => void;
}) {
  const url =
    kind === 'discard' && topUrl
      ? topUrl
      : '/card-art/scene/000-back-skill.webp';
  if (count === 0)
    return (
      <group position={position}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[1.22, 1.72]} />
          <meshBasicMaterial color="#24453d" transparent opacity={0.32} />
        </mesh>
      </group>
    );
  return (
    <group position={position}>
      {Array.from(
        { length: Math.min(5, Math.max(1, Math.ceil(count / 10))) },
        (_, index) => (
          <mesh key={index} castShadow position={[0, index * 0.035, 0]}>
            <boxGeometry args={[1.2, 0.055, 1.69]} />
            <meshStandardMaterial color="#d9d7c7" roughness={0.7} />
          </mesh>
        ),
      )}
      <CardPlane
        url={url}
        position={[0, Math.min(5, Math.ceil(count / 10)) * 0.035, 0]}
        glow={kind === 'discard'}
        onSelect={onSelect}
      />
    </group>
  );
}

function LowPolyTree({
  position,
  scale = 1,
}: {
  position: Point;
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.13, 0.2, 1.6, 7]} />
        <meshStandardMaterial color="#71502f" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 1.9, 0]}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color="#3e7b49" roughness={0.92} flatShading />
      </mesh>
      <mesh castShadow position={[0.35, 2.05, 0.05]}>
        <icosahedronGeometry args={[0.58, 1]} />
        <meshStandardMaterial color="#57965b" roughness={0.92} flatShading />
      </mesh>
    </group>
  );
}

function Windmill() {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.z -= delta * 0.42;
  });
  return (
    <group position={[-6.6, 0, -4.7]} rotation={[0, 0.35, 0]}>
      <mesh castShadow position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.45, 0.7, 2.9, 7]} />
        <meshStandardMaterial color="#d9c38d" roughness={0.9} flatShading />
      </mesh>
      <mesh castShadow position={[0, 3, 0]}>
        <coneGeometry args={[0.72, 0.8, 7]} />
        <meshStandardMaterial color="#84513c" roughness={0.95} />
      </mesh>
      <group ref={blades} position={[0, 2.45, 0.5]}>
        {[0, 1, 2, 3].map((index) => (
          <mesh
            key={index}
            rotation={[0, 0, (index * Math.PI) / 2]}
            position={[0, 0.75, 0]}
          >
            <boxGeometry args={[0.14, 1.35, 0.06]} />
            <meshStandardMaterial color="#eee0b4" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function RanchScenery() {
  return (
    <>
      <mesh receiveShadow position={[0, -0.55, 0]}>
        <boxGeometry args={[20, 0.7, 13]} />
        <meshStandardMaterial color="#497745" roughness={1} />
      </mesh>
      <Windmill />
      <LowPolyTree position={[-7.4, 0, 1.8]} scale={1.15} />
      <LowPolyTree position={[7.2, 0, -2.8]} scale={1.2} />
      <LowPolyTree position={[6.7, 0, 2.9]} scale={0.8} />
      {[-6, -4, -2, 0, 2, 4, 6].map((x) => (
        <group key={x} position={[x, 0.2, -5.2]}>
          <mesh castShadow>
            <boxGeometry args={[0.12, 0.75, 0.12]} />
            <meshStandardMaterial color="#8a6840" />
          </mesh>
          <mesh castShadow position={[0, 0.22, 0]}>
            <boxGeometry args={[2.1, 0.1, 0.1]} />
            <meshStandardMaterial color="#8a6840" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function AttackTrace({ visual }: { visual: CombatVisual }) {
  const orb = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);
  const points = useMemo(() => {
    const start = new THREE.Vector3(...visual.start).add(
      new THREE.Vector3(0, 0.35, 0),
    );
    const end = new THREE.Vector3(...visual.end).add(
      new THREE.Vector3(0, 0.3, 0),
    );
    const middle = start
      .clone()
      .lerp(end, 0.5)
      .add(new THREE.Vector3(0, 1.15, 0));
    return new THREE.QuadraticBezierCurve3(start, middle, end).getPoints(28);
  }, [visual.end, visual.start]);
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const t =
      ((clock.elapsedTime - born.current) *
        (visual.stage === 'direction' ? 0.55 : 1.5)) %
      1;
    orb.current?.position.copy(
      points[Math.min(points.length - 1, Math.floor(t * points.length))],
    );
  });
  return (
    <group>
      <line>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial
          color={visual.profile.color}
          transparent
          opacity={visual.stage === 'direction' ? 0.9 : 0.35}
        />
      </line>
      <mesh ref={orb}>
        <sphereGeometry
          args={[visual.stage === 'direction' ? 0.11 : 0.17, 12, 12]}
        />
        <meshBasicMaterial color={visual.profile.color} />
      </mesh>
    </group>
  );
}

function CombatParticles({ visual }: { visual: CombatVisual }) {
  const count = 86;
  const points = useRef<THREE.Points>(null);
  const born = useRef<number | null>(null);
  const positions = useMemo(() => new Float32Array(count * 3), []);
  useFrame(({ clock }) => {
    born.current ??= clock.elapsedTime;
    const age = clock.elapsedTime - born.current;
    const attribute = points.current?.geometry.getAttribute('position') as
      | THREE.BufferAttribute
      | undefined;
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.39996;
      const radius = Math.min(1.55, age * (1.4 + (index % 7) * 0.08));
      positions[index * 3] = visual.end[0] + Math.cos(angle) * radius;
      positions[index * 3 + 1] =
        visual.end[1] +
        0.16 +
        Math.sin(index * 0.9) * radius * 0.55 +
        (visual.profile.kind === 'heal' ? age * 0.7 : 0);
      positions[index * 3 + 2] = visual.end[2] + Math.sin(angle) * radius;
    }
    if (attribute) attribute.needsUpdate = true;
    if (points.current)
      (points.current.material as THREE.PointsMaterial).opacity = Math.max(
        0,
        1 - age * 0.7,
      );
  });
  return (
    <group>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={visual.profile.color}
          size={0.08 + visual.profile.intensity * 0.025}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {visual.profile.kind === 'slash' &&
        [-1, 0, 1].map((offset) => (
          <mesh
            key={offset}
            position={[visual.end[0] + offset * 0.18, 0.55, visual.end[2]]}
            rotation={[0, 0, -0.6]}
          >
            <boxGeometry args={[0.055, 1.6, 0.035]} />
            <meshBasicMaterial color="#fff1df" transparent opacity={0.85} />
          </mesh>
        ))}
      {visual.profile.kind === 'fang' &&
        [-1, 1].map((offset) => (
          <mesh
            key={offset}
            position={[visual.end[0] + offset * 0.27, 0.48, visual.end[2]]}
            rotation={[0, 0, offset * 0.22]}
          >
            <coneGeometry args={[0.13, 1.15, 8]} />
            <meshBasicMaterial color="#fff4d8" transparent opacity={0.9} />
          </mesh>
        ))}
    </group>
  );
}

function CutInCards({
  ids,
  side,
  role,
}: {
  ids: string[];
  side: 'left' | 'right';
  role: string;
}) {
  return (
    <div className={`cutin-chain cutin-${side}`}>
      <small>{role}</small>
      <div className="cutin-card-row">
        {ids.map((id, index) => {
          const card = CARD_BY_ID[id];
          return (
            <div
              className="cutin-card"
              key={`${id}-${index}`}
              style={{ '--cutin-index': index } as React.CSSProperties}
            >
              <span>{index + 1}</span>
              <img src={card.image.replace('/detail/', '/scene/')} alt="" />
              <strong>{card.name}</strong>
              <em>
                {card.type} · {card.guts} Guts
              </em>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BattleCutIn({
  visual,
  speed,
}: {
  visual: CutInVisual;
  speed: 1 | 1.5 | 2;
}) {
  const attackIds = [...visual.attackIds, ...visual.modifierIds];
  const target = MONSTER_BY_ID[visual.targetId];
  const revealCount = Math.max(1, attackIds.length, visual.defenseIds.length);
  return (
    <output
      className="battle-cutin"
      data-stage={visual.stage}
      aria-live="polite"
      style={
        {
          '--cutin-step': `${600 / speed}ms`,
          '--cutin-duration': `${(900 + Math.max(0, revealCount - 1) * 600) / speed}ms`,
        } as React.CSSProperties
      }
    >
      <div className="cutin-speedlines" />
      <CutInCards
        ids={attackIds}
        side="left"
        role={
          visual.modifierIds.length
            ? 'ATTACK + MODIFIER'
            : visual.attackIds.length > 1
              ? 'ATTACK CHAIN'
              : 'ATTACK CARD'
        }
      />
      <div className="cutin-versus">
        <span>
          {visual.stage === 'defense' ? 'RESPONSE' : 'DIRECTION LOCKED'}
        </span>
        <strong>
          {visual.stage === 'defense'
            ? `CHAIN ${visual.defenseIds.length}`
            : `${visual.damage} DMG`}
        </strong>
        <i />
      </div>
      {visual.defenseIds.length ? (
        <CutInCards
          ids={visual.defenseIds}
          side="right"
          role={
            visual.defenseIds.length > 1 ? 'ORDERED DEFENSE' : 'DEFENSE CARD'
          }
        />
      ) : (
        <div className="cutin-target">
          <small>TARGET</small>
          <img src={target.image.replace('/detail/', '/scene/')} alt="" />
          <strong>{target.name}</strong>
        </div>
      )}
    </output>
  );
}

function Arena({
  props,
  combat,
  damagedTarget,
}: {
  props: TabletopProps;
  combat: CombatVisual | null;
  damagedTarget: string | null;
}) {
  const { state } = props;
  const hand = state.players[0].hand;
  const targetMap = new Map(
    props.legalTargets.map((intent) => [
      `${intent.target.player}-${intent.target.monster}`,
      intent.tone,
    ]),
  );
  const legal = new Set(props.legalHandIds);
  const chain = new Set(props.chainOptionIds);
  const selected = new Set(props.selectedInstanceIds);
  const playerDiscard = state.players[0].discard.at(-1);
  const rivalDiscard = state.players[1].discard.at(-1);
  return (
    <>
      <color attach="background" args={['#9dc6a4']} />
      <fog attach="fog" args={['#8eb49a', 10.5, 23]} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={['#fff2c9', '#345437', 1.45]} />
      <directionalLight
        castShadow
        position={[-4, 9, 6]}
        intensity={2.5}
        color="#fff0bd"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <RanchScenery />
      <mesh receiveShadow position={[0, -0.18, -0.25]}>
        <boxGeometry args={[13.9, 0.34, 8.8]} />
        <meshStandardMaterial
          color="#37645d"
          roughness={0.87}
          metalness={0.03}
        />
      </mesh>
      <mesh position={[0, 0.005, -0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 3.6, 72]} />
        <meshBasicMaterial
          color="#efd26b"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <gridHelper
        args={[13.6, 24, '#d4c25c', '#568b7a']}
        position={[0, -0.005, -0.25]}
      />
      {state.environment && (
        <CardPlane
          url={CARD_BY_ID[state.environment.card.cardId].image.replace(
            '/detail/',
            '/scene/',
          )}
          position={[4.55, 0.04, -0.25]}
          rotation={state.environment.owner === 0 ? -0.08 : 0.08}
          scale={0.72}
          onPreview={() => props.onPreview(state.environment!.card.cardId)}
          onInspect={() => props.onInspect(state.environment!.card.cardId)}
        />
      )}
      {state.players[1].monsters.map((monster, index) => (
        <CardPlane
          key={`e-${index}`}
          url={MONSTER_BY_ID[monster.definitionId].image.replace(
            '/detail/',
            '/scene/',
          )}
          position={monsterPosition(1, index)}
          rotation={(index - 1) * -0.055}
          dim={monster.life <= 0}
          glow={targetMap.has(`1-${index}`)}
          targetTone={targetMap.get(`1-${index}`)}
          damaged={damagedTarget === `1-${index}`}
          onSelect={() => !props.inputLocked && props.onMonster(1, index)}
          onPreview={() => props.onPreview(monster.definitionId)}
          onInspect={() => props.onInspect(monster.definitionId)}
        />
      ))}
      {state.players[0].monsters.map((monster, index) => (
        <CardPlane
          key={`p-${index}`}
          url={MONSTER_BY_ID[monster.definitionId].image.replace(
            '/detail/',
            '/scene/',
          )}
          position={monsterPosition(0, index)}
          rotation={(index - 1) * 0.055}
          dim={monster.life <= 0}
          glow={targetMap.has(`0-${index}`)}
          targetTone={targetMap.get(`0-${index}`)}
          damaged={damagedTarget === `0-${index}`}
          onSelect={() => !props.inputLocked && props.onMonster(0, index)}
          onPreview={() => props.onPreview(monster.definitionId)}
          onInspect={() => props.onInspect(monster.definitionId)}
        />
      ))}
      {hand.map((instance, index) => {
        const middle = (hand.length - 1) / 2;
        return (
          <CardPlane
            key={instance.instanceId}
            url={CARD_BY_ID[instance.cardId].image.replace(
              '/detail/',
              '/scene/',
            )}
            position={[
              (index - middle) * 0.88,
              0.24 + Math.abs(index - middle) * 0.025,
              3.25 + Math.abs(index - middle) * 0.12,
            ]}
            rotation={(index - middle) * -0.095}
            glow={
              !props.inputLocked &&
              (legal.has(instance.instanceId) || chain.has(instance.instanceId))
            }
            selected={selected.has(instance.instanceId)}
            onSelect={() =>
              !props.inputLocked && props.onHandCard(instance.instanceId)
            }
            onPreview={() => props.onPreview(instance.cardId)}
            onInspect={() => props.onInspect(instance.cardId)}
          />
        );
      })}
      {Array.from(
        { length: Math.min(5, state.players[1].hand.length) },
        (_, index) => (
          <CardPlane
            key={`enemy-hand-${index}`}
            url="/card-art/scene/000-back-skill.webp"
            position={[
              (index - 2) * 0.55,
              0.18,
              -4.15 - Math.abs(index - 2) * 0.08,
            ]}
            rotation={(index - 2) * 0.07}
            dim
          />
        ),
      )}
      <Pile
        kind="deck"
        position={[-5.55, 0.02, 2.25]}
        count={state.players[0].drawPile.length}
      />
      <Pile
        kind="discard"
        position={[5.55, 0.02, 2.25]}
        count={state.players[0].discard.length}
        topUrl={
          playerDiscard
            ? CARD_BY_ID[playerDiscard.cardId].image.replace(
                '/detail/',
                '/scene/',
              )
            : undefined
        }
        onSelect={() => props.onDiscard(0)}
      />
      <Pile
        kind="guts"
        position={[-4.25, 0.02, 2.45]}
        count={state.players[0].guts.length}
      />
      <Pile
        kind="deck"
        position={[5.55, 0.02, -2.65]}
        count={state.players[1].drawPile.length}
      />
      <Pile
        kind="discard"
        position={[-5.55, 0.02, -2.65]}
        count={state.players[1].discard.length}
        topUrl={
          rivalDiscard
            ? CARD_BY_ID[rivalDiscard.cardId].image.replace(
                '/detail/',
                '/scene/',
              )
            : undefined
        }
        onSelect={() => props.onDiscard(1)}
      />
      <Pile
        kind="guts"
        position={[4.25, 0.02, -2.8]}
        count={state.players[1].guts.length}
      />
      {combat && (
        <>
          <AttackTrace visual={combat} />
          {combat.stage === 'impact' && !props.reducedMotion && (
            <CombatParticles key={combat.key} visual={combat} />
          )}
        </>
      )}
      <CameraRig combat={combat} reducedMotion={props.reducedMotion} />
    </>
  );
}

export function Tabletop(props: TabletopProps) {
  const { state } = props;
  const [webgl, setWebgl] = useState(true);
  const [combat, setCombat] = useState<CombatVisual | null>(null);
  const [cutIn, setCutIn] = useState<CutInVisual | null>(null);
  const [damagedTarget, setDamagedTarget] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const seenEvent = useRef(0);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      setWebgl(
        Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')),
      );
    } catch {
      setWebgl(false);
    }
  }, []);
  useEffect(() => {
    const latest = state.events.at(-1);
    if (!latest || latest.id === seenEvent.current) return;
    seenEvent.current = latest.id;
    const data = latest.data;
    if (!data?.target) return;
    const start =
      data.sourceMonster == null
        ? ([0, 0.2, data.actor === 0 ? 2.7 : -3.3] as Point)
        : monsterPosition(data.actor ?? state.activePlayer, data.sourceMonster);
    const end = monsterPosition(data.target.player, data.target.monster);
    const profile = effectProfile(data.cardIds?.[0]);
    if (latest.kind === 'play' && data.role === 'special') {
      setCombat({
        key: `special-${latest.id}`,
        start,
        end,
        profile,
        stage: 'impact',
      });
      timers.current.push(
        window.setTimeout(
          () => setCombat(null),
          props.reducedMotion ? 350 : 1050 / props.presentationSpeed,
        ),
      );
    } else if (latest.kind === 'play') {
      const pending = state.pendingAttack;
      setCombat({
        key: `direction-${latest.id}`,
        start,
        end,
        profile,
        stage: 'direction',
      });
      timers.current.push(
        window.setTimeout(
          () => {
            if (!pending) return;
            setCutIn({
              key: `cutin-${latest.id}`,
              stage: 'attack',
              attackIds: pending.attackCards.map((card) => card.cardId),
              modifierIds: pending.modifierCards.map((card) => card.cardId),
              defenseIds: [],
              targetId:
                state.players[data.target!.player].monsters[
                  data.target!.monster
                ].definitionId,
              damage: data.amount ?? pending.baseDamage,
            });
          },
          props.reducedMotion ? 80 : 600 / props.presentationSpeed,
        ),
      );
      const revealCount = Math.max(
        1,
        (pending?.attackCards.length ?? 0) +
          (pending?.modifierCards.length ?? 0),
      );
      timers.current.push(
        window.setTimeout(
          () => {
            setCutIn(null);
            setCombat(null);
          },
          props.reducedMotion
            ? 500
            : (1750 + Math.max(0, revealCount - 1) * 600) /
                props.presentationSpeed,
        ),
      );
    } else if (latest.kind === 'defense' && state.pendingAttack) {
      setCutIn({
        key: `defense-${latest.id}`,
        stage: 'defense',
        attackIds: state.pendingAttack.attackCards.map((card) => card.cardId),
        modifierIds: state.pendingAttack.modifierCards.map(
          (card) => card.cardId,
        ),
        defenseIds: state.pendingAttack.defenseCards.map((card) => card.cardId),
        targetId:
          state.players[data.target.player].monsters[data.target.monster]
            .definitionId,
        damage: state.pendingAttack.workingDamage,
      });
      timers.current.push(
        window.setTimeout(
          () => setCutIn(null),
          props.reducedMotion
            ? 450
            : (1150 +
                Math.max(0, state.pendingAttack.defenseCards.length - 1) *
                  600) /
                props.presentationSpeed,
        ),
      );
    } else if (latest.kind === 'damage') {
      setCombat({
        key: `impact-${latest.id}`,
        start,
        end,
        profile,
        stage: 'impact',
      });
      setDamagedTarget(`${data.target.player}-${data.target.monster}`);
      timers.current.push(
        window.setTimeout(
          () => {
            setCombat(null);
            setDamagedTarget(null);
          },
          props.reducedMotion ? 350 : 1050 / props.presentationSpeed,
        ),
      );
    }
  }, [
    props.reducedMotion,
    props.presentationSpeed,
    state.activePlayer,
    state.events,
    state.pendingAttack,
    state.players,
  ]);
  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      document.body.style.cursor = '';
    },
    [],
  );
  const labels = useMemo(
    () =>
      ([0, 1] as PlayerIndex[]).flatMap((player) =>
        state.players[player].monsters.map((monster, index) => ({
          player,
          index,
          monster,
          definition: MONSTER_BY_ID[monster.definitionId],
        })),
      ),
    [state],
  );
  if (!webgl)
    return (
      <div className="fallback-board">
        <header>
          <strong>2D BATTLE MODE</strong>
          <span>
            Hardware acceleration is unavailable; all game actions remain
            playable.
          </span>
        </header>
        <section className="fallback-monsters rival">
          {state.players[1].monsters.map((monster, index) => {
            const definition = MONSTER_BY_ID[monster.definitionId];
            return (
              <button
                key={monster.definitionId}
                data-targeted={props.legalTargets.some(
                  (item) =>
                    item.target.player === 1 && item.target.monster === index,
                )}
                onMouseEnter={() => props.onPreview(monster.definitionId)}
                onClick={() => props.onMonster(1, index)}
              >
                <img
                  src={definition.image.replace('/detail/', '/scene/')}
                  alt={definition.name}
                />
                <span>
                  {definition.name}
                  <b>
                    {monster.life}/{definition.life}
                  </b>
                </span>
              </button>
            );
          })}
        </section>
        <div className="fallback-piles">
          <button onClick={() => props.onDiscard(1)}>
            Rival discard {state.players[1].discard.length}
          </button>
          <span>Rival deck {state.players[1].drawPile.length}</span>
          <span>Your deck {state.players[0].drawPile.length}</span>
          <button onClick={() => props.onDiscard(0)}>
            Your discard {state.players[0].discard.length}
          </button>
        </div>
        <section className="fallback-monsters player">
          {state.players[0].monsters.map((monster, index) => {
            const definition = MONSTER_BY_ID[monster.definitionId];
            return (
              <button
                key={monster.definitionId}
                data-targeted={props.legalTargets.some(
                  (item) =>
                    item.target.player === 0 && item.target.monster === index,
                )}
                onMouseEnter={() => props.onPreview(monster.definitionId)}
                onClick={() => props.onMonster(0, index)}
              >
                <img
                  src={definition.image.replace('/detail/', '/scene/')}
                  alt={definition.name}
                />
                <span>
                  {definition.name}
                  <b>
                    {monster.life}/{definition.life}
                  </b>
                </span>
              </button>
            );
          })}
        </section>
        <section className="fallback-hand">
          {state.players[0].hand.map((instance) => {
            const card = CARD_BY_ID[instance.cardId];
            return (
              <button
                key={instance.instanceId}
                data-legal={
                  props.legalHandIds.includes(instance.instanceId) ||
                  props.chainOptionIds.includes(instance.instanceId)
                }
                data-selected={props.selectedInstanceIds.includes(
                  instance.instanceId,
                )}
                onMouseEnter={() => props.onPreview(instance.cardId)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  props.onInspect(instance.cardId);
                }}
                onClick={() => props.onHandCard(instance.instanceId)}
              >
                <img
                  src={card.image.replace('/detail/', '/scene/')}
                  alt={card.name}
                />
                <span>{card.name}</span>
              </button>
            );
          })}
        </section>
      </div>
    );
  return (
    <div
      className="tabletop-wrap perspective-table"
      onContextMenu={(event) => event.preventDefault()}
    >
      <Canvas
        shadows
        camera={{ position: [0, 7.55, 9.35], fov: 46, near: 0.1, far: 40 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onPointerMissed={() => props.onCancel()}
      >
        <Arena props={props} combat={combat} damagedTarget={damagedTarget} />
      </Canvas>
      {cutIn && (
        <BattleCutIn
          key={cutIn.key}
          visual={cutIn}
          speed={props.presentationSpeed}
        />
      )}
      <div className="monster-labels" aria-label="Monster life totals">
        {labels.map(({ player, index, monster, definition }) => (
          <button
            key={`${player}-${index}`}
            className={`monster-chip player-${player}`}
            data-ko={monster.life <= 0}
            data-targeted={props.legalTargets.some(
              (item) =>
                item.target.player === player && item.target.monster === index,
            )}
            data-damaged={damagedTarget === `${player}-${index}`}
            onMouseEnter={() => props.onPreview(monster.definitionId)}
            onClick={() => !props.inputLocked && props.onMonster(player, index)}
            onContextMenu={(event) => {
              event.preventDefault();
              props.onInspect(monster.definitionId);
            }}
          >
            <span>{definition.name}</span>
            <strong>
              {monster.life}/{definition.life}
            </strong>
            <small>
              {monster.attribute}
              {monster.attacked ? ' · used' : ''}
            </small>
          </button>
        ))}
      </div>
      <div className="pile-label draw-label">
        DECK <strong>{state.players[0].drawPile.length}</strong>
      </div>
      <button
        className="pile-label discard-label"
        onClick={() => props.onDiscard(0)}
      >
        DISCARD <strong>{state.players[0].discard.length}</strong>
      </button>
      <div className="pile-label guts-label">
        GUTS <strong>{state.players[0].guts.length}</strong>
      </div>
    </div>
  );
}
