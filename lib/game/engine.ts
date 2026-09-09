import { CARD_BY_ID, MONSTER_BY_ID } from './cards';
import { DECK_BY_ID } from './decks';
import {
  CONTENT_VERSION,
  type CardInstance,
  type GameCommand,
  type GameEvent,
  type GameSetup,
  type GameState,
  type LegalAction,
  type LegalDefense,
  type MonsterState,
  type PendingAttack,
  type PlayerIndex,
  type PlayerObservation,
  type PlayerState,
  type TargetRef,
} from './types';

const other = (player: PlayerIndex): PlayerIndex => (player === 0 ? 1 : 0);
const copy = <T>(value: T): T => structuredClone(value);

function random(state: GameState) {
  let x = state.rngState || 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x >>> 0;
  return state.rngState / 0x100000000;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let x = seed || 0x6d2b79f5;
  for (let i = result.length - 1; i > 0; i -= 1) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const j = Math.floor(((x >>> 0) / 0x100000000) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function addEvent(
  state: GameState,
  kind: GameEvent['kind'],
  message: string,
  data?: GameEvent['data'],
) {
  state.eventSequence += 1;
  state.events.push({
    id: state.eventSequence,
    turn: state.turn,
    kind,
    message,
    data,
  });
}

function makePlayer(
  deckId: string,
  player: PlayerIndex,
  seed: number,
): PlayerState {
  const deck = DECK_BY_ID[deckId];
  if (!deck) throw new Error(`Unknown deck ${deckId}.`);
  const instances = deck.skillIds.map((cardId, index) => ({
    instanceId: `${player}-${cardId}-${index}`,
    cardId,
  }));
  const drawPile = shuffle(
    instances,
    seed ^ (player ? 0x9e3779b9 : 0x85ebca6b),
  );
  const hand = drawPile.splice(0, 5);
  return {
    deckId,
    drawPile,
    hand,
    guts: [],
    discard: [],
    breederCardPlayed: false,
    dodgeLocked: false,
    setupGuts: 0,
    monsters: deck.monsterIds.map((definitionId): MonsterState => {
      const definition = MONSTER_BY_ID[definitionId];
      return {
        definitionId,
        life: definition.life,
        attribute: definition.attribute,
        attacked: false,
        repeatableGroup: null,
        statuses: [],
      };
    }),
  };
}

export function createGame(setup: GameSetup): GameState;
export function createGame(
  playerDeck: string,
  difficulty: GameState['difficulty'],
  aiDeck?: string,
  requestedSeed?: number,
): GameState;
export function createGame(
  setupOrDeck: GameSetup | string,
  legacyDifficulty?: GameState['difficulty'],
  legacyAiDeck?: string,
  legacySeed = Date.now(),
): GameState {
  const setup: GameSetup =
    typeof setupOrDeck === 'string'
      ? {
          playerDeckId: setupOrDeck,
          difficulty: legacyDifficulty ?? 'normal',
          opponentDeckId: legacyAiDeck,
          seed: legacySeed,
          duelContext: { mode: 'quick' },
        }
      : setupOrDeck;
  const playerDeck = DECK_BY_ID[setup.playerDeckId]
    ? setup.playerDeckId
    : 'miracle';
  const seed = (setup.seed ?? Date.now()) >>> 0;
  const rivals = Object.keys(DECK_BY_ID).filter(
    (id) => id !== playerDeck && DECK_BY_ID[id].source === 'starter',
  );
  const rival =
    setup.opponentDeckId && DECK_BY_ID[setup.opponentDeckId]
      ? setup.opponentDeckId
      : rivals[seed % rivals.length];
  const startingPlayer = (seed & 1) as PlayerIndex;
  const state: GameState = {
    contentVersion: CONTENT_VERSION,
    seed,
    rngState: seed,
    difficulty: setup.difficulty,
    turn: 1,
    activePlayer: startingPlayer,
    startingPlayer,
    phase: 'attack',
    players: [makePlayer(playerDeck, 0, seed), makePlayer(rival, 1, seed)],
    pendingAttack: null,
    winner: null,
    eventSequence: 0,
    events: [],
    selectedSetupCards: [],
    duelContext: setup.duelContext ?? { mode: 'quick' },
  };
  addEvent(
    state,
    'system',
    `${DECK_BY_ID[playerDeck].name} faces ${DECK_BY_ID[rival].name}.`,
  );
  addEvent(
    state,
    'system',
    `${startingPlayer === 0 ? 'You go' : 'The rival goes'} first. The first player skips the opening draw.`,
  );
  const second = other(startingPlayer);
  if (second === 1) {
    const moved = state.players[1].hand.splice(0, 2);
    state.players[1].guts.push(...moved);
    state.players[1].setupGuts = moved.length;
    addEvent(state, 'guts', `The rival sets ${moved.length} opening Guts.`, {
      actor: 1,
      amount: moved.length,
      role: 'guts',
    });
  } else {
    state.phase = 'setup-guts';
    addEvent(
      state,
      'system',
      'As second player, you may set up to two opening Guts.',
    );
  }
  return state;
}

function ownerMonster(state: GameState, player: PlayerIndex, owner: string) {
  return state.players[player].monsters.findIndex(
    (monster) =>
      MONSTER_BY_ID[monster.definitionId].name === owner && monster.life > 0,
  );
}

function canPay(player: PlayerState, amount: number) {
  return player.guts.length >= amount;
}

function compatible(cardId: string, monster: MonsterState) {
  const owner = CARD_BY_ID[cardId].owner;
  return (
    owner === 'Any' ||
    owner === 'Breeder' ||
    MONSTER_BY_ID[monster.definitionId].name === owner
  );
}

function baseTargets(
  state: GameState,
  source: PlayerIndex,
  attacker: number,
  cardId: string,
  target: TargetRef,
): TargetRef[] {
  const effect = CARD_BY_ID[cardId].effects.find((item) => item.kind === 'aoe');
  if (!effect) return [target];
  if (effect.target === 'opponents')
    return state.players[other(source)].monsters
      .map((monster, index) => ({ player: other(source), monster: index }))
      .filter(
        (ref) => state.players[ref.player].monsters[ref.monster].life > 0,
      );
  return ([0, 1] as PlayerIndex[])
    .flatMap((player) =>
      state.players[player].monsters.map((monster, index) => ({
        player,
        monster: index,
      })),
    )
    .filter((ref) => {
      const monster = state.players[ref.player].monsters[ref.monster];
      return (
        monster.life > 0 &&
        monster.attribute === 'ground' &&
        !(ref.player === source && ref.monster === attacker)
      );
    });
}

function attackAction(
  state: GameState,
  cardInstances: CardInstance[],
  attackerMonster: number | null,
  target: TargetRef,
  modifier?: CardInstance,
): LegalAction {
  const definitions = cardInstances.map((item) => CARD_BY_ID[item.cardId]);
  const combo = definitions[0].effects.find(
    (effect) => effect.kind === 'combo',
  );
  const damage =
    combo && cardInstances.length > 1
      ? cardInstances.length === 3
        ? combo.threeDamage
        : combo.twoDamage
      : (definitions[0].damage ?? 0);
  const cost =
    definitions.reduce((sum, item) => sum + item.guts, 0) +
    (modifier ? CARD_BY_ID[modifier.cardId].guts : 0);
  const label =
    cardInstances.length > 1
      ? `${cardInstances.map((item) => CARD_BY_ID[item.cardId].name).join(' + ')} combo`
      : definitions[0].name;
  return {
    id: `attack:${cardInstances.map((item) => item.instanceId).join(',')}:${attackerMonster ?? 'b'}:${target.player}-${target.monster}:${modifier?.instanceId ?? '-'}`,
    kind: 'attack',
    label,
    detail: `${cost} Guts · ${damage}${modifier ? ' ×2 if wounded' : ''} damage`,
    cardInstanceIds: cardInstances.map((item) => item.instanceId),
    modifierInstanceIds: modifier ? [modifier.instanceId] : [],
    attackerMonster,
    target,
    scoreHint: damage * 3 - cost,
  };
}

export function getLegalActions(state: GameState): LegalAction[] {
  if (state.phase !== 'attack' || state.winner !== null) return [];
  const player = state.activePlayer;
  const self = state.players[player];
  const enemy = state.players[other(player)];
  const targets = enemy.monsters
    .map((monster, index) => ({
      monster,
      ref: { player: other(player), monster: index } as TargetRef,
    }))
    .filter(({ monster }) => monster.life > 0);
  const actions: LegalAction[] = [];
  const modifiers = self.hand.filter((instance) => instance.cardId === '110');

  for (const instance of self.hand) {
    const card = CARD_BY_ID[instance.cardId];
    if (
      !card ||
      card.type === 'DGE' ||
      card.type === 'BLK' ||
      card.id === '110'
    )
      continue;
    if (card.owner === 'Breeder') {
      if (self.breederCardPlayed) continue;
      if (card.id === '113') {
        self.monsters.forEach((monster, index) => {
          if (
            monster.life > 0 &&
            monster.life < MONSTER_BY_ID[monster.definitionId].life
          )
            actions.push({
              id: `special:${instance.instanceId}:heal:${index}`,
              kind: 'special',
              label: 'Mango',
              detail: `Heal ${MONSTER_BY_ID[monster.definitionId].name} by 1`,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: null,
              target: { player, monster: index },
              scoreHint: 5,
            });
        });
      } else if (canPay(self, card.guts))
        targets.forEach(({ ref }) =>
          actions.push(attackAction(state, [instance], null, ref)),
        );
      continue;
    }
    const attacker = ownerMonster(state, player, card.owner);
    if (attacker < 0) continue;
    const monster = self.monsters[attacker];
    const repeatable = card.effects.some(
      (effect) => effect.kind === 'repeatable',
    );
    if (
      monster.attacked &&
      !(repeatable && monster.repeatableGroup === 'pixie-spark')
    )
      continue;
    if (!canPay(self, card.guts)) continue;
    if (card.type === 'SPE') {
      if (card.id === '058') {
        self.monsters.forEach((ally, index) => {
          if (
            ally.life > 0 &&
            ally.life < MONSTER_BY_ID[ally.definitionId].life
          )
            actions.push({
              id: `special:${instance.instanceId}:heal:${index}`,
              kind: 'special',
              label: card.name,
              detail: `Heal ${MONSTER_BY_ID[ally.definitionId].name} by 3`,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: attacker,
              target: { player, monster: index },
              scoreHint: 9,
            });
        });
      } else {
        actions.push({
          id: `special:${instance.instanceId}:${card.id}`,
          kind: 'special',
          label: card.name,
          detail: card.text,
          cardInstanceIds: [instance.instanceId],
          modifierInstanceIds: [],
          attackerMonster: attacker,
          target: null,
          scoreHint: card.id === '082' ? 7 : 5,
        });
      }
      continue;
    }
    targets.forEach(({ ref }) => {
      actions.push(attackAction(state, [instance], attacker, ref));
      if (monster.life <= 2)
        for (const modifier of modifiers)
          if (canPay(self, card.guts + CARD_BY_ID[modifier.cardId].guts))
            actions.push(
              attackAction(state, [instance], attacker, ref, modifier),
            );
    });
  }

  const comboCards = self.hand.filter((instance) =>
    ['001', '002', '003'].includes(instance.cardId),
  );
  const tiger = ownerMonster(state, player, 'Tiger');
  if (tiger >= 0 && !self.monsters[tiger].attacked) {
    for (let a = 0; a < comboCards.length; a += 1)
      for (let b = a + 1; b < comboCards.length; b += 1) {
        if (comboCards[a].cardId === comboCards[b].cardId) continue;
        targets.forEach(({ ref }) =>
          actions.push(
            attackAction(state, [comboCards[a], comboCards[b]], tiger, ref),
          ),
        );
        for (let c = b + 1; c < comboCards.length; c += 1) {
          if (
            new Set([
              comboCards[a].cardId,
              comboCards[b].cardId,
              comboCards[c].cardId,
            ]).size !== 3
          )
            continue;
          targets.forEach(({ ref }) =>
            actions.push(
              attackAction(
                state,
                [comboCards[a], comboCards[b], comboCards[c]],
                tiger,
                ref,
              ),
            ),
          );
        }
      }
  }
  return actions;
}

export function getLegalDefenses(state: GameState): LegalDefense[] {
  const pending = state.pendingAttack;
  if (state.phase !== 'defense' || !pending) return [];
  const target = pending.targets[pending.targetCursor];
  const defender = state.players[target.player];
  const results: LegalDefense[] = [];
  for (const instance of defender.hand) {
    const card = CARD_BY_ID[instance.cardId];
    if (
      !card ||
      !['DGE', 'BLK'].includes(card.type) ||
      !canPay(defender, card.guts)
    )
      continue;
    for (
      let monsterIndex = 0;
      monsterIndex < defender.monsters.length;
      monsterIndex += 1
    ) {
      const monster = defender.monsters[monsterIndex];
      if (monster.life <= 0 || !compatible(instance.cardId, monster)) continue;
      const dodge = card.effects.find((effect) => effect.kind === 'dodge');
      const block = card.effects.find((effect) => effect.kind === 'block');
      const reflect = card.effects.find((effect) => effect.kind === 'reflect');
      const redirect = card.effects.find(
        (effect) => effect.kind === 'redirect',
      );
      if (!dodge && !block && !reflect && !redirect) continue;
      if (!redirect && monsterIndex !== target.monster) continue;
      if (redirect && monsterIndex === target.monster) continue;
      if (
        dodge &&
        (pending.undodgeable ||
          defender.dodgeLocked ||
          !dodge.against.includes(pending.type) ||
          (dodge.minPrintedGuts ?? 0) > pending.printedGuts)
      )
        continue;
      if (block && !block.against.includes(pending.type)) continue;
      if (reflect && reflect.against !== pending.type) continue;
      results.push({
        instanceId: instance.instanceId,
        monster: monsterIndex,
        label: card.name,
        detail: `${card.guts} Guts · ${card.text}`,
        scoreHint: dodge
          ? pending.workingDamage * 3
          : block
            ? Math.min(block.reduce, pending.workingDamage) * 2
            : redirect
              ? 2
              : pending.workingDamage,
      });
    }
  }
  return results;
}

function removeHandCards(player: PlayerState, ids: string[]) {
  const removed: CardInstance[] = [];
  for (const id of ids) {
    const index = player.hand.findIndex((item) => item.instanceId === id);
    if (index >= 0) removed.push(...player.hand.splice(index, 1));
  }
  return removed;
}

function payGuts(state: GameState, playerIndex: PlayerIndex, amount: number) {
  if (amount <= 0) return;
  const player = state.players[playerIndex];
  const payment = player.guts.splice(
    Math.max(0, player.guts.length - amount),
    amount,
  );
  player.discard.push(...payment.reverse());
  addEvent(
    state,
    'guts',
    `${playerIndex === 0 ? 'You pay' : 'The rival pays'} ${amount} Guts.`,
    { actor: playerIndex, amount, role: 'guts' },
  );
}

function checkWinner(state: GameState, attacker: PlayerIndex) {
  const dead = state.players.map((player) =>
    player.monsters.every((monster) => monster.life <= 0),
  );
  if (!dead[0] && !dead[1]) return;
  state.winner = dead[0] && dead[1] ? attacker : dead[0] ? 1 : 0;
  state.phase = 'gameover';
  addEvent(
    state,
    'victory',
    `${state.winner === 0 ? 'You win' : 'The rival wins'} the match${dead[0] && dead[1] ? ' by the attacker tie-break' : ''}.`,
    { actor: state.winner, role: 'result' },
  );
}

function finishPending(state: GameState) {
  const pending = state.pendingAttack!;
  const source = state.players[pending.sourcePlayer];
  const foe = state.players[other(pending.sourcePlayer)];
  if (pending.hitAny && pending.gutsLoss) {
    const count =
      pending.gutsLoss === 'all'
        ? foe.guts.length
        : Math.min(pending.gutsLoss, foe.guts.length);
    foe.discard.push(
      ...foe.guts.splice(Math.max(0, foe.guts.length - count), count).reverse(),
    );
    addEvent(
      state,
      'guts',
      `${other(pending.sourcePlayer) === 0 ? 'You lose' : 'The rival loses'} ${count} Guts.`,
    );
  }
  if (pending.attackerMonster !== null) {
    const attacker = source.monsters[pending.attackerMonster];
    if (pending.selfDamage > 0 && pending.hitAny)
      attacker.life = Math.max(0, attacker.life - pending.selfDamage);
    if (pending.reflectedDamage > 0)
      attacker.life = Math.max(0, attacker.life - pending.reflectedDamage);
    if (pending.lifesteal && pending.totalDamage > 0)
      attacker.life = Math.min(
        MONSTER_BY_ID[attacker.definitionId].life,
        attacker.life + pending.totalDamage,
      );
  }
  source.discard.push(...pending.attackCards, ...pending.modifierCards);
  state.pendingAttack = null;
  checkWinner(state, pending.sourcePlayer);
  if (state.phase !== 'gameover') state.phase = 'attack';
}

function resolveCurrentTarget(state: GameState) {
  const pending = state.pendingAttack!;
  const target = pending.targets[pending.targetCursor];
  const monster = state.players[target.player].monsters[target.monster];
  const beforeLife = monster.life;
  let amount = Math.max(0, pending.workingDamage);
  if (pending.preventKo && amount >= monster.life)
    amount = Math.max(0, monster.life - 1);
  monster.life = Math.max(0, monster.life - amount);
  pending.hitAny ||= amount > 0;
  pending.totalDamage += amount;
  addEvent(
    state,
    'damage',
    `${MONSTER_BY_ID[monster.definitionId].name} takes ${amount} damage${monster.life <= 0 ? ' and is KO' : ''}.`,
    {
      actor: pending.sourcePlayer,
      cardIds: [...pending.attackCards, ...pending.modifierCards].map(
        (item) => item.cardId,
      ),
      sourceMonster: pending.attackerMonster,
      target,
      targets: pending.targets,
      amount,
      beforeLife,
      afterLife: monster.life,
      attackType: pending.type,
      role: 'attack',
    },
  );
  if (pending.targetCursor + 1 < pending.targets.length) {
    pending.targetCursor += 1;
    pending.workingDamage = pending.baseDamage;
    state.phase = 'defense';
  } else finishPending(state);
}

function executeAction(state: GameState, action: LegalAction) {
  const sourceIndex = state.activePlayer;
  const source = state.players[sourceIndex];
  const cards = removeHandCards(source, action.cardInstanceIds);
  const modifiers = removeHandCards(source, action.modifierInstanceIds);
  const card = CARD_BY_ID[cards[0].cardId];
  const cost = [...cards, ...modifiers].reduce(
    (sum, instance) => sum + CARD_BY_ID[instance.cardId].guts,
    0,
  );
  payGuts(state, sourceIndex, cost);
  if (action.attackerMonster !== null) {
    source.monsters[action.attackerMonster].attacked = true;
    const repeatable = card.effects.find(
      (effect) => effect.kind === 'repeatable',
    );
    source.monsters[action.attackerMonster].repeatableGroup =
      repeatable?.group ?? null;
  } else source.breederCardPlayed = true;

  if (action.kind === 'special') {
    const heal = card.effects.find((effect) => effect.kind === 'heal');
    if (heal && action.target) {
      const monster = source.monsters[action.target.monster];
      monster.life = Math.min(
        MONSTER_BY_ID[monster.definitionId].life,
        monster.life + heal.amount,
      );
    }
    const draw = card.effects.find((effect) => effect.kind === 'draw');
    if (draw)
      for (let i = 0; i < draw.amount && source.drawPile.length; i += 1)
        source.hand.push(source.drawPile.shift()!);
    const discard = card.effects.find(
      (effect) => effect.kind === 'discard-opponent',
    );
    if (discard) {
      const foe = state.players[other(sourceIndex)];
      for (let i = 0; i < discard.amount && foe.hand.length; i += 1)
        foe.discard.push(
          ...foe.hand.splice(Math.floor(random(state) * foe.hand.length), 1),
        );
    }
    if (card.effects.some((effect) => effect.kind === 'lock-dodge'))
      state.players[other(sourceIndex)].dodgeLocked = true;
    source.discard.push(...cards, ...modifiers);
    addEvent(
      state,
      'play',
      `${sourceIndex === 0 ? 'You play' : 'The rival plays'} ${card.name}.`,
      {
        actor: sourceIndex,
        cardIds: [card.id],
        sourceMonster: action.attackerMonster,
        target: action.target ?? undefined,
        amount: heal?.amount,
        role: 'special',
      },
    );
    return;
  }

  const definitions = cards.map((item) => CARD_BY_ID[item.cardId]);
  const combo = definitions[0].effects.find(
    (effect) => effect.kind === 'combo',
  );
  let damage =
    combo && cards.length > 1
      ? cards.length === 3
        ? combo.threeDamage
        : combo.twoDamage
      : (card.damage ?? 0);
  if (
    modifiers.length &&
    action.attackerMonster !== null &&
    source.monsters[action.attackerMonster].life <= 2
  )
    damage *= 2;
  if (
    action.attackerMonster !== null &&
    card.type === 'POW' &&
    source.monsters[action.attackerMonster].statuses.some(
      (status) => status.kind === 'jump',
    )
  )
    damage *= 2;
  const targets = baseTargets(
    state,
    sourceIndex,
    action.attackerMonster ?? 0,
    card.id,
    action.target!,
  );
  const effects = definitions.flatMap((item) => item.effects);
  const pending: PendingAttack = {
    sourcePlayer: sourceIndex,
    attackerMonster: action.attackerMonster,
    attackCards: cards,
    modifierCards: modifiers,
    defenseCards: [],
    type: card.type as 'POW' | 'INT',
    printedGuts: definitions.reduce((sum, item) => sum + item.guts, 0),
    targets,
    targetCursor: 0,
    baseDamage: damage,
    workingDamage: damage,
    undodgeable: effects.some((effect) => effect.kind === 'undodgeable'),
    halfOnDodge: effects.some((effect) => effect.kind === 'half-on-dodge'),
    selfDamage:
      effects.find((effect) => effect.kind === 'self-damage')?.amount ?? 0,
    preventKo: effects.some((effect) => effect.kind === 'prevent-ko'),
    hitAny: false,
    totalDamage: 0,
    reflectedDamage: 0,
    gutsLoss:
      effects.find((effect) => effect.kind === 'guts-loss')?.amount ?? null,
    lifesteal: effects.some((effect) => effect.kind === 'lifesteal'),
  };
  state.pendingAttack = pending;
  state.phase = 'defense';
  addEvent(
    state,
    'play',
    `${sourceIndex === 0 ? 'You use' : 'The rival uses'} ${action.label} for ${damage} damage.`,
    {
      actor: sourceIndex,
      cardIds: [...cards, ...modifiers].map((item) => item.cardId),
      sourceMonster: action.attackerMonster,
      target: action.target ?? undefined,
      targets,
      amount: damage,
      attackType: pending.type,
      role: 'attack',
    },
  );
}

function replenish(state: GameState, playerIndex: PlayerIndex) {
  const player = state.players[playerIndex];
  if (player.hand.length >= 5) {
    const top = player.drawPile.shift();
    if (!top) {
      state.winner = other(playerIndex);
      state.phase = 'gameover';
      addEvent(
        state,
        'victory',
        `${playerIndex === 0 ? 'You cannot' : 'The rival cannot'} draw and lose the match.`,
      );
      return;
    }
    player.guts.push(top);
    addEvent(
      state,
      'draw',
      `${playerIndex === 0 ? 'Your' : 'The rival’s'} full hand sends the top card to Guts.`,
      { actor: playerIndex, amount: 1, role: 'draw' },
    );
    return;
  }
  const needed = 5 - player.hand.length;
  if (player.drawPile.length < needed) {
    state.winner = other(playerIndex);
    state.phase = 'gameover';
    addEvent(
      state,
      'victory',
      `${playerIndex === 0 ? 'You cannot' : 'The rival cannot'} replenish to five cards and lose.`,
    );
    return;
  }
  player.hand.push(...player.drawPile.splice(0, needed));
  addEvent(
    state,
    'draw',
    `${playerIndex === 0 ? 'You draw' : 'The rival draws'} ${needed} card${needed === 1 ? '' : 's'}.`,
    { actor: playerIndex, amount: needed, role: 'draw' },
  );
}

export function reduceGame(
  previous: GameState,
  command: GameCommand,
): GameState {
  const state = copy(previous);
  if (state.phase === 'gameover') return state;
  const self = state.players[state.activePlayer];
  if (command.type === 'setup-toggle-guts' && state.phase === 'setup-guts') {
    const selected = state.selectedSetupCards;
    const index = selected.indexOf(command.instanceId);
    if (index >= 0) selected.splice(index, 1);
    else if (
      selected.length < 2 &&
      state.players[0].hand.some(
        (item) => item.instanceId === command.instanceId,
      )
    )
      selected.push(command.instanceId);
  } else if (command.type === 'finish-setup' && state.phase === 'setup-guts') {
    const player = state.players[0];
    const moved = removeHandCards(player, state.selectedSetupCards);
    player.guts.push(...moved);
    player.setupGuts = moved.length;
    state.selectedSetupCards = [];
    state.phase = 'attack';
    addEvent(state, 'guts', `You set ${moved.length} opening Guts.`, {
      actor: 0,
      amount: moved.length,
      role: 'guts',
    });
  } else if (command.type === 'play-action' && state.phase === 'attack') {
    const action = getLegalActions(state).find(
      (item) => item.id === command.actionId,
    );
    if (action) executeAction(state, action);
  } else if (
    command.type === 'play-defense' &&
    state.phase === 'defense' &&
    state.pendingAttack
  ) {
    const defense = getLegalDefenses(state).find(
      (item) =>
        item.instanceId === command.instanceId &&
        item.monster === command.monster,
    );
    if (defense) {
      const target =
        state.pendingAttack.targets[state.pendingAttack.targetCursor];
      const player = state.players[target.player];
      const [instance] = removeHandCards(player, [defense.instanceId]);
      const card = CARD_BY_ID[instance.cardId];
      state.pendingAttack.defenseCards ??= [];
      state.pendingAttack.defenseCards.push(instance);
      payGuts(state, target.player, card.guts);
      player.discard.push(instance);
      const dodge = card.effects.find((effect) => effect.kind === 'dodge');
      const block = card.effects.find((effect) => effect.kind === 'block');
      const reflect = card.effects.find((effect) => effect.kind === 'reflect');
      const redirect = card.effects.find(
        (effect) => effect.kind === 'redirect',
      );
      if (dodge)
        state.pendingAttack.workingDamage = state.pendingAttack.halfOnDodge
          ? Math.floor(state.pendingAttack.workingDamage / 2)
          : 0;
      if (block)
        state.pendingAttack.workingDamage = Math.max(
          0,
          state.pendingAttack.workingDamage - block.reduce,
        );
      if (reflect) {
        const amount =
          reflect.amount === 'all'
            ? state.pendingAttack.workingDamage
            : Math.floor(state.pendingAttack.workingDamage / 2);
        state.pendingAttack.reflectedDamage += amount;
        if (reflect.amount === 'all') state.pendingAttack.workingDamage = 0;
      }
      if (redirect)
        state.pendingAttack.targets[state.pendingAttack.targetCursor].monster =
          defense.monster;
      if (card.effects.some((effect) => effect.kind === 'jump')) {
        player.monsters[defense.monster].attribute = 'air';
        player.monsters[defense.monster].statuses.push({
          kind: 'jump',
          appliedTurn: state.turn,
          expiresTurn: state.turn + 1,
        });
      }
      addEvent(
        state,
        'defense',
        `${target.player === 0 ? 'You use' : 'The rival uses'} ${card.name}.`,
        {
          actor: target.player,
          cardIds: [card.id],
          sourceMonster: defense.monster,
          target,
          amount: state.pendingAttack.workingDamage,
          attackType: state.pendingAttack.type,
          role: 'defense',
        },
      );
    }
  } else if (command.type === 'pass-defense' && state.phase === 'defense') {
    resolveCurrentTarget(state);
  } else if (command.type === 'finish-attacking' && state.phase === 'attack') {
    state.phase = 'guts';
  } else if (command.type === 'convert-guts' && state.phase === 'guts') {
    const moved = removeHandCards(self, [command.instanceId]);
    if (moved.length) {
      self.guts.push(...moved);
      addEvent(
        state,
        'guts',
        `${state.activePlayer === 0 ? 'You bank' : 'The rival banks'} a card as Guts.`,
        {
          actor: state.activePlayer,
          cardIds: moved.map((item) => item.cardId),
          amount: 1,
          role: 'guts',
        },
      );
    }
  } else if (command.type === 'finish-turn' && state.phase === 'guts') {
    self.breederCardPlayed = false;
    self.monsters.forEach((monster) => {
      monster.attacked = false;
      monster.repeatableGroup = null;
      monster.statuses = monster.statuses.filter(
        (status) => status.expiresTurn > state.turn,
      );
      if (!monster.statuses.some((status) => status.kind === 'jump'))
        monster.attribute = MONSTER_BY_ID[monster.definitionId].attribute;
    });
    state.players[other(state.activePlayer)].dodgeLocked = false;
    state.activePlayer = other(state.activePlayer);
    state.turn += 1;
    state.phase = 'attack';
    replenish(state, state.activePlayer);
    if (state.winner === null)
      addEvent(
        state,
        'system',
        `${state.activePlayer === 0 ? 'Your' : 'Rival'} turn begins.`,
      );
  }
  return state;
}

export function observeGame(
  state: GameState,
  perspective: PlayerIndex,
): PlayerObservation {
  const opponent = state.players[other(perspective)];
  return {
    perspective,
    turn: state.turn,
    phase: state.phase,
    self: copy(state.players[perspective]),
    opponent: {
      deckId: opponent.deckId,
      discard: copy(opponent.discard),
      monsters: copy(opponent.monsters),
      breederCardPlayed: opponent.breederCardPlayed,
      dodgeLocked: opponent.dodgeLocked,
      setupGuts: opponent.setupGuts,
      handCount: opponent.hand.length,
      drawCount: opponent.drawPile.length,
      gutsCount: opponent.guts.length,
    },
    pendingAttack: copy(state.pendingAttack),
  };
}
