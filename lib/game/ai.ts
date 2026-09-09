import type { GameCommand, LegalAction, LegalDefense, PlayerObservation } from './types';
import { CARD_BY_ID } from './cards';
import { DECK_BY_ID } from './decks';

export interface AiRequest {
  observation: PlayerObservation;
  actions: LegalAction[];
  defenses: LegalDefense[];
  difficulty: 'easy' | 'normal' | 'hard';
  entropy: number;
}

function seeded(entropy: number) {
  let x = entropy || 0x12345678;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 0x100000000;
}

function actionValue(request: AiRequest, action: LegalAction) {
  let score = action.scoreHint;
  const target = action.target && request.observation.opponent.monsters[action.target.monster];
  const damage = Number(action.detail.match(/·\s*(\d+)/)?.[1] ?? 0);
  if (target && damage >= target.life) score += 18;
  if (target && target.life <= 3) score += 5;
  if (action.kind === 'special') score += 2;
  score += Math.min(6, request.observation.self.guts.length) * 0.12;
  if (request.difficulty === 'hard') {
    const visibleDiscards = new Map<string, number>();
    for (const card of request.observation.opponent.discard) visibleDiscards.set(card.cardId, (visibleDiscards.get(card.cardId) ?? 0) + 1);
    const unseen = [...DECK_BY_ID[request.observation.opponent.deckId].skillIds];
    for (const [id, count] of visibleDiscards) for (let index = 0; index < count; index += 1) unseen.splice(unseen.indexOf(id), 1);
    const defenseDensity = unseen.filter((id) => ['DGE', 'BLK'].includes(CARD_BY_ID[id]?.type)).length / Math.max(1, unseen.length);
    const isUndodgeable = action.detail.toLowerCase().includes('cannot be dodged') || action.label === 'Holy Ray' || action.label === 'Lightning' || action.label === 'Pierce' || action.label === 'Thrust';
    score += defenseDensity * request.observation.opponent.handCount * (isUndodgeable ? 1.1 : -.22);
    score += request.observation.opponent.drawCount < 8 ? 2.5 : 0;
    const followUp = request.actions.filter((next) => next.attackerMonster !== action.attackerMonster && !next.cardInstanceIds.some((id) => action.cardInstanceIds.includes(id))).reduce((best, next) => Math.max(best, next.scoreHint), 0);
    score += followUp * .18;
  }
  return score;
}

export function chooseAiCommand(request: AiRequest): GameCommand {
  const { observation, actions, defenses, difficulty, entropy } = request;
  if (observation.phase === 'defense') {
    if (!defenses.length) return { type: 'pass-defense' };
    if (difficulty === 'easy' && seeded(entropy) < 0.32) return { type: 'pass-defense' };
    const ranked = [...defenses].sort((a, b) => b.scoreHint - a.scoreHint);
    if (ranked[0].scoreHint <= 0) return { type: 'pass-defense' };
    const choice = difficulty === 'easy' ? ranked[Math.floor(seeded(entropy ^ 0xa5a5) * ranked.length)] : ranked[0];
    return { type: 'play-defense', instanceId: choice.instanceId, monster: choice.monster };
  }
  if (observation.phase === 'attack') {
    if (!actions.length) return { type: 'finish-attacking' };
    if (difficulty === 'easy') {
      if (seeded(entropy ^ 0x4321) < 0.18) return { type: 'finish-attacking' };
      const weights = actions.map((action) => Math.max(1, action.scoreHint + 6));
      let cursor = seeded(entropy) * weights.reduce((sum, value) => sum + value, 0);
      for (let i = 0; i < actions.length; i += 1) { cursor -= weights[i]; if (cursor <= 0) return { type: 'play-action', actionId: actions[i].id }; }
    }
    const choice = [...actions].sort((a, b) => actionValue(request, b) - actionValue(request, a) || a.id.localeCompare(b.id))[0];
    return { type: 'play-action', actionId: choice.id };
  }
  if (observation.phase === 'guts') {
    if (
      observation.environment?.card.cardId === '283' &&
      observation.self.gutsConvertedThisTurn >= 2
    )
      return { type: 'finish-turn' };
    if (observation.self.hand.length) return { type: 'convert-guts', instanceId: observation.self.hand[0].instanceId };
    return { type: 'finish-turn' };
  }
  return { type: 'finish-setup' };
}
