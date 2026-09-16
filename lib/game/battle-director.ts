import { MONSTER_BY_ID } from './cards';
import { effectProfile, phaseCue } from './presentation';
import type {
  BattlePresentationCue,
  GameEvent,
  GameState,
  PlayerIndex,
  PresentationSettings,
  TargetRef,
  VisualEffectProfile,
} from './types';

export interface DuelCue {
  id: string;
  kind: 'phase' | 'direction' | 'reveal' | 'calculation' | 'impact' | 'utility';
  duration: number;
  owner: PlayerIndex;
  announcement?: BattlePresentationCue;
  event?: GameEvent;
  source?: TargetRef;
  target?: TargetRef;
  sourceName: string;
  targetName: string;
  attackIds: string[];
  defenseIds: string[];
  shownIds: string[];
  profile: VisualEffectProfile;
  amount?: number;
  beforeLife?: number;
  afterLife?: number;
  response?: boolean;
}

function banner(
  state: GameState,
  phase?: BattlePresentationCue['phase'],
): DuelCue {
  const announcement = phaseCue(state, phase);
  return {
    id: announcement.id,
    kind: 'phase',
    duration: 900,
    owner: announcement.owner,
    announcement,
    sourceName: '',
    targetName: '',
    attackIds: [],
    defenseIds: [],
    shownIds: [],
    profile: effectProfile(),
  };
}

export function cueDuration(
  cue: DuelCue,
  settings: Pick<PresentationSettings, 'speed' | 'reducedMotion'>,
) {
  return settings.reducedMotion
    ? cue.kind === 'phase'
      ? 220
      : 320
    : cue.duration / settings.speed;
}

/** Only structured, public event payloads enter the presentation layer. Never read hidden piles. */
export function buildDuelCues(
  previous: GameState | null,
  state: GameState,
): DuelCue[] {
  if (!previous || previous.seed !== state.seed) return [banner(state)];
  const events = state.events.filter(
    (event) => event.id > previous.eventSequence,
  );
  const cues: DuelCue[] = [];
  const pending = state.pendingAttack ?? previous.pendingAttack;
  const name = (target?: TargetRef) =>
    target
      ? (MONSTER_BY_ID[
          state.players[target.player].monsters[target.monster]?.definitionId
        ]?.name ?? 'Monster')
      : 'Breeder';
  for (const event of events) {
    if (event.kind === 'draw') {
      cues.push(banner(state, 'draw'));
      continue;
    }
    const data = event.data;
    if (!data || !['play', 'defense', 'damage', 'guts'].includes(event.kind))
      continue;
    const response = event.kind === 'defense';
    const source =
      data.sourceMonster != null
        ? {
            player: data.actor ?? state.activePlayer,
            monster: data.sourceMonster,
          }
        : undefined;
    const target = data.target ?? data.targets?.[0];
    const profile = effectProfile(data.cardIds?.[0]);
    const attackIds = response
      ? (pending?.attackCards ?? [])
          .concat(pending?.modifierCards ?? [])
          .map((card) => card.cardId)
      : (data.cardIds ?? []);
    const defenseIds = response
      ? (pending?.defenseCards.map((card) => card.cardId) ?? data.cardIds ?? [])
      : [];
    const base: DuelCue = {
      id: `event-${event.id}`,
      kind: 'utility',
      duration: 600,
      owner: data.actor ?? state.activePlayer,
      event,
      source,
      target,
      sourceName: name(source),
      targetName: name(target),
      attackIds,
      defenseIds,
      shownIds: [],
      profile,
      amount: data.amount,
      beforeLife: data.beforeLife,
      afterLife: data.afterLife,
      response,
    };
    if (event.kind === 'play' || response) {
      if (data.role === 'attack')
        cues.push({
          ...base,
          id: `${base.id}-direction`,
          kind: 'direction',
          duration: 650,
        });
      const reveals = response ? defenseIds : attackIds;
      reveals.forEach((_, index) =>
        cues.push({
          ...base,
          id: `${base.id}-reveal-${index}`,
          kind: 'reveal',
          duration: index ? 650 : 950,
          shownIds: reveals.slice(0, index + 1),
        }),
      );
      if (response || data.role === 'special')
        cues.push({
          ...base,
          id: `${base.id}-effect`,
          kind: 'impact',
          duration: 800,
        });
    } else if (event.kind === 'damage') {
      cues.push({
        ...base,
        id: `${base.id}-calculation`,
        kind: 'calculation',
        duration: 550,
      });
      cues.push({
        ...base,
        id: `${base.id}-impact`,
        kind: 'impact',
        duration: data.afterLife === 0 ? 1350 : 1000,
        profile:
          data.amount === 0
            ? { kind: 'shield', color: '#8ad8ff', intensity: 1, shake: 0 }
            : profile,
      });
    } else
      cues.push({
        ...base,
        profile: { kind: 'guts', color: '#f3ca80', intensity: 1, shake: 0 },
      });
  }
  if (
    previous.phase !== state.phase ||
    previous.turn !== state.turn ||
    previous.activePlayer !== state.activePlayer ||
    events.some((event) => event.kind === 'draw')
  )
    cues.push(banner(state));
  return cues;
}
