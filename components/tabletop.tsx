'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { CARD_BY_ID, MONSTER_BY_ID } from '@/lib/game/cards';
import type { DuelCue } from '@/lib/game/battle-director';
import { SakuraArena } from '@/components/battle/sakura-arena';
import { BattleEffects } from '@/components/battle/battle-effects';
import type {
  GameState,
  PlayerIndex,
  TargetIntent,
  VisualEffectProfile,
} from '@/lib/game/types';

type Point = [number, number, number];
type PileKind = 'deck' | 'guts' | 'discard';
const ReducedMotion = createContext(false);
const DUEL_SHADOWS = { type: THREE.PCFShadowMap };

interface CombatVisual {
  key: string;
  start: Point;
  end: Point;
  profile: VisualEffectProfile;
  stage: 'direction' | 'impact';
  duration: number;
}
interface CutInVisual {
  key: string;
  stage: 'attack' | 'defense';
  attackIds: string[];
  modifierIds: string[];
  defenseIds: string[];
  targetId: string;
  damage: number;
  sourceName: string;
  targetName: string;
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
  presentationCue: DuelCue | null;
  cameraMotion: boolean;
  particleDensity: 'low' | 'high';
  onAdvance: () => void;
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
  const born = useRef(0);
  const lastKey = useRef('');
  useFrame(({ clock }) => {
    if (combat && !reducedMotion) {
      if (lastKey.current !== combat.key) {
        lastKey.current = combat.key;
        born.current = clock.elapsedTime;
      }
      const decay = Math.max(
        0,
        1 - (clock.elapsedTime - born.current) / (combat.duration / 1000),
      );
      look.set(
        ((combat.start[0] + combat.end[0]) / 2) * 0.28,
        0,
        ((combat.start[2] + combat.end[2]) / 2) * 0.35,
      );
      const shake =
        combat.stage === 'impact' && !reducedMotion
          ? combat.profile.shake * 0.065 * decay * decay
          : 0;
      desired.set(
        look.x * 0.2 + Math.sin(clock.elapsedTime * 43) * shake,
        combat.stage === 'direction' ? 8.9 : 8.15,
        10.65 + look.z * 0.08 + Math.cos(clock.elapsedTime * 39) * shake,
      );
    } else {
      look.set(
        reducedMotion ? 0 : pointer.x * 0.1,
        0,
        -0.35 + (reducedMotion ? 0 : pointer.y * 0.05),
      );
      desired.set(reducedMotion ? 0 : pointer.x * 0.18, 8.4, 11.1);
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
  const reducedMotion = useContext(ReducedMotion);
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
        ? 0.2 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 5) * 0.06)
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
    const damageShake =
      damaged && !reducedMotion ? Math.sin(clock.elapsedTime * 78) * 0.09 : 0;
    group.current.rotation.z =
      damageShake +
      (selected && !reducedMotion
        ? Math.sin(clock.elapsedTime * 2.2) * 0.018
        : 0);
  });
  const clearPress = () => {
    if (longPress.current) window.clearTimeout(longPress.current);
    longPress.current = null;
  };

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotation, 0]}
      scale={scale}
    >
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
        <mesh position={[0, -0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.29, 1.78]} />
          <meshBasicMaterial
            color={selected ? '#fff0a3' : glowColor}
            transparent
            opacity={selected ? 0.85 : glow ? 0.7 : 0.3}
          />
        </mesh>
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
          if (!card) return null;
          return (
            <div
              className="cutin-card"
              key={`${id}-${index}`}
              style={{ '--cutin-index': 0 } as React.CSSProperties}
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
      <div className="cutin-nameplates">
        <span>{visual.sourceName}</span>
        <small>
          {visual.stage === 'defense' ? 'DEFENSE RESPONSE' : 'SKILL ACTIVATED'}
        </small>
        <span>{visual.targetName}</span>
      </div>
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
      ) : target ? (
        <div className="cutin-target">
          <small>TARGET</small>
          <img src={target.image.replace('/detail/', '/scene/')} alt="" />
          <strong>{target.name}</strong>
        </div>
      ) : (
        <div className="cutin-target">
          <small>BREEDER SKILL</small>
          <strong>{visual.targetName}</strong>
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
      <SakuraArena
        reducedMotion={props.reducedMotion}
        owner={state.activePlayer}
        particles={props.particleDensity === 'high'}
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
      {([0, 1] as PlayerIndex[]).flatMap((player) =>
        state.players[player].monsters.map((monster, index) => {
          const definition = MONSTER_BY_ID[monster.definitionId];
          const position = monsterPosition(player, index);
          return (
            <Html
              key={`${player}-${index}`}
              center
              position={[position[0], 0.38, position[2] + 1.08]}
              zIndexRange={[7, 6]}
            >
              <button
                className="monster-chip projected-monster-chip"
                data-ko={monster.life <= 0}
                data-targeted={targetMap.has(`${player}-${index}`)}
                data-damaged={damagedTarget === `${player}-${index}`}
                onMouseEnter={() => props.onPreview(monster.definitionId)}
                onFocus={() => props.onPreview(monster.definitionId)}
                onClick={() =>
                  !props.inputLocked && props.onMonster(player, index)
                }
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
            </Html>
          );
        }),
      )}
      {(
        [
          {
            player: 0,
            kind: 'deck',
            x: -5.55,
            z: 2.25,
            count: state.players[0].drawPile.length,
          },
          {
            player: 0,
            kind: 'guts',
            x: -4.25,
            z: 2.45,
            count: state.players[0].guts.length,
          },
          {
            player: 0,
            kind: 'discard',
            x: 5.55,
            z: 2.25,
            count: state.players[0].discard.length,
          },
          {
            player: 1,
            kind: 'deck',
            x: 5.55,
            z: -2.65,
            count: state.players[1].drawPile.length,
          },
          {
            player: 1,
            kind: 'guts',
            x: 4.25,
            z: -2.8,
            count: state.players[1].guts.length,
          },
          {
            player: 1,
            kind: 'discard',
            x: -5.55,
            z: -2.65,
            count: state.players[1].discard.length,
          },
        ] as const
      ).map((pile) => (
        <Html
          key={`${pile.player}-${pile.kind}`}
          center
          position={[pile.x, 0.24, pile.z + 1.02]}
          zIndexRange={[6, 5]}
        >
          {pile.kind === 'discard' ? (
            <button
              className="arena-pile-label"
              onClick={() => props.onDiscard(pile.player)}
              aria-label={`${pile.player ? 'Rival' : 'Your'} discard, ${pile.count} cards`}
            >
              DISCARD <b>{pile.count}</b>
            </button>
          ) : (
            <span className="arena-pile-label">
              {pile.kind.toUpperCase()} <b>{pile.count}</b>
            </span>
          )}
        </Html>
      ))}
      {combat && props.presentationCue && (
        <BattleEffects
          key={combat.key}
          cue={props.presentationCue}
          start={combat.start}
          end={combat.end}
          reducedMotion={props.reducedMotion}
          density={props.particleDensity}
          speed={props.presentationSpeed}
        />
      )}
      <CameraRig
        combat={combat}
        reducedMotion={props.reducedMotion || !props.cameraMotion}
      />
    </>
  );
}

