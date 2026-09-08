'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bot, ChevronRight, CircleHelp, Flag, Hand, Save, Swords } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { CardDetail } from '@/components/card-detail';
import { Tabletop } from '@/components/tabletop';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { chooseAiCommand } from '@/lib/game/ai';
import { CARD_BY_ID, MONSTER_BY_ID } from '@/lib/game/cards';
import { DECK_BY_ID } from '@/lib/game/decks';
import { createGame, getLegalActions, getLegalDefenses, observeGame, reduceGame } from '@/lib/game/engine';
import { clearMatch, loadMatch, saveMatch, saveReplay } from '@/lib/game/persistence';
import type { Difficulty, GameCommand, GameState } from '@/lib/game/types';

const validDeck = (value: string | null): value is keyof typeof DECK_BY_ID => Boolean(value && value in DECK_BY_ID);
const validDifficulty = (value: string | null): value is Difficulty => ['easy', 'normal', 'hard'].includes(value ?? '');

export function GameClient() {
  const params = useSearchParams();
  const [state, setState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [thinking, setThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const replaySaved = useRef(false);

  useEffect(() => {
    let active = true;
    const start = async () => {
      if (params.get('resume') === '1') {
        const saved = await loadMatch();
        if (!active) return;
        if (saved.state) { setState(saved.state); return; }
        if (saved.error) setNotice(saved.error);
      }
      const deck = validDeck(params.get('deck')) ? params.get('deck') as keyof typeof DECK_BY_ID : 'miracle';
      const difficulty = validDifficulty(params.get('difficulty')) ? params.get('difficulty') as Difficulty : 'normal';
      const seedParam = Number(params.get('seed'));
      setState(createGame(deck, difficulty, undefined, Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Date.now()));
    };
    void start();
    return () => { active = false; };
  }, [params]);

  useEffect(() => {
    if (!state) return;
    const timer = window.setTimeout(() => void saveMatch(state), 120);
    if (state.phase === 'gameover' && !replaySaved.current) {
      replaySaved.current = true;
      void saveReplay(state).then(clearMatch);
    }
    return () => window.clearTimeout(timer);
  }, [state]);

  const dispatch = useCallback((command: GameCommand) => setState((current) => current ? reduceGame(current, command) : current), []);
  const actions = useMemo(() => state ? getLegalActions(state) : [], [state]);
  const defenses = useMemo(() => state ? getLegalDefenses(state) : [], [state]);

  useEffect(() => {
    if (!state || state.phase === 'gameover' || state.phase === 'setup-guts') return;
    const defenseTarget = state.pendingAttack?.targets[state.pendingAttack.targetCursor]?.player;
    const aiShouldAct = (state.phase === 'defense' && defenseTarget === 1) || (state.activePlayer === 1 && state.phase !== 'defense');
    if (!aiShouldAct) return;
    setThinking(true);
    const timer = window.setTimeout(async () => {
      const request = { observation: observeGame(state, 1), actions, defenses, difficulty: state.difficulty, entropy: state.rngState ^ state.eventSequence ^ state.turn } as const;
      let command: GameCommand;
      if (state.difficulty === 'hard' && typeof Worker !== 'undefined') {
        try {
          workerRef.current ??= new Worker(new URL('../lib/game/ai.worker.ts', import.meta.url), { type: 'module' });
          command = await new Promise<GameCommand>((resolve, reject) => {
            const worker = workerRef.current!;
            const timeout = window.setTimeout(() => reject(new Error('AI worker timeout')), 1500);
            worker.onmessage = (event) => { window.clearTimeout(timeout); resolve(event.data as GameCommand); };
            worker.onerror = reject;
            worker.postMessage(request);
          });
        } catch { command = chooseAiCommand(request); }
      } else command = chooseAiCommand(request);
      dispatch(command);
      setThinking(false);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [actions, defenses, dispatch, state]);

  useEffect(() => () => workerRef.current?.terminate(), []);
  if (!state) return <main className="loading-screen"><span className="brand-mark">MR</span><p>Restoring the arena…</p></main>;

  const player = state.players[0];
  const defenseTarget = state.pendingAttack?.targets[state.pendingAttack.targetCursor];
  const yourDefense = state.phase === 'defense' && defenseTarget?.player === 0;
  const phaseLabel = state.phase === 'setup-guts' ? 'Opening Guts' : state.phase === 'attack' ? 'Attack phase' : state.phase === 'defense' ? 'Defense response' : state.phase === 'guts' ? 'Guts phase' : 'Match complete';

  return (
    <TooltipProvider>
      <main className="game-shell">
        <AppNav compact />
        <section className="match-status">
          <div><Badge variant="outline">TURN {state.turn}</Badge><strong>{phaseLabel}</strong><span>{state.activePlayer === 0 ? 'Your initiative' : 'Rival initiative'}</span></div>
          <div className="resource-strip"><span><Hand /> Hand <strong>{player.hand.length}</strong></span><span><span className="guts-orb" /> Guts <strong>{player.guts.length}</strong></span><span><Save /> Autosaved</span></div>
        </section>
        {notice && <div className="inline-notice">{notice}</div>}
        <div className="game-layout">
          <section className="arena-panel"><Tabletop state={state} onCard={setSelectedCard} /></section>
          <aside className="hud-panel">
            <div className="hud-heading"><div><Swords /><span><small>COMMAND WINDOW</small><strong>{thinking ? 'Rival is thinking…' : phaseLabel}</strong></span></div><Tooltip><TooltipTrigger render={<Button nativeButton={false} render={<Link href="/rules" />} variant="ghost" size="icon" />}><CircleHelp /></TooltipTrigger><TooltipContent>Open the rule guide</TooltipContent></Tooltip></div>

            <div className="command-content">
              {state.phase === 'setup-guts' && <div className="setup-command"><p>Select up to two cards to become opening Guts. You may also keep all five.</p><div className="mini-hand">{player.hand.map((instance) => <button key={instance.instanceId} data-selected={state.selectedSetupCards.includes(instance.instanceId)} onClick={() => dispatch({ type: 'setup-toggle-guts', instanceId: instance.instanceId })}><img src={CARD_BY_ID[instance.cardId].image} alt={CARD_BY_ID[instance.cardId].name} /><span>{CARD_BY_ID[instance.cardId].name}</span></button>)}</div><Button onClick={() => dispatch({ type: 'finish-setup' })}>Confirm {state.selectedSetupCards.length} Guts <ChevronRight /></Button></div>}

              {state.phase === 'attack' && state.activePlayer === 0 && <><p className="command-help">Choose a legal move. Targets and Guts costs are already checked.</p><ScrollArea className="action-scroll"><div className="action-list">{actions.map((action) => <button key={action.id} onClick={() => dispatch({ type: 'play-action', actionId: action.id })}><span><strong>{action.label}</strong><small>{action.target ? `Target: ${MONSTER_BY_ID[state.players[action.target.player].monsters[action.target.monster].definitionId].name}` : 'Special move'}</small></span><em>{action.detail}</em></button>)}{!actions.length && <p className="empty-actions">No legal attacks remain.</p>}</div></ScrollArea><Button variant="secondary" onClick={() => dispatch({ type: 'finish-attacking' })}>Finish attacks <ChevronRight /></Button></>}

              {yourDefense && <><p className="command-help">Respond in order, play another defense, or accept the remaining {state.pendingAttack?.workingDamage ?? 0} damage.</p><div className="action-list">{defenses.map((defense) => <button key={`${defense.instanceId}-${defense.monster}`} onClick={() => dispatch({ type: 'play-defense', instanceId: defense.instanceId, monster: defense.monster })}><span><strong>{defense.label}</strong><small>With {MONSTER_BY_ID[player.monsters[defense.monster].definitionId].name}</small></span><em>{defense.detail}</em></button>)}</div><Button variant="destructive" onClick={() => dispatch({ type: 'pass-defense' })}>Take the hit</Button></>}

              {state.phase === 'guts' && state.activePlayer === 0 && <><p className="command-help">Place any remaining hand cards on your Guts stack. The last card placed is spent first.</p><div className="guts-actions">{player.hand.map((instance) => <button key={instance.instanceId} onClick={() => dispatch({ type: 'convert-guts', instanceId: instance.instanceId })}><img src={CARD_BY_ID[instance.cardId].image} alt="" /><span>{CARD_BY_ID[instance.cardId].name}</span></button>)}</div><Button onClick={() => dispatch({ type: 'finish-turn' })}>End turn <ChevronRight /></Button></>}

              {thinking && <div className="thinking-panel"><Bot /><span>Rival policy: {state.difficulty}<small>Only public counts and its own cards are visible to the AI.</small></span></div>}
              {state.phase === 'gameover' && <div className="gameover-panel"><Flag /><p>{state.winner === 0 ? 'Victory!' : 'Defeat'}</p><span>{state.events.at(-1)?.message}</span><Button nativeButton={false} render={<Link href={`/?last=${state.winner}`} />}>Return to terminal</Button></div>}
            </div>

            <div className="combat-log"><div><strong>Combat log</strong><small>authoritative events</small></div><ScrollArea className="log-scroll">{[...state.events].reverse().map((event) => <p key={event.id}><span>{String(event.id).padStart(2, '0')}</span>{event.message}</p>)}</ScrollArea></div>
          </aside>
        </div>
      </main>
      <CardDetail id={selectedCard} open={Boolean(selectedCard)} onOpenChange={(open) => { if (!open) setSelectedCard(null); }} />
    </TooltipProvider>
  );
}
