'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  ChevronRight,
  Flag,
  Gauge,
  Hand,
  List,
  Pause,
  RotateCcw,
  Settings,
  Shield,
  Swords,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardDetail } from '@/components/card-detail';
import { Tabletop } from '@/components/tabletop';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chooseAiCommand } from '@/lib/game/ai';
import { NPCS, OUTFIT_PALETTES, rivalForDeck } from '@/lib/game/campaign';
import { CARD_BY_ID, MONSTER_BY_ID } from '@/lib/game/cards';
import { DECK_BY_ID } from '@/lib/game/decks';
import {
  createGame,
  getLegalActions,
  getLegalDefenses,
  observeGame,
  reduceGame,
} from '@/lib/game/engine';
import { filterActionSelection } from '@/lib/game/interaction';
import {
  clearMatch,
  loadCampaign,
  loadMatch,
  saveCampaign,
  saveMatch,
  saveReplay,
} from '@/lib/game/persistence';
import {
  phaseCue,
  phaseFromState,
  presentationTargets,
} from '@/lib/game/presentation';
import type {
  Difficulty,
  GameCommand,
  GameState,
  OutfitPalette,
  PlayerIndex,
  PresentationPhase,
  PresentationSettings,
} from '@/lib/game/types';

const validDeck = (value: string | null): value is string =>
  Boolean(value && value in DECK_BY_ID);
const validDifficulty = (value: string | null): value is Difficulty =>
  ['easy', 'normal', 'hard'].includes(value ?? '');
const DEFAULT_SETTINGS: PresentationSettings = {
  speed: 1,
  reducedMotion: false,
  cameraMotion: true,
  particleDensity: 'high',
  effectsMuted: false,
};

function PreviewPanel({ id }: { id: string | null }) {
  const card = id ? CARD_BY_ID[id] : undefined;
  const monster = id ? MONSTER_BY_ID[id] : undefined;
  if (!id || (!card && !monster))
    return (
      <aside className="card-inspector is-empty">
        <div className="inspector-glyph">MR</div>
        <strong>Inspect the field</strong>
        <p>
          Hover a card to read it. Right-click or long-press to pin full
          details.
        </p>
      </aside>
    );
  const image = card?.image ?? monster?.image;
  return (
    <aside className="card-inspector">
      <div className="inspector-heading">
        <span>
          {card
            ? `${card.type} SKILL`
            : `${monster?.attribute.toUpperCase()} MONSTER`}
        </span>
        <strong>{card?.name ?? monster?.name}</strong>
      </div>
      <img src={image} alt={`${card?.name ?? monster?.name} card`} />
      <div className="inspector-stats">
        {card ? (
          <>
            <span>
              GUTS <b>{card.guts}</b>
            </span>
            <span>
              DAMAGE <b>{card.damage ?? '—'}</b>
            </span>
          </>
        ) : (
          <>
            <span>
              LIFE <b>{monster?.life}</b>
            </span>
            <span>
              BREED <b>{monster?.mainBreed}</b>
            </span>
          </>
        )}
      </div>
      <p>
        {card?.text ||
          (monster ? `${monster.mainBreed} / ${monster.subBreed}` : '')}
      </p>
    </aside>
  );
}

function AvatarHud({
  side,
  name,
  title,
  portrait,
  accent,
  state,
  thinking,
}: {
  side: 'player' | 'rival';
  name: string;
  title: string;
  portrait: string;
  accent: string;
  state: GameState;
  thinking?: boolean;
}) {
  const player = state.players[side === 'player' ? 0 : 1];
  return (
    <section
      className={`avatar-hud avatar-${side}`}
      style={{ '--hud-accent': accent } as React.CSSProperties}
    >
      <div className="avatar-copy">
        <small>{title}</small>
        <strong>{name}</strong>
        <div>
          <span>
            <Hand /> {player.hand.length}
          </span>
          <span className="hud-guts">● {player.guts.length}</span>
          <span>{player.drawPile.length} deck</span>
        </div>
        {thinking && <em>Choosing a move…</em>}
      </div>
      <div className="avatar-frame">
        <img src={portrait} alt={`${name} portrait`} />
      </div>
    </section>
  );
}

