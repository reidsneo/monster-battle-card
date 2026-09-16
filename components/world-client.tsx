'use client';

import { Canvas } from '@react-three/fiber';
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { PCFShadowMap } from 'three';
import { ChibiPortrait, NPC_COLORS } from '@/components/world/chibi-portrait';
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
import {
  EMPTY_MOTION,
  WorldScene,
  type Motion,
} from '@/components/world/world-scene';

const WORLD_SHADOWS = { type: PCFShadowMap };

export function WorldClient() {
  const params = useSearchParams();
  const [save, setSave] = useState<CampaignSaveV1 | null>(null);
  const [motion, setMotion] = useState<Motion>(EMPTY_MOTION);
  const [cameraYaw, setCameraYaw] = useState(0);
  const [nearby, setNearby] = useState<NpcDefinition | null>(null);
  const [dialogueNpc, setDialogueNpc] = useState<NpcDefinition | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const latestSave = useRef<CampaignSaveV1 | null>(null);
  const cameraDrag = useRef<{ pointerId: number; x: number } | null>(null);
  const dragDistance = useRef(0);
  useEffect(() => {
    void loadCampaign().then((campaign) => {
      setSave(campaign);
      setLoaded(true);
    });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => {
      let savedPreference = false;
      try {
        savedPreference = Boolean(
          JSON.parse(window.localStorage.getItem('mrbc-presentation') ?? '{}')
            .reducedMotion,
        );
      } catch {
        /* use system preference */
      }
      setReducedMotion(media.matches || savedPreference);
    };
    updateMotionPreference();
    media.addEventListener('change', updateMotionPreference);
    try {
      const canvas = document.createElement('canvas');
      setWebgl(
        Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')),
      );
    } catch {
      setWebgl(false);
    }
    return () => media.removeEventListener('change', updateMotionPreference);
  }, []);
  useEffect(() => {
    latestSave.current = save;
  }, [save]);
  const updatePosition = useCallback(
    (position: [number, number, number], yaw: number) => {
      setSave((current) => (current ? { ...current, position, yaw } : current));
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        if (latestSave.current) void saveCampaign(latestSave.current);
      }, 450);
    },
    [],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (latestSave.current) void saveCampaign(latestSave.current);
    },
    [],
  );
  const openDialogue = useCallback((npc: NpcDefinition) => {
    if (dragDistance.current > 5) return;
    setMotion(EMPTY_MOTION);
    setDialogueNpc(npc);
  }, []);
  useEffect(() => {
    const interact = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'Escape') setDialogueNpc(null);
      if (event.key.toLowerCase() === 'e' && nearby && !dialogueNpc) {
        setMotion(EMPTY_MOTION);
        setDialogueNpc(nearby);
      }
    };
    window.addEventListener('keydown', interact);
    return () => window.removeEventListener('keydown', interact);
  }, [nearby, dialogueNpc]);
  if (!loaded)
    return (
      <main className="loading-screen">
        <span className="brand-mark">MR</span>
        <p>Opening the town gates…</p>
      </main>
    );
  if (!save)
    return (
      <main className="world-missing">
        <div className="brand-mark">MR</div>
        <h1>No journey found</h1>
        <p>Begin a journey at the title screen before entering the town.</p>
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
    setDialogueNpc(null);
    setNearby(null);
    setMotion(EMPTY_MOTION);
    cameraDrag.current = null;
    setSave(next);
    latestSave.current = next;
    void saveCampaign(next);
  };
  return (
    <main
      className="world-shell"
      onPointerDown={(event) => {
        if (!(event.target instanceof HTMLCanvasElement)) return;
        dragDistance.current = 0;
        cameraDrag.current = { pointerId: event.pointerId, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (cameraDrag.current?.pointerId !== event.pointerId) return;
        const delta = event.clientX - cameraDrag.current.x;
        dragDistance.current += Math.abs(delta);
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
          <h2>Opening the town…</h2>
        </section>
      ) : webgl ? (
        <Canvas
          shadows={WORLD_SHADOWS}
          camera={{ position: [0, 4.8, 13.5], fov: 55, near: 0.1, far: 85 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <WorldScene
            key={save.areaId}
            save={save}
            motion={motion}
            cameraYaw={cameraYaw}
            dialogueNpc={dialogueNpc}
            reducedMotion={reducedMotion}
            onPosition={updatePosition}
            onNear={setNearby}
            onNpc={openDialogue}
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
        <ChibiPortrait
          key={save.outfit}
          color={OUTFIT_PALETTES[save.outfit].color}
          fallback={OUTFIT_PALETTES[save.outfit].portrait}
          name="Breeder"
        />
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
          onClick={() => {
            dragDistance.current = 0;
            openDialogue(nearby);
          }}
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
        disabled={
          Boolean(dialogueNpc) ||
          (save.areaId === 'ranch' && !festivalUnlocked(save))
        }
        onClick={travel}
      >
        <Map />
        <span>
          {WORLDS[save.areaId === 'ranch' ? 'festival' : 'ranch'].name}
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
          {(['forward', 'left', 'back', 'right'] as const).map(
            (direction, index) => (
              <button
                key={direction}
                aria-label={`Move ${direction}`}
                disabled={Boolean(dialogueNpc)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setMotion((value) => ({ ...value, [direction]: true }));
                }}
                onPointerUp={(event) => {
                  setMotion((value) => ({ ...value, [direction]: false }));
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => setMotion(EMPTY_MOTION)}
                onLostPointerCapture={() =>
                  setMotion((value) => ({ ...value, [direction]: false }))
                }
              >
                {['▲', '◀', '▼', '▶'][index]}
              </button>
            ),
          )}
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
        <dialog
          open
          className="npc-dialogue"
          aria-modal="true"
          aria-labelledby="journey-dialogue-name"
        >
          <ChibiPortrait
            key={dialogueNpc.id}
            variant={dialogueNpc.id}
            color={NPC_COLORS[dialogueNpc.id]}
            fallback={dialogueNpc.portrait}
            name={dialogueNpc.name}
          />
          <div>
            <small>
              {dialogueNpc.title} · {dialogueNpc.difficulty.toUpperCase()}
            </small>
            <h2 id="journey-dialogue-name">{dialogueNpc.name}</h2>
            <p>{dialogue.line}</p>
            <nav>
              {dialogue.choices.map((choice) =>
                choice.id === 'duel' ? (
                  <Link
                    key={choice.id}
                    href={`/play?mode=campaign&npc=${dialogueNpc.id}`}
                    onClick={() => {
                      void saveCampaign(save);
                    }}
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
        </dialog>
      )}
    </main>
  );
}
