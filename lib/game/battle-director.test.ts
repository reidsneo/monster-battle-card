import { describe, expect, it } from 'vitest';
import { buildDuelCues, cueDuration } from './battle-director';
import { createGame } from './engine';
import type { GameEvent, GameState } from './types';

const initial = () =>
  createGame({
    playerDeckId: 'miracle',
    opponentDeckId: 'speed',
    difficulty: 'normal',
    seed: 412,
  });
function append(
  previous: GameState,
  events: Array<Omit<GameEvent, 'id' | 'turn'>>,
) {
  const next = structuredClone(previous);
  for (const event of events)
    next.events.push({ ...event, id: ++next.eventSequence, turn: next.turn });
  return next;
}

describe('public-event battle director', () => {
  it('does not replay old impacts when resuming a snapshot', () => {
    const state = initial();
    const cues = buildDuelCues(null, state);
    expect(cues).toHaveLength(1);
    expect(cues[0].kind).toBe('phase');
    expect(buildDuelCues(state, structuredClone(state))).toEqual([]);
  });
  it('reveals an ordered chain only after its directional beat', () => {
    const before = initial();
    const next = append(before, [
      {
        kind: 'play',
        message: 'not parsed',
        data: {
          actor: 0,
          sourceMonster: 0,
          target: { player: 1, monster: 0 },
          cardIds: ['001', '002', '003'],
          role: 'attack',
          amount: 5,
        },
      },
    ]);
    const cues = buildDuelCues(before, next);
    expect(cues.map((cue) => cue.kind)).toEqual([
      'direction',
      'reveal',
      'reveal',
      'reveal',
    ]);
    expect(cues.slice(1).map((cue) => cue.shownIds)).toEqual([
      ['001'],
      ['001', '002'],
      ['001', '002', '003'],
    ]);
  });
  it('preserves impacts even when cleanup or victory is the last event', () => {
    const before = initial();
    const next = append(before, [
      {
        kind: 'damage',
        message: '',
        data: {
          actor: 0,
          sourceMonster: 1,
          target: { player: 1, monster: 2 },
          cardIds: ['001'],
          amount: 7,
          beforeLife: 7,
          afterLife: 0,
        },
      },
      { kind: 'system', message: 'cleanup' },
      { kind: 'victory', message: 'winner' },
    ]);
    next.phase = 'gameover';
    next.winner = 0;
    const cues = buildDuelCues(before, next);
    expect(cues.map((cue) => cue.kind)).toEqual([
      'calculation',
      'impact',
      'phase',
    ]);
    expect(cues[1].afterLife).toBe(0);
    expect(cues[2].announcement?.phase).toBe('result');
  });
  it('retains each target in multi-target damage, with no hand or Guts identities', () => {
    const before = initial();
    const next = append(
      before,
      [0, 1, 2].map((monster) => ({
        kind: 'damage' as const,
        message: '',
        data: {
          actor: 0 as const,
          target: { player: 1 as const, monster },
          amount: 2,
          cardIds: ['001'],
        },
      })),
    );
    const cues = buildDuelCues(before, next);
    expect(
      cues
        .filter((cue) => cue.kind === 'impact')
        .map((cue) => cue.target?.monster),
    ).toEqual([0, 1, 2]);
    const hidden = [...next.players[1].hand, ...next.players[1].guts].map(
      (card) => card.instanceId,
    );
    hidden.forEach((id) => expect(JSON.stringify(cues)).not.toContain(id));
  });
  it('supports targetless breeder reveals and zero-damage guard effects', () => {
    const before = initial();
    const next = append(before, [
      {
        kind: 'play',
        message: '',
        data: { actor: 0, cardIds: ['001'], role: 'special' },
      },
      {
        kind: 'damage',
        message: '',
        data: { amount: 0, target: { player: 0, monster: 0 } },
      },
    ]);
    const cues = buildDuelCues(before, next);
    expect(cues[0].kind).toBe('reveal');
    expect(cues.at(-1)?.profile.kind).toBe('shield');
  });
  it('uses bounded durations for normal, faster, and reduced-motion presentation', () => {
    const cue = buildDuelCues(null, initial())[0];
    expect(cueDuration(cue, { speed: 1, reducedMotion: false })).toBe(900);
    expect(cueDuration(cue, { speed: 2, reducedMotion: false })).toBe(450);
    expect(cueDuration(cue, { speed: 1, reducedMotion: true })).toBe(220);
  });

  it('reveals defenses in their public response order and keeps source/target names', () => {
    const before = initial();
    const next = append(before, [
      {
        kind: 'defense',
        message: 'not parsed',
        data: {
          actor: 1,
          cardIds: ['002'],
          sourceMonster: 1,
          target: { player: 1, monster: 1 },
          role: 'defense',
          amount: 2,
        },
      },
    ]);
    const cues = buildDuelCues(before, next);
    expect(cues.map((cue) => cue.kind)).toEqual(['reveal', 'impact']);
    expect(cues[0].shownIds).toEqual(['002']);
    expect(cues[0].response).toBe(true);
    expect(cues[0].sourceName).not.toBe('Breeder');
  });

  it('identifies local setup and rival defense phases without relying on the active turn', () => {
    const state = initial();
    state.phase = 'setup-guts';
    state.activePlayer = 1;
    expect(buildDuelCues(null, state)[0].owner).toBe(0);
  });
});