export function GameClient() {
  const params = useSearchParams();
  const [state, setState] = useState<GameState | null>(null);
  const [previewCard, setPreviewCard] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [thinking, setThinking] = useState(false);
  const [inputLocked, setInputLocked] = useState(true);
  const [announcement, setAnnouncement] = useState<ReturnType<
    typeof phaseCue
  > | null>(null);
  const [discardOwner, setDiscardOwner] = useState<PlayerIndex | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [settings, setSettings] =
    useState<PresentationSettings>(DEFAULT_SETTINGS);
  const [outfit, setOutfit] = useState<OutfitPalette>('azure');
  const workerRef = useRef<Worker | null>(null);
  const replaySaved = useRef(false);
  const cueTimer = useRef<number | null>(null);
  const cueFollowup = useRef<number | null>(null);
  const seenEvent = useRef(0);
  const phaseKey = useRef('');

  useEffect(() => {
    const saved = window.localStorage.getItem('mrbc-presentation');
    if (saved)
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch {
        /* keep defaults */
      }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      setSettings((current) => ({ ...current, reducedMotion: true }));
  }, []);
  useEffect(() => {
    window.localStorage.setItem('mrbc-presentation', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    let active = true;
    const start = async () => {
      const campaign = await loadCampaign();
      if (!active) return;
      if (campaign) setOutfit(campaign.outfit);
      if (params.get('resume') === '1') {
        const saved = await loadMatch();
        if (!active) return;
        if (saved.state) {
          setState(saved.state);
          return;
        }
        if (saved.error) setNotice(saved.error);
      }
      const npcId = params.get('npc');
      const npc = npcId ? NPCS[npcId] : undefined;
      const campaignMode = params.get('mode') === 'campaign' && campaign && npc;
      const deck = campaignMode
        ? campaign.starterDeckId
        : validDeck(params.get('deck'))
          ? params.get('deck')!
          : 'miracle';
      const difficulty = campaignMode
        ? npc.difficulty
        : validDifficulty(params.get('difficulty'))
          ? (params.get('difficulty') as Difficulty)
          : 'normal';
      const seedParam = Number(params.get('seed'));
      setState(
        createGame({
          playerDeckId: deck,
          opponentDeckId: campaignMode ? npc.deckId : undefined,
          difficulty,
          seed:
            Number.isFinite(seedParam) && seedParam > 0
              ? seedParam
              : Date.now(),
          duelContext: campaignMode
            ? {
                mode: 'campaign',
                npcId: npc.id,
                areaId: npc.areaId,
                returnPath: '/world',
              }
            : { mode: 'quick' },
        }),
      );
    };
    void start();
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!state) return;
    const timer = window.setTimeout(() => void saveMatch(state), 120);
    if (state.phase === 'gameover' && !replaySaved.current) {
      replaySaved.current = true;
      void saveReplay(state).then(async () => {
        if (state.duelContext?.mode === 'campaign' && state.duelContext.npcId) {
          const campaign = await loadCampaign();
          if (campaign && state.winner === 0) {
            const defeatedNpcIds = [
              ...new Set([...campaign.defeatedNpcIds, state.duelContext.npcId]),
            ];
            await saveCampaign({
              ...campaign,
              defeatedNpcIds,
              campaignComplete: defeatedNpcIds.includes('veyra'),
            });
          }
        }
        await clearMatch();
      });
    }
    return () => window.clearTimeout(timer);
  }, [state]);

  const dispatch = useCallback(
    (command: GameCommand) =>
      setState((current) => (current ? reduceGame(current, command) : current)),
    [],
  );
  const actions = useMemo(() => (state ? getLegalActions(state) : []), [state]);
  const defenses = useMemo(
    () => (state ? getLegalDefenses(state) : []),
    [state],
  );

  const selection = useMemo(
    () => filterActionSelection(actions, selectedChain),
    [actions, selectedChain],
  );
  const exactActions = selection.exact;
  const legalTargets = useMemo(() => {
    if (!state) return [];
    if (state.phase === 'defense' && selectedChain.length === 1)
      return defenses
        .filter((item) => item.instanceId === selectedChain[0])
        .map((item) => ({
          target: { player: 0 as const, monster: item.monster },
          actionIds: [`${item.instanceId}:${item.monster}`],
          tone: 'defense' as const,
        }));
    return presentationTargets(state, exactActions);
  }, [defenses, exactActions, selectedChain, state]);
  const legalHandIds = useMemo(() => {
    if (
      !state ||
      inputLocked ||
      (state.activePlayer !== 0 && state.phase !== 'defense')
    )
      return [];
    if (state.phase === 'setup-guts' || state.phase === 'guts')
      return state.players[0].hand.map((item) => item.instanceId);
    if (state.phase === 'defense')
      return [...new Set(defenses.map((item) => item.instanceId))];
    if (state.phase === 'attack')
      return [...new Set(actions.flatMap((action) => action.cardInstanceIds))];
    return [];
  }, [actions, defenses, inputLocked, state]);
  const chainOptions = selection.chainOptions;

  const runCue = useCallback(
    (phase: PresentationPhase, owner: PlayerIndex, duration: number) => {
      if (!state) return;
      if (cueTimer.current) window.clearTimeout(cueTimer.current);
      setAnnouncement({ ...phaseCue(state, phase), owner });
      setInputLocked(true);
      cueTimer.current = window.setTimeout(
        () => {
          setAnnouncement(null);
          setInputLocked(false);
        },
        settings.reducedMotion ? 180 : duration / settings.speed,
      );
    },
    [settings.reducedMotion, settings.speed, state],
  );

  useEffect(() => {
    if (!state) return;
    const latest = state.events.at(-1);
    const nextPhaseKey = `${state.turn}-${state.activePlayer}-${state.phase}`;
    if (latest && latest.id !== seenEvent.current) {
      seenEvent.current = latest.id;
      if (latest.kind === 'draw') {
        if (cueFollowup.current) window.clearTimeout(cueFollowup.current);
        runCue('draw', latest.data?.actor ?? state.activePlayer, 900);
        cueFollowup.current = window.setTimeout(
          () => runCue('attack', state.activePlayer, 900),
          settings.reducedMotion ? 220 : 930 / settings.speed,
        );
        phaseKey.current = nextPhaseKey;
        return;
      }
      if (latest.kind === 'play') {
        setInputLocked(true);
        const revealCount = Math.max(1, latest.data?.cardIds?.length ?? 1);
        cueTimer.current = window.setTimeout(
          () => setInputLocked(false),
          settings.reducedMotion
            ? 450
            : (1750 + Math.max(0, revealCount - 1) * 600) / settings.speed,
        );
        return;
      }
      if (latest.kind === 'defense') {
        setInputLocked(true);
        const revealCount = Math.max(
          1,
          state.pendingAttack?.defenseCards.length ?? 1,
        );
        cueTimer.current = window.setTimeout(
          () => setInputLocked(false),
          settings.reducedMotion
            ? 350
            : (1150 + Math.max(0, revealCount - 1) * 600) / settings.speed,
        );
        return;
      }
      if (latest.kind === 'damage') {
        setInputLocked(true);
        cueTimer.current = window.setTimeout(
          () => setInputLocked(false),
          (settings.reducedMotion ? 300 : 1080) / settings.speed,
        );
        return;
      }
    }
    if (phaseKey.current !== nextPhaseKey) {
      phaseKey.current = nextPhaseKey;
      runCue(phaseFromState(state), state.activePlayer, 900);
    }
  }, [runCue, settings.reducedMotion, settings.speed, state]);

  const skipPresentation = useCallback(() => {
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
    if (cueFollowup.current) window.clearTimeout(cueFollowup.current);
    setAnnouncement(null);
    setInputLocked(false);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pauseOpen) setPauseOpen(false);
        else if (selectedChain.length) setSelectedChain([]);
        else setPauseOpen(true);
      }
      if (event.code === 'Space' && inputLocked) {
        event.preventDefault();
        skipPresentation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputLocked, pauseOpen, selectedChain.length, skipPresentation]);

  useEffect(() => {
    if (
      !state ||
      state.phase === 'gameover' ||
      state.phase === 'setup-guts' ||
      inputLocked
    )
      return;
    const defenseTarget =
      state.pendingAttack?.targets[state.pendingAttack.targetCursor]?.player;
    const aiShouldAct =
      (state.phase === 'defense' && defenseTarget === 1) ||
      (state.activePlayer === 1 && state.phase !== 'defense');
    if (!aiShouldAct) return;
    setThinking(true);
    const timer = window.setTimeout(async () => {
      const request = {
        observation: observeGame(state, 1),
        actions,
        defenses,
        difficulty: state.difficulty,
        entropy: state.rngState ^ state.eventSequence ^ state.turn,
      } as const;
      let command: GameCommand;
      if (state.difficulty === 'hard' && typeof Worker !== 'undefined') {
        try {
          workerRef.current ??= new Worker(
            new URL('../lib/game/ai.worker.ts', import.meta.url),
            { type: 'module' },
          );
          command = await new Promise<GameCommand>((resolve, reject) => {
            const worker = workerRef.current!;
            const timeout = window.setTimeout(
              () => reject(new Error('AI worker timeout')),
              1500,
            );
            worker.onmessage = (event) => {
              window.clearTimeout(timeout);
              resolve(event.data as GameCommand);
            };
            worker.onerror = reject;
            worker.postMessage(request);
          });
        } catch {
          command = chooseAiCommand(request);
        }
      } else command = chooseAiCommand(request);
      dispatch(command);
      setThinking(false);
    }, 440);
    return () => window.clearTimeout(timer);
  }, [actions, defenses, dispatch, inputLocked, state]);

  useEffect(() => {
    setSelectedChain([]);
  }, [state?.eventSequence, state?.phase]);
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      if (cueTimer.current) window.clearTimeout(cueTimer.current);
      if (cueFollowup.current) window.clearTimeout(cueFollowup.current);
    },
    [],
  );

  if (!state)
    return (
      <main className="loading-screen">
        <span className="brand-mark">MR</span>
        <p>Restoring the arena…</p>
      </main>
    );

  const player = state.players[0];
  const yourDefense =
    state.phase === 'defense' &&
    state.pendingAttack?.targets[state.pendingAttack.targetCursor]?.player ===
      0;
  const yourTurn = state.activePlayer === 0;
  const rivalNpc = state.duelContext?.npcId
    ? NPCS[state.duelContext.npcId]
    : rivalForDeck(state.players[1].deckId);
  const deck = DECK_BY_ID[player.deckId];
  const rivalDeck = DECK_BY_ID[state.players[1].deckId];
  const playerPortrait = OUTFIT_PALETTES[outfit].portrait;
  const phase = phaseFromState(state);
  const prompt =
    state.phase === 'setup-guts'
      ? `Choose up to two opening Guts (${state.selectedSetupCards.length}/2)`
      : yourDefense
        ? selectedChain.length
          ? 'Choose the monster using this defense'
          : 'Choose a glowing defense card'
        : state.phase === 'attack' && yourTurn
          ? selectedChain.length
            ? 'Add a glowing chain card or choose a target'
            : 'Choose a glowing skill card'
          : state.phase === 'guts' && yourTurn
            ? 'Bank cards as Guts, then end the turn'
            : thinking
              ? `${rivalNpc.name} is choosing…`
              : 'Watch the rival action';
  const instantAction = exactActions.find((action) => !action.target);

  const chooseHandCard = (instanceId: string) => {
    const instance = player.hand.find((item) => item.instanceId === instanceId);
    if (instance) setPreviewCard(instance.cardId);
    if (state.phase === 'setup-guts') {
      dispatch({ type: 'setup-toggle-guts', instanceId });
      return;
    }
    if (state.phase === 'guts' && yourTurn) {
      dispatch({ type: 'convert-guts', instanceId });
      return;
    }
    if (state.phase === 'defense' && yourDefense) {
      setSelectedChain((current) =>
        current[0] === instanceId ? [] : [instanceId],
      );
      return;
    }
    if (state.phase !== 'attack' || !yourTurn) return;
    if (!selectedChain.length) {
      if (actions.some((action) => action.cardInstanceIds.includes(instanceId)))
        setSelectedChain([instanceId]);
      return;
    }
    if (selectedChain[0] === instanceId) {
      setSelectedChain([]);
      return;
    }
    if (selectedChain.includes(instanceId))
      setSelectedChain((current) => current.filter((id) => id !== instanceId));
    else if (chainOptions.includes(instanceId))
      setSelectedChain((current) => [...current, instanceId]);
  };
  const chooseMonster = (targetPlayer: PlayerIndex, monster: number) => {
    if (inputLocked) return;
    if (yourDefense && selectedChain.length === 1) {
      const defense = defenses.find(
        (item) =>
          item.instanceId === selectedChain[0] &&
          item.monster === monster &&
          targetPlayer === 0,
      );
      if (defense)
        dispatch({
          type: 'play-defense',
          instanceId: defense.instanceId,
          monster,
        });
      return;
    }
    const action = exactActions.find(
      (item) =>
        item.target?.player === targetPlayer && item.target.monster === monster,
    );
    if (action) dispatch({ type: 'play-action', actionId: action.id });
  };

  return (
    <main className="duel-shell" data-owner={state.activePlayer}>
      <section className="duel-stage">
        <Tabletop
          state={state}
          legalHandIds={legalHandIds}
          chainOptionIds={chainOptions}
          selectedInstanceIds={
            state.phase === 'setup-guts'
              ? state.selectedSetupCards
              : selectedChain
          }
          legalTargets={legalTargets}
          inputLocked={inputLocked || pauseOpen}
          reducedMotion={settings.reducedMotion}
          presentationSpeed={settings.speed}
          onPreview={setPreviewCard}
          onInspect={setDetailCard}
          onHandCard={chooseHandCard}
          onMonster={chooseMonster}
          onDiscard={setDiscardOwner}
          onCancel={() => setSelectedChain([])}
        />
        <PreviewPanel id={previewCard} />
        <AvatarHud
          side="rival"
          name={rivalNpc.name}
          title={`${rivalNpc.title} · ${rivalDeck.name}`}
          portrait={rivalNpc.portrait}
          accent="#ff625c"
          state={state}
          thinking={thinking}
        />
        <AvatarHud
          side="player"
          name="Breeder"
          title={deck.name}
          portrait={playerPortrait}
          accent={OUTFIT_PALETTES[outfit].color}
          state={state}
        />

        <section className="phase-orb" data-owner={state.activePlayer}>
          <small>TURN {state.turn}</small>
          <strong>{phase}</strong>
          <span>{yourTurn ? 'YOUR PHASE' : 'RIVAL PHASE'}</span>
          <div className="phase-actions">
            {state.phase === 'setup-guts' && !inputLocked && (
              <button onClick={() => dispatch({ type: 'finish-setup' })}>
                Confirm {state.selectedSetupCards.length} <ChevronRight />
              </button>
            )}
            {state.phase === 'attack' && yourTurn && !inputLocked && (
              <button onClick={() => dispatch({ type: 'finish-attacking' })}>
                End attacks <ChevronRight />
              </button>
            )}
            {yourDefense && !inputLocked && (
              <button
                className="danger"
                onClick={() => dispatch({ type: 'pass-defense' })}
              >
                Take hit <Shield />
              </button>
            )}
            {state.phase === 'guts' && yourTurn && !inputLocked && (
              <button onClick={() => dispatch({ type: 'finish-turn' })}>
                End turn <ChevronRight />
              </button>
            )}
            {instantAction && !inputLocked && (
              <button
                className="confirm-action"
                onClick={() =>
                  dispatch({ type: 'play-action', actionId: instantAction.id })
                }
              >
                Play {instantAction.label} <Swords />
              </button>
            )}
          </div>
        </section>

        <div className="battle-prompt" data-owner={state.activePlayer}>
          {selectedChain.length > 0 && (
            <div className="selected-chain">
              {selectedChain.map((id, index) => {
                const instance = player.hand.find(
                  (item) => item.instanceId === id,
                );
                const card = instance && CARD_BY_ID[instance.cardId];
                return card ? (
                  <span key={id}>
                    <b>{index + 1}</b>
                    {card.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
          <p>{prompt}</p>
        </div>
        <button
          className="duel-menu-button"
          onClick={() => setPauseOpen(true)}
          aria-label="Pause battle"
        >
          <Pause />
        </button>
        <button
          className="duel-log-button"
          onClick={() => setLogOpen((open) => !open)}
          aria-label="Toggle combat log"
        >
          <List />
        </button>
        {notice && <div className="inline-notice">{notice}</div>}

        {announcement && (
          <button
            className="phase-announcement"
            data-owner={announcement.owner}
            aria-live="assertive"
            aria-label={`${announcement.owner === 0 ? 'Your' : 'Rival'} ${announcement.title}`}
            onClick={skipPresentation}
          >
            <small>
              {announcement.owner === 0 ? 'YOUR TURN' : 'RIVAL TURN'}
            </small>
            <strong>{announcement.title}</strong>
            <span>Click or press Space to advance</span>
          </button>
        )}
        {state.phase === 'gameover' && (
          <section className="battle-result">
            <Flag />
            <small>JOURNEY RECORD UPDATED</small>
            <h1>{state.winner === 0 ? 'VICTORY' : 'DEFEAT'}</h1>
            <p>{state.events.at(-1)?.message}</p>
            <div>
              {state.duelContext?.mode === 'campaign' ? (
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={`/world?result=${state.winner === 0 ? 'win' : 'loss'}&npc=${state.duelContext.npcId}`}
                    />
                  }
                >
                  Return to the world
                </Button>
              ) : (
                <Button nativeButton={false} render={<Link href="/" />}>
                  Return to title
                </Button>
              )}
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={`/play?deck=${player.deckId}&difficulty=${state.difficulty}`}
                  />
                }
              >
                <RotateCcw /> Rematch
              </Button>
            </div>
          </section>
        )}

        {logOpen && (
          <aside className="floating-log">
            <header>
              <div>
                <strong>Combat log</strong>
                <small>Authoritative events</small>
              </div>
              <button onClick={() => setLogOpen(false)}>
                <X />
              </button>
            </header>
            <ScrollArea className="floating-log-scroll">
              {[...state.events].reverse().map((event) => (
                <p key={event.id}>
                  <span>{String(event.id).padStart(2, '0')}</span>
                  {event.message}
                </p>
              ))}
            </ScrollArea>
          </aside>
        )}

        <div className="sr-card-controls" aria-label="Keyboard card controls">
          {player.hand.map((instance) => (
            <button
              key={instance.instanceId}
              disabled={
                !legalHandIds.includes(instance.instanceId) &&
                !chainOptions.includes(instance.instanceId)
              }
              onFocus={() => setPreviewCard(instance.cardId)}
              onClick={() => chooseHandCard(instance.instanceId)}
            >
              {CARD_BY_ID[instance.cardId].name}
            </button>
          ))}
        </div>
      </section>

      {discardOwner !== null && (
        <div
          className="game-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${discardOwner === 0 ? 'Your' : 'Rival'} discard pile`}
        >
          <section className="discard-view">
            <header>
              <div>
                <small>PUBLIC ZONE</small>
                <h2>
                  {discardOwner === 0 ? 'Your' : `${rivalNpc.name}’s`} discard
                </h2>
              </div>
              <button onClick={() => setDiscardOwner(null)}>
                <X />
              </button>
            </header>
            <div className="discard-grid">
              {[...state.players[discardOwner].discard]
                .reverse()
                .map((instance, index) => (
                  <button
                    key={`${instance.instanceId}-${index}`}
                    onClick={() => setDetailCard(instance.cardId)}
                  >
                    <img
                      src={CARD_BY_ID[instance.cardId].image.replace(
                        '/detail/',
                        '/scene/',
                      )}
                      alt={CARD_BY_ID[instance.cardId].name}
                    />
                    <span>{CARD_BY_ID[instance.cardId].name}</span>
                  </button>
                ))}
              {!state.players[discardOwner].discard.length && (
                <p>No cards have been discarded.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {pauseOpen && (
        <div
          className="game-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Pause menu"
        >
          <section className="pause-panel">
            <header>
              <div>
                <small>BATTLE PAUSED</small>
                <h2>Field options</h2>
              </div>
              <button onClick={() => setPauseOpen(false)}>
                <X />
              </button>
            </header>
            <label>
              <span>
                <Gauge /> Animation speed
              </span>
              <div className="speed-options">
                {([1, 1.5, 2] as const).map((speed) => (
                  <button
                    key={speed}
                    data-active={settings.speed === speed}
                    onClick={() =>
                      setSettings((current) => ({ ...current, speed }))
                    }
                  >
                    {speed}×
                  </button>
                ))}
              </div>
            </label>
            <label className="switch-row">
              <span>
                <Settings /> Reduced motion
              </span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    reducedMotion: event.target.checked,
                  }))
                }
              />
            </label>
            <nav>
              <Button onClick={() => setPauseOpen(false)}>Resume battle</Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/rules" />}
              >
                <BookOpen /> Field manual
              </Button>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Return to title
              </Button>
            </nav>
          </section>
        </div>
      )}
      <CardDetail
        id={detailCard}
        open={Boolean(detailCard)}
        onOpenChange={(open) => {
          if (!open) setDetailCard(null);
        }}
      />
    </main>
  );
}