export function Tabletop(props: TabletopProps) {
  const { state } = props;
  const [webgl, setWebgl] = useState(true);
  const cue = props.presentationCue;
  const combat: CombatVisual | null =
    cue && ['direction', 'impact'].includes(cue.kind) && cue.target
      ? {
          key: cue.id,
          start: cue.source
            ? monsterPosition(cue.source.player, cue.source.monster)
            : [0, 0.2, cue.owner === 0 ? 2.7 : -3.3],
          end: monsterPosition(cue.target.player, cue.target.monster),
          profile: cue.profile,
          stage: cue.kind === 'direction' ? 'direction' : 'impact',
          duration: cue.duration / props.presentationSpeed,
        }
      : null;
  const damagedTarget =
    cue?.kind === 'impact' &&
    cue.event?.kind === 'damage' &&
    cue.amount &&
    cue.target
      ? `${cue.target.player}-${cue.target.monster}`
      : null;
  const cutIn: CutInVisual | null =
    cue?.kind === 'reveal'
      ? {
          key: `reveal-${cue.event?.id}`,
          stage: cue.response ? 'defense' : 'attack',
          attackIds: cue.response ? cue.attackIds : cue.shownIds,
          modifierIds: [],
          defenseIds: cue.response ? cue.shownIds : [],
          targetId: cue.target
            ? state.players[cue.target.player].monsters[cue.target.monster]
                .definitionId
            : '',
          damage: cue.amount ?? 0,
          sourceName: cue.sourceName,
          targetName: cue.targetName,
        }
      : null;
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
  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
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
      data-reduced={props.reducedMotion}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Canvas
        shadows={DUEL_SHADOWS}
        camera={{ position: [0, 8.4, 11.1], fov: 46, near: 0.1, far: 65 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onPointerMissed={() => props.onCancel()}
      >
        <ReducedMotion value={props.reducedMotion}>
          <Arena props={props} combat={combat} damagedTarget={damagedTarget} />
        </ReducedMotion>
      </Canvas>
      <div className="arena-location">
        <span>花見</span>
        <div>
          <small>KOMOREBI TOWN</small>
          <strong>Sakura Duel Court</strong>
        </div>
      </div>
      {cue && ['direction', 'calculation'].includes(cue.kind) && (
        <output className="duel-direction" key={cue.id} aria-live="polite">
          <small>
            {cue.kind === 'direction' ? 'ATTACK DECLARED' : 'DAMAGE RESOLUTION'}
          </small>
          <div>
            <strong>{cue.sourceName}</strong>
            <span>⟶</span>
            <strong>{cue.targetName}</strong>
          </div>
          <p>
            {cue.kind === 'direction'
              ? 'Preparing skill chain'
              : `${cue.amount ?? 0} damage after responses`}
          </p>
        </output>
      )}
      {cue?.kind === 'impact' && !props.reducedMotion && (
        <div
          key={cue.id}
          className="impact-wash"
          style={{ '--impact-color': cue.profile.color } as React.CSSProperties}
        />
      )}
      {cue && cue.kind !== 'phase' && (
        <button className="cinematic-advance" onClick={props.onAdvance}>
          Space / tap · Next beat
        </button>
      )}
      {cutIn && (
        <BattleCutIn
          key={cutIn.key}
          visual={cutIn}
          speed={props.presentationSpeed}
        />
      )}
    </div>
  );
}
