import { describe, expect, it } from 'vitest';
import manifest from '../../public/card-manifest.json';
import { chooseAiCommand } from './ai';
import { MONSTERS, STARTER_CARDS } from './cards';
import {
  createCampaign,
  festivalUnlocked,
  NPCS,
  npcUnlocked,
} from './campaign';
import { NPC_DECKS, STARTER_DECKS, validateDeck } from './decks';
import {
  createGame,
  getLegalActions,
  getLegalDefenses,
  observeGame,
  reduceGame,
} from './engine';
import { buildCardActionIntents, filterActionSelection } from './interaction';
import { effectProfile } from './presentation';
import type { CardInstance, GameState, PlayerIndex } from './types';

const instance = (cardId: string, tag = 'test'): CardInstance => ({
  cardId,
  instanceId: `${tag}-${cardId}`,
});

function autoStep(state: GameState) {
  if (state.phase === 'setup-guts')
    return reduceGame(state, { type: 'finish-setup' });
  const target =
    state.pendingAttack?.targets[state.pendingAttack.targetCursor]?.player;
  const perspective = (
    state.phase === 'defense' ? target : state.activePlayer
  ) as PlayerIndex;
  const request = {
    observation: observeGame(state, perspective),
    actions: getLegalActions(state),
    defenses: getLegalDefenses(state),
    difficulty: state.difficulty,
    entropy: state.seed ^ state.turn ^ state.eventSequence,
  } as const;
  return reduceGame(state, chooseAiCommand(request));
}

function autoMatch(
  player: 'miracle' | 'speed' | 'powerful',
  rival: 'miracle' | 'speed' | 'powerful',
  seed: number,
) {
  let state = createGame(player, 'hard', rival, seed);
  let steps = 0;
  while (state.phase !== 'gameover' && steps < 1500) {
    state = autoStep(state);
    steps += 1;
  }
  return { state, steps };
}

describe('verified content', () => {
  it('keeps the complete source archive and correction mappings', () => {
    expect(manifest.sourceCount).toBe(459);
    expect(manifest.skillCount).toBe(366);
    expect(manifest.logicalMonsterCount).toBe(65);
    expect(manifest.correctedCard).toBe('318.png');
    expect(manifest.galleryOnly).toEqual(['318-misprint.png']);
    expect(manifest.grayWolfDefault).toBe('C-044V.png');
  });

  it('authors every starter card as a structured implemented definition', () => {
    expect(STARTER_CARDS).toHaveLength(66);
    expect(new Set(STARTER_CARDS.map((card) => card.id)).size).toBe(66);
    expect(
      STARTER_CARDS.every(
        (card) => card.implemented && card.image.endsWith(`${card.id}.webp`),
      ),
    ).toBe(true);
    expect(MONSTERS).toHaveLength(9);
    const kinds = new Set(
      STARTER_CARDS.flatMap((card) =>
        card.effects.map((effect) => effect.kind),
      ),
    );
    expect(kinds).toEqual(
      new Set([
        'combo',
        'undodgeable',
        'aoe',
        'self-damage',
        'guts-loss',
        'half-on-dodge',
        'lifesteal',
        'dodge',
        'block',
        'reflect',
        'redirect',
        'jump',
        'draw',
        'discard-opponent',
        'heal',
        'double-if-low-life',
        'lock-dodge',
        'prevent-ko',
        'repeatable',
      ]),
    );
  });

  it.each(STARTER_DECKS)('$name is an exact legal starter fixture', (deck) => {
    expect(deck.skillIds).toHaveLength(50);
    expect(deck.monsterIds).toHaveLength(3);
    expect(validateDeck(deck)).toEqual([]);
    expect(
      Math.max(
        ...Object.values(
          deck.skillIds.reduce<Record<string, number>>(
            (counts, id) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }),
            {},
          ),
        ),
      ),
    ).toBeLessThanOrEqual(3);
  });

  it.each(NPC_DECKS)('$name is a distinct legal NPC fixture', (deck) => {
    expect(deck.skillIds).toHaveLength(50);
    expect(validateDeck(deck)).toEqual([]);
    expect(
      STARTER_DECKS.some(
        (starter) => starter.skillIds.join(',') === deck.skillIds.join(','),
      ),
    ).toBe(false);
  });

  it('assigns a visual effect profile to every starter card', () => {
    for (const card of STARTER_CARDS)
      expect(effectProfile(card.id).kind).toBeTruthy();
  });
});

