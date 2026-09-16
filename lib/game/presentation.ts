import { CARD_BY_ID } from './cards';
import type {
  BattlePresentationCue,
  GameEvent,
  GameState,
  PlayerIndex,
  PresentationPhase,
  TargetIntent,
  VisualEffectProfile,
} from './types';

const PHASE_TITLES: Record<PresentationPhase, string> = {
  setup: 'SETUP GUTS',
  draw: 'DRAW PHASE',
  attack: 'ATTACK PHASE',
  defense: 'DEFENSE RESPONSE',
  guts: 'GUTS PHASE',
  result: 'BATTLE RESULT',
};

export function phaseFromState(state: GameState): PresentationPhase {
  if (state.phase === 'setup-guts') return 'setup';
  if (state.phase === 'gameover') return 'result';
  return state.phase;
}

export function phaseCue(
  state: GameState,
  override?: PresentationPhase,
): BattlePresentationCue {
  const phase = override ?? phaseFromState(state);
  const owner =
    phase === 'setup'
      ? 0
      : phase === 'defense' && state.pendingAttack
        ? (state.pendingAttack.targets[state.pendingAttack.targetCursor]
            ?.player ?? state.activePlayer)
        : state.activePlayer;
  return {
    id: `${state.turn}-${owner}-${phase}-${state.eventSequence}`,
    phase,
    owner,
    title: PHASE_TITLES[phase],
  };
}

export function effectProfile(cardId?: string): VisualEffectProfile {
  const card = cardId ? CARD_BY_ID[cardId] : undefined;
  if (!card)
    return { kind: 'impact', color: '#ff744f', intensity: 1, shake: 1 };
  return card.visual;
}

export function presentationTargets(
  state: GameState,
  actions: Array<{
    id: string;
    target: { player: PlayerIndex; monster: number } | null;
    kind: 'attack' | 'special';
  }>,
): TargetIntent[] {
  const grouped = new Map<string, TargetIntent>();
  for (const action of actions) {
    if (!action.target) continue;
    const key = `${action.target.player}-${action.target.monster}`;
    const existing = grouped.get(key);
    if (existing) existing.actionIds.push(action.id);
    else
      grouped.set(key, {
        target: action.target,
        actionIds: [action.id],
        tone: action.kind === 'attack' ? 'attack' : 'heal',
      });
  }
  return [...grouped.values()];
}

export function latestPresentationEvent(events: GameEvent[]) {
  return [...events]
    .reverse()
    .find(
      (event) =>
        event.kind === 'play' ||
        event.kind === 'defense' ||
        event.kind === 'damage' ||
        event.kind === 'draw',
    );
}