describe('deterministic engine', () => {
  it('reproduces setup exactly for a seed and hides private zones', () => {
    const first = createGame('miracle', 'normal', 'speed', 42);
    const second = createGame('miracle', 'normal', 'speed', 42);
    expect(first).toEqual(second);
    const view = observeGame(first, 1);
    expect('hand' in view.opponent).toBe(false);
    expect('drawPile' in view.opponent).toBe(false);
    expect('guts' in view.opponent).toBe(false);
    expect(view.opponent.handCount).toBe(5);
  });

  it('offers the second player up to two opening Guts', () => {
    let state = createGame('miracle', 'normal', 'speed', 41);
    expect(state.startingPlayer).toBe(1);
    expect(state.phase).toBe('setup-guts');
    state = reduceGame(state, {
      type: 'setup-toggle-guts',
      instanceId: state.players[0].hand[0].instanceId,
    });
    state = reduceGame(state, {
      type: 'setup-toggle-guts',
      instanceId: state.players[0].hand[1].instanceId,
    });
    state = reduceGame(state, { type: 'finish-setup' });
    expect(state.players[0].guts).toHaveLength(2);
    expect(state.players[0].hand).toHaveLength(3);
    expect(state.activePlayer).toBe(1);
  });

  it('sends the top deck card to Guts when a turn begins with five cards', () => {
    let state = createGame('miracle', 'normal', 'speed', 42);
    state = reduceGame(state, { type: 'finish-attacking' });
    state = reduceGame(state, { type: 'finish-turn' });
    state = reduceGame(state, { type: 'finish-attacking' });
    while (state.players[1].hand.length)
      state = reduceGame(state, {
        type: 'convert-guts',
        instanceId: state.players[1].hand[0].instanceId,
      });
    const before = state.players[0].drawPile.length;
    state = reduceGame(state, { type: 'finish-turn' });
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[0].guts).toHaveLength(1);
    expect(state.players[0].drawPile).toHaveLength(before - 1);
  });

  it('resolves an attack and prevents the same monster attacking twice', () => {
    let state = createGame('miracle', 'normal', 'speed', 42);
    state.players[0].hand = [instance('005')];
    state.players[0].guts = [
      instance('112', 'g1'),
      instance('113', 'g2'),
      instance('001', 'g3'),
    ];
    const action = getLegalActions(state).find(
      (item) => item.label === 'Stab',
    )!;
    expect(action).toBeTruthy();
    const life = state.players[1].monsters[0].life;
    state = reduceGame(state, { type: 'play-action', actionId: action.id });
    state = reduceGame(state, { type: 'pass-defense' });
    expect(state.players[1].monsters[0].life).toBe(life - 4);
    expect(state.players[0].monsters[0].attacked).toBe(true);
    expect(
      getLegalActions(state).some((item) => item.attackerMonster === 0),
    ).toBe(false);
  });

  it('keeps Dodge illegal against an undodgeable attack while allowing compatible Blocks', () => {
    let state = createGame('miracle', 'normal', 'speed', 42);
    state.players[0].hand = [instance('017')];
    state.players[0].guts = [
      instance('001', 'g1'),
      instance('002', 'g2'),
      instance('003', 'g3'),
    ];
    state.players[1].hand = [
      instance('108', 'dodge'),
      instance('106', 'block'),
    ];
    state.players[1].guts = [];
    const action = getLegalActions(state).find(
      (item) => item.label === 'Holy Ray' && item.target?.monster === 2,
    )!;
    state = reduceGame(state, { type: 'play-action', actionId: action.id });
    const legal = getLegalDefenses(state);
    expect(legal.some((item) => item.instanceId === 'dodge-108')).toBe(false);
    expect(legal.some((item) => item.instanceId === 'block-106')).toBe(true);
  });

  it('records ordered defense cards for chained battle cut-ins and replays', () => {
    let state = createGame('miracle', 'normal', 'speed', 42);
    state.players[0].hand = [instance('005')];
    state.players[0].guts = [
      instance('001', 'g1'),
      instance('002', 'g2'),
      instance('003', 'g3'),
    ];
    state.players[1].hand = [instance('071', 'endure')];
    state.players[1].guts = [instance('097', 'enemy-guts')];
    const action = getLegalActions(state).find(
      (item) => item.label === 'Stab' && item.target?.monster === 0,
    )!;
    state = reduceGame(state, { type: 'play-action', actionId: action.id });
    state = reduceGame(state, {
      type: 'play-defense',
      instanceId: 'endure-071',
      monster: 0,
    });
    expect(state.pendingAttack?.attackCards.map((card) => card.cardId)).toEqual(
      ['005'],
    );
    expect(
      state.pendingAttack?.defenseCards.map((card) => card.cardId),
    ).toEqual(['071']);
    expect(state.pendingAttack?.workingDamage).toBe(2);
  });

  it('exposes every legal action through direct card intents and exact selection', () => {
    const state = createGame('miracle', 'normal', 'speed', 42);
    const actions = getLegalActions(state);
    const intents = buildCardActionIntents(actions);
    const reachable = new Set(
      intents.flatMap((intent) => intent.candidateActionIds),
    );
    expect(reachable).toEqual(new Set(actions.map((action) => action.id)));
    for (const action of actions)
      expect(
        filterActionSelection(actions, [
          ...action.cardInstanceIds,
          ...action.modifierInstanceIds,
        ]).exact.some((candidate) => candidate.id === action.id),
      ).toBe(true);
  });

  it('records structured source, target, cards, and Life changes for presentation', () => {
    let state = createGame('miracle', 'normal', 'speed', 42);
    state.players[0].hand = [instance('005')];
    state.players[0].guts = [
      instance('001', 'g1'),
      instance('002', 'g2'),
      instance('003', 'g3'),
    ];
    const action = getLegalActions(state).find(
      (item) => item.label === 'Stab',
    )!;
    state = reduceGame(state, { type: 'play-action', actionId: action.id });
    state = reduceGame(state, { type: 'pass-defense' });
    const damage = state.events.findLast((event) => event.kind === 'damage')!;
    expect(damage.data?.cardIds).toEqual(['005']);
    expect(damage.data?.target).toEqual(action.target);
    expect((damage.data?.beforeLife ?? 0) - (damage.data?.afterLife ?? 0)).toBe(
      damage.data?.amount,
    );
  });

  it('enforces one Breeder card per turn', () => {
    let state = createGame('miracle', 'normal', 'speed', 42);
    state.players[0].hand = [
      instance('112', 'help1'),
      instance('112', 'help2'),
    ];
    state.players[0].guts = [instance('001', 'g1')];
    const action = getLegalActions(state).find(
      (item) => item.label === 'Help',
    )!;
    state = reduceGame(state, { type: 'play-action', actionId: action.id });
    state = reduceGame(state, { type: 'pass-defense' });
    expect(state.players[0].breederCardPlayed).toBe(true);
    expect(getLegalActions(state).some((item) => item.label === 'Help')).toBe(
      false,
    );
  });
});

describe('journey progression', () => {
  it('unlocks the Festival after two ranch wins and the final rival after both trials', () => {
    const start = createCampaign('speed', 'moss');
    expect(festivalUnlocked(start)).toBe(false);
    expect(npcUnlocked(start, NPCS.veyra)).toBe(false);
    const festival = { ...start, defeatedNpcIds: ['mina', 'kiro'] };
    expect(festivalUnlocked(festival)).toBe(true);
    const final = {
      ...festival,
      defeatedNpcIds: [...festival.defeatedNpcIds, 'lyra', 'rook'],
    };
    expect(npcUnlocked(final, NPCS.veyra)).toBe(true);
  });
});

describe('AI safety and completion', () => {
  it('selects deterministic legal commands from an observation', () => {
    const state = createGame('miracle', 'normal', 'speed', 42);
    const request = {
      observation: observeGame(state, 0),
      actions: getLegalActions(state),
      defenses: getLegalDefenses(state),
      difficulty: 'normal' as const,
      entropy: 99,
    };
    expect(chooseAiCommand(request)).toEqual(chooseAiCommand(request));
  });

  for (const player of ['miracle', 'speed', 'powerful'] as const)
    for (const rival of ['miracle', 'speed', 'powerful'] as const) {
      it(`${player} vs ${rival} completes without illegal moves or deadlock`, () => {
        const result = autoMatch(
          player,
          rival,
          120 +
            STARTER_DECKS.findIndex((deck) => deck.id === player) * 10 +
            STARTER_DECKS.findIndex((deck) => deck.id === rival),
        );
        expect(result.state.phase).toBe('gameover');
        expect(result.state.winner).not.toBeNull();
        expect(result.steps).toBeLessThan(1500);
      });
    }
});
