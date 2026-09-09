import { CARD_BY_ID, MONSTERS, MONSTER_BY_ID } from './cards';
import {
  generateRandomDeck,
  getDeckDefinition,
  isCardCompatibleWithMonster,
  registerDeck,
} from './decks';
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
  const deck = getDeckDefinition(deckId);
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
    blockLocked: false,
    skipNextTurn: false,
    setupGuts: 0,
    gutsConvertedThisTurn: 0,
    permissions: {
      extraBreeders: false,
      unlimitedAttacks: false,
      freeSpecials: false,
    },
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
  if (setup.playerDeck) registerDeck(setup.playerDeck);
  if (setup.opponentDeck) registerDeck(setup.opponentDeck);
  const playerDeck = getDeckDefinition(setup.playerDeckId)
    ? setup.playerDeckId
    : 'miracle';
  const seed = (setup.seed ?? Date.now()) >>> 0;
  const rival =
    setup.opponentDeckId && getDeckDefinition(setup.opponentDeckId)
      ? setup.opponentDeckId
      : generateRandomDeck(seed ^ 0xa53c9e17).id;
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
    environment: null,
    revealedInformation: [],
    transformationHistory: [],
    duelContext: setup.duelContext ?? { mode: 'quick' },
  };
  addEvent(
    state,
    'system',
    `${getDeckDefinition(playerDeck)!.name} faces ${getDeckDefinition(rival)!.name}.`,
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

function ownerMonster(
  state: GameState,
  player: PlayerIndex,
  owner: string,
  type: 'POW' | 'INT' | 'SPE' | 'DGE' | 'BLK' = 'POW',
) {
  return state.players[player].monsters.findIndex(
    (monster) => {
      const definition = MONSTER_BY_ID[monster.definitionId];
      const defense = type === 'DGE' || type === 'BLK';
      return (
        monster.life > 0 &&
        (definition.breedType === 'pure' || definition.subBreed === '???'
          ? definition.mainBreed === owner
          : defense
            ? definition.subBreed === owner
            : definition.mainBreed === owner)
      );
    },
  );
}

function canPay(player: PlayerState, amount: number) {
  return player.guts.length >= amount;
}

function effectiveCost(
  state: GameState,
  player: PlayerIndex,
  instances: CardInstance[],
) {
  const definitions = instances.map((instance) => CARD_BY_ID[instance.cardId]);
  if (
    (state.players[player].permissions.freeSpecials ||
      state.environment?.card.cardId === '356') &&
    definitions[0]?.type === 'SPE'
  )
    return 0;
  if (
    state.environment?.card.cardId === '354' &&
    definitions[0]?.type === 'BLK'
  )
    return 0;
  let cost = definitions.reduce((sum, definition) => sum + definition.guts, 0);
  for (const definition of definitions)
    for (const effect of definition.effects)
      if (effect.kind === 'cost-modifier') cost += effect.amount;
  if (state.environment) {
    const environment = CARD_BY_ID[state.environment.card.cardId];
    for (const effect of environment.effects)
      if (effect.kind === 'cost-modifier') cost += effect.amount;
  }
  return Math.max(0, cost);
}

function compatible(cardId: string, monster: MonsterState) {
  return isCardCompatibleWithMonster(
    CARD_BY_ID[cardId],
    MONSTER_BY_ID[monster.definitionId],
  );
}

function sourceHasActed(player: PlayerState) {
  return (
    player.breederCardPlayed ||
    player.monsters.some((monster) => monster.attacked)
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
  if (
    effect.target === 'opponents' ||
    effect.target === 'opponent-air' ||
    effect.target === 'opponent-ground'
  )
    return state.players[other(source)].monsters
      .map((monster, index) => ({ player: other(source), monster: index }))
      .filter((ref) => {
        const monster = state.players[ref.player].monsters[ref.monster];
        return (
          monster.life > 0 &&
          (effect.target === 'opponents' ||
            monster.attribute ===
              (effect.target === 'opponent-air' ? 'air' : 'ground'))
        );
      });
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
        (effect.target === 'all-except-self' || monster.attribute === 'ground') &&
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
  const pairCombo = definitions[0].effects.find(
    (effect) => effect.kind === 'pair-combo',
  );
  let damage =
    combo && cardInstances.length > 1
      ? cardInstances.length === 3
        ? combo.threeDamage
        : combo.twoDamage
      : pairCombo && cardInstances.length > 1
        ? pairCombo.damage
        : (definitions[0].damage ?? 0);
  if (attackerMonster !== null) {
    const attacker = state.players[state.activePlayer].monsters[attackerMonster];
    const attackerDefinition = MONSTER_BY_ID[attacker.definitionId];
    for (const effect of modifier ? CARD_BY_ID[modifier.cardId].effects : []) {
      if (effect.kind !== 'attack-modifier') continue;
      const applies =
        !effect.condition ||
        effect.condition === 'always' ||
        (effect.condition === 'low-life' && attacker.life <= 2) ||
        (effect.condition === 'pure' && attackerDefinition.breedType === 'pure') ||
        (effect.condition === 'deck-empty' &&
          state.players[state.activePlayer].drawPile.length === 0);
      if (applies)
        damage =
          effect.operation === 'add'
            ? damage + effect.amount
            : damage * effect.amount;
    }
    if (
      definitions[0].type === 'POW' &&
      attacker.statuses.some((status) => status.kind === 'jump')
    )
      damage *= 2;
    if (
      attacker.statuses.some(
        (status) => status.kind === 'anger' && state.turn > status.appliedTurn,
      )
    )
      damage *= 2;
  }
  const targetAttribute =
    state.players[target.player].monsters[target.monster].attribute;
  const attributeDamage = definitions[0].effects.find(
    (effect) => effect.kind === 'attribute-damage',
  );
  if (attributeDamage?.attribute === targetAttribute)
    damage *= attributeDamage.multiplier;
  const environment = state.environment
    ? CARD_BY_ID[state.environment.card.cardId]
    : undefined;
  for (const effect of environment?.effects ?? []) {
    if (effect.kind === 'attack-modifier')
      damage =
        effect.operation === 'add'
          ? damage + effect.amount
          : damage * effect.amount;
    if (
      effect.kind === 'environment-damage' &&
      effect.types.includes(definitions[0].type as 'POW' | 'INT')
    )
      damage += effect.amount;
  }
  damage = Math.max(0, damage);
  const cost = effectiveCost(
    state,
    state.activePlayer,
    [...cardInstances, ...(modifier ? [modifier] : [])],
  );
  const label =
    cardInstances.length > 1
      ? `${cardInstances.map((item) => CARD_BY_ID[item.cardId].name).join(' + ')} combo`
      : definitions[0].name;
  return {
    id: `attack:${cardInstances.map((item) => item.instanceId).join(',')}:${attackerMonster ?? 'b'}:${target.player}-${target.monster}:${modifier?.instanceId ?? '-'}`,
    kind: 'attack',
    label,
    detail: `${cost} Guts · ${damage} damage${modifier ? ` · ${CARD_BY_ID[modifier.cardId].name}` : ''}`,
    cardInstanceIds: cardInstances.map((item) => item.instanceId),
    modifierInstanceIds: modifier ? [modifier.instanceId] : [],
    attackerMonster,
    target,
    scoreHint: damage * 3 - cost,
    estimatedDamage: damage,
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
  const modifiers = self.hand.filter((instance) =>
    CARD_BY_ID[instance.cardId]?.effects.some(
      (effect) => effect.kind === 'attack-modifier',
    ),
  );

  for (const instance of self.hand) {
    const card = CARD_BY_ID[instance.cardId];
    if (
      !card ||
      card.type === 'DGE' ||
      card.type === 'BLK' ||
      card.effects.some((effect) => effect.kind === 'attack-modifier')
    )
      continue;
    if (card.owner === 'Breeder') {
      if (self.breederCardPlayed && !self.permissions.extraBreeders) continue;
      if (
        state.environment?.card.cardId === '353' &&
        card.type !== 'ENV'
      )
        continue;
      const heal = card.effects.find((effect) => effect.kind === 'heal');
      if (
        card.id === '114' &&
        (sourceHasActed(self) || self.drawPile.length < 5)
      )
        continue;
      if (card.id === '127' && self.monsters.filter((monster) => monster.life > 0).length !== 1)
        continue;
      if (card.id === '254') {
        self.monsters.forEach((monster, index) => {
          if (monster.life > 0 && monster.attacked)
            actions.push({
              id: `special:${instance.instanceId}:ready:${index}`,
              kind: 'special',
              label: card.name,
              detail: `Let ${MONSTER_BY_ID[monster.definitionId].name} attack again.`,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: null,
              target: { player, monster: index },
              scoreHint: 8,
            });
        });
      } else if (card.id === '351') {
        self.monsters.forEach((monster, index) => {
          if (monster.statuses.some((status) => status.kind === 'cannot-attack'))
            actions.push({
              id: `special:${instance.instanceId}:cleanse:${index}`,
              kind: 'special',
              label: card.name,
              detail: `Remove Cannot Attack from ${MONSTER_BY_ID[monster.definitionId].name}.`,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: null,
              target: { player, monster: index },
              scoreHint: 7,
            });
        });
      } else if (card.handler === 'resurrection') {
        self.monsters.forEach((monster, index) => {
          if (
            monster.life <= 0 &&
            MONSTER_BY_ID[monster.definitionId].mainBreed === 'Phoenix' &&
            canPay(self, effectiveCost(state, player, [instance]))
          )
            actions.push({
              id: `special:${instance.instanceId}:resurrection:${index}`,
              kind: 'special',
              label: card.name,
              detail: `Revive ${MONSTER_BY_ID[monster.definitionId].name} with 4 Life`,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: null,
              target: { player, monster: index },
              scoreHint: 18,
            });
        });
      } else if (card.handler === 'fusion') {
        const alive = self.monsters
          .map((monster, index) => ({ monster, index }))
          .filter(({ monster }) => monster.life > 0);
        for (let left = 0; left < alive.length; left += 1)
          for (let right = left + 1; right < alive.length; right += 1) {
            const first = MONSTER_BY_ID[alive[left].monster.definitionId];
            const second = MONSTER_BY_ID[alive[right].monster.definitionId];
            const survivors = self.monsters
              .filter((_, index) =>
                index !== alive[left].index && index !== alive[right].index,
              )
              .map((monster) => MONSTER_BY_ID[monster.definitionId].logicalId);
            const replacement = MONSTERS.find(
              (monster) =>
                monster.breedType === 'mixed' &&
                monster.mainBreed === first.mainBreed &&
                monster.subBreed === second.subBreed &&
                !survivors.includes(monster.logicalId),
            );
            if (replacement && canPay(self, effectiveCost(state, player, [instance])))
              actions.push({
                id: `special:${instance.instanceId}:fusion:${alive[left].index}-${alive[right].index}:${replacement.logicalId}`,
                kind: 'special',
                label: `${card.name} → ${replacement.name}`,
                detail: `Fuse ${first.name} and ${second.name} into ${replacement.name}`,
                cardInstanceIds: [instance.instanceId],
                modifierInstanceIds: [],
                attackerMonster: null,
                target: { player, monster: alive[left].index },
                sacrificedMonsters: [alive[left].index, alive[right].index],
                replacementMonsterId: replacement.defaultPrintId,
                scoreHint: 14,
              });
          }
      } else if (heal) {
        self.monsters.forEach((monster, index) => {
          if (
            monster.life > 0 &&
            monster.life < MONSTER_BY_ID[monster.definitionId].life
          )
            actions.push({
              id: `special:${instance.instanceId}:heal:${index}`,
              kind: 'special',
              label: card.name,
              detail: `Heal ${MONSTER_BY_ID[monster.definitionId].name} by ${heal.amount}`,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: null,
              target: { player, monster: index },
              scoreHint: heal.amount * 3,
            });
        });
      } else if (card.type === 'SPE' || card.type === 'ENV') {
        if (canPay(self, effectiveCost(state, player, [instance])))
          actions.push({
            id: `special:${instance.instanceId}:${card.id}`,
            kind: 'special',
            label: card.name,
            detail: card.text,
            cardInstanceIds: [instance.instanceId],
            modifierInstanceIds: [],
            attackerMonster: null,
            target: null,
            scoreHint: card.type === 'ENV' ? 8 : 5,
          });
      } else if (canPay(self, effectiveCost(state, player, [instance])))
        targets.forEach(({ ref }) =>
          actions.push(attackAction(state, [instance], null, ref)),
        );
      continue;
    }
    const attackers = self.monsters
      .map((monster, index) => ({ monster, index }))
      .filter(({ monster }) => monster.life > 0 && compatible(card.id, monster));
    for (const { monster, index: attacker } of attackers) {
      if (['182', '241'].includes(card.id) && monster.life > 2) continue;
      if (card.id === '125' && self.discard.length < monster.life) continue;
      if (
        card.id === '250' &&
        self.monsters.filter((candidate) => candidate.life > 0).length !== 1
      )
        continue;
      const repeatable = card.effects.find(
        (effect) => effect.kind === 'repeatable',
      );
      if (
        monster.attacked &&
        !self.permissions.unlimitedAttacks &&
        state.environment?.card.cardId !== '355' &&
        !(repeatable && monster.repeatableGroup === repeatable.group)
      )
        continue;
      if (monster.statuses.some((status) => status.kind === 'cannot-attack'))
        continue;
      if (
        monster.statuses.some((status) => status.kind === 'cocoon') &&
        card.handler !== 'emerge'
      )
        continue;
      if (!canPay(self, effectiveCost(state, player, [instance]))) continue;
      if (card.type === 'SPE') {
        if (state.environment?.card.cardId === '257') continue;
        if (card.handler === 'take-over') {
          self.monsters.forEach((ally, allyIndex) => {
            if (ally.life <= 0 && allyIndex !== attacker)
              actions.push({
                id: `special:${instance.instanceId}:take-over:${attacker}:${allyIndex}`,
                kind: 'special',
                label: `${card.name} → ${MONSTER_BY_ID[ally.definitionId].name}`,
                detail: 'Transfer remaining Life to a KO monster.',
                cardInstanceIds: [instance.instanceId],
                modifierInstanceIds: [],
                attackerMonster: attacker,
                target: { player, monster: allyIndex },
                scoreHint: 12,
              });
          });
          continue;
        }
        if (card.handler === 'emerge') {
          if (!monster.statuses.some((status) => status.kind === 'cocoon'))
            continue;
          const teammateNames = self.monsters
            .filter((_, index) => index !== attacker)
            .map((ally) => MONSTER_BY_ID[ally.definitionId].logicalId);
          MONSTERS.filter(
            (candidate) =>
              candidate.breedType === 'mixed' &&
              candidate.subBreed === 'Worm' &&
              !teammateNames.includes(candidate.logicalId),
          ).forEach((candidate) =>
            actions.push({
              id: `special:${instance.instanceId}:emerge:${attacker}:${candidate.logicalId}`,
              kind: 'special',
              label: `${card.name} → ${candidate.name}`,
              detail: `Emerge as ${candidate.name}.`,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: attacker,
              target: { player, monster: attacker },
              replacementMonsterId: candidate.defaultPrintId,
              scoreHint: 12,
            }),
          );
          continue;
        }
        const heal = card.effects.find((effect) => effect.kind === 'heal');
        const targetOpponent = card.effects.some(
          (effect) =>
            effect.kind === 'attack-lock' && effect.target === 'damaged',
        );
        if (heal) {
          self.monsters.forEach((ally, allyIndex) => {
            if (
              ally.life > 0 &&
              ally.life < MONSTER_BY_ID[ally.definitionId].life
            )
              actions.push({
                id: `special:${instance.instanceId}:heal:${allyIndex}:${attacker}`,
                kind: 'special',
                label: card.name,
                detail: `Heal ${MONSTER_BY_ID[ally.definitionId].name} by ${heal.amount}`,
                cardInstanceIds: [instance.instanceId],
                modifierInstanceIds: [],
                attackerMonster: attacker,
                target: { player, monster: allyIndex },
                scoreHint: heal.amount * 3,
              });
          });
        } else if (targetOpponent) {
          targets.forEach(({ ref }) =>
            actions.push({
              id: `special:${instance.instanceId}:${card.id}:${attacker}:${ref.player}-${ref.monster}`,
              kind: 'special',
              label: card.name,
              detail: card.text,
              cardInstanceIds: [instance.instanceId],
              modifierInstanceIds: [],
              attackerMonster: attacker,
              target: ref,
              scoreHint: 6,
            }),
          );
        } else {
          actions.push({
            id: `special:${instance.instanceId}:${card.id}:${attacker}`,
            kind: 'special',
            label: card.name,
            detail: card.text,
            cardInstanceIds: [instance.instanceId],
            modifierInstanceIds: [],
            attackerMonster: attacker,
            target: null,
            scoreHint: card.effects.some(
              (effect) => effect.kind === 'lock-defense',
            )
              ? 7
              : 5,
          });
        }
        continue;
      }
      const restriction = card.effects.find(
        (effect) => effect.kind === 'target-restriction',
      );
      targets
        .filter(
          ({ monster: targetMonster }) =>
            !restriction || targetMonster.attribute === restriction.attribute,
        )
        .forEach(({ ref }) => {
          actions.push(attackAction(state, [instance], attacker, ref));
          for (const modifier of modifiers) {
            if (
              compatible(modifier.cardId, monster) &&
              canPay(self, effectiveCost(state, player, [instance, modifier]))
            )
              actions.push(
                attackAction(state, [instance], attacker, ref, modifier),
              );
          }
        });
    }
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
  for (const instance of self.hand) {
    const pair = CARD_BY_ID[instance.cardId]?.effects.find(
      (effect) => effect.kind === 'pair-combo',
    );
    if (!pair) continue;
    const mate = self.hand.find(
      (candidate) =>
        candidate.instanceId !== instance.instanceId &&
        pair.cardIds.includes(candidate.cardId),
    );
    if (!mate || instance.instanceId > mate.instanceId) continue;
    const pairCard = CARD_BY_ID[instance.cardId];
    const attacker = ownerMonster(
      state,
      player,
      pairCard.owner,
      pairCard.type as 'POW' | 'INT',
    );
    if (attacker < 0 || self.monsters[attacker].attacked) continue;
    targets.forEach(({ ref }) =>
      actions.push(attackAction(state, [instance, mate], attacker, ref)),
    );
  }
  const environmentId = state.environment?.card.cardId;
  return actions.filter((action) => {
    if (action.kind !== 'attack') return true;
    if (environmentId === '119' && (action.estimatedDamage ?? 0) <= 3)
      return false;
    if (environmentId === '258' && (action.estimatedDamage ?? 0) >= 4)
      return false;
    if (action.target) {
      const affected = baseTargets(
        state,
        player,
        action.attackerMonster ?? 0,
        CARD_BY_ID[
          self.hand.find((instance) =>
            action.cardInstanceIds.includes(instance.instanceId),
          )?.cardId ?? action.cardInstanceIds[0]
        ]?.id ?? '',
        action.target,
      );
      if (
        affected.some((target) =>
          state.players[target.player].monsters[target.monster].statuses.some(
            (status) => status.kind === 'attack-protection',
          ),
        )
      )
        return false;
      const taunted = enemy.monsters
        .map((monster, index) => ({ monster, index }))
        .filter(({ monster }) =>
          monster.statuses.some((status) => status.kind === 'taunt'),
        );
      if (
        taunted.length &&
        !taunted.some(({ index }) =>
          affected.some(
            (target) => target.player === other(player) && target.monster === index,
          ),
        )
      )
        return false;
    }
    return true;
  });
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
      !canPay(defender, effectiveCost(state, target.player, [instance]))
    )
      continue;
    for (
      let monsterIndex = 0;
      monsterIndex < defender.monsters.length;
      monsterIndex += 1
    ) {
      const monster = defender.monsters[monsterIndex];
      if (monster.life <= 0 || !compatible(instance.cardId, monster)) continue;
      if (monster.statuses.some((status) => status.kind === 'anger')) continue;
      const dodge = card.effects.find((effect) => effect.kind === 'dodge');
      const block = card.effects.find((effect) => effect.kind === 'block');
      const blockHalf = card.effects.find(
        (effect) => effect.kind === 'block-half',
      );
      const reflect = card.effects.find((effect) => effect.kind === 'reflect');
      const redirect = card.effects.find(
        (effect) => effect.kind === 'redirect',
      );
      if (!dodge && !block && !blockHalf && !reflect && !redirect) continue;
      if (!redirect && monsterIndex !== target.monster) continue;
      if (redirect && monsterIndex === target.monster) continue;
      if (
        dodge &&
        (pending.undodgeable ||
          defender.dodgeLocked ||
          (state.environment?.card.cardId === '255' &&
            pending.attackerMonster !== null &&
            MONSTER_BY_ID[
              state.players[pending.sourcePlayer].monsters[
                pending.attackerMonster
              ].definitionId
            ].breedType === 'pure' &&
            MONSTER_BY_ID[monster.definitionId].breedType === 'mixed') ||
          !dodge.against.includes(pending.type) ||
          (dodge.minPrintedGuts ?? 0) > pending.printedGuts)
      )
        continue;
      if (
        (block || blockHalf) &&
        (defender.blockLocked ||
          pending.unblockable ||
          !(block?.against ?? blockHalf?.against ?? []).includes(pending.type))
      )
        continue;
      if (reflect && reflect.against !== pending.type) continue;
      results.push({
        instanceId: instance.instanceId,
        monster: monsterIndex,
        label: card.name,
        detail: `${card.guts} Guts · ${card.text}`,
        scoreHint: dodge
          ? pending.workingDamage * 3
          : block || blockHalf
            ? Math.min(
                block?.reduce ?? Math.ceil(pending.workingDamage / 2),
                pending.workingDamage,
              ) * 2
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
  if (
    pending.hitAny &&
    pending.gutsLoss &&
    !foe.monsters.some((monster) =>
      monster.statuses.some((status) => status.kind === 'negate-guts-loss'),
    )
  ) {
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
  if (pending.returnToHand) source.hand.push(...pending.attackCards);
  else source.discard.push(...pending.attackCards);
  source.discard.push(...pending.modifierCards);
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
  if (monster.statuses.some((status) => status.kind === 'damage-immunity'))
    amount = 0;
  if (pending.preventKo && amount >= monster.life)
    amount = Math.max(0, monster.life - 1);
  monster.life = Math.max(0, monster.life - amount);
  if (amount > 0 && pending.locksDamagedMonster)
    monster.statuses.push({
      kind: 'cannot-attack',
      appliedTurn: state.turn,
      expiresTurn: state.turn + 1,
    });
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
  const cost = effectiveCost(state, sourceIndex, [...cards, ...modifiers]);
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
    const foe = state.players[other(sourceIndex)];
    const lockDefense = card.effects.find(
      (effect) => effect.kind === 'lock-defense',
    );
    if (
      card.effects.some((effect) => effect.kind === 'lock-dodge') ||
      lockDefense?.defense === 'DGE'
    )
      foe.dodgeLocked = true;
    if (lockDefense?.defense === 'BLK') foe.blockLocked = true;
    const attackLock = card.effects.find(
      (effect) => effect.kind === 'attack-lock',
    );
    if (attackLock?.target === 'opponents') {
      foe.monsters.forEach((monster) =>
        monster.statuses.push({
          kind: 'cannot-attack',
          appliedTurn: state.turn,
          expiresTurn: state.turn + 1,
        }),
      );
    } else if (attackLock && action.target) {
      state.players[action.target.player].monsters[
        action.target.monster
      ].statuses.push({
        kind: 'cannot-attack',
        appliedTurn: state.turn,
        expiresTurn: state.turn + 1,
      });
    }
    const attributeChange = card.effects.find(
      (effect) => effect.kind === 'attribute-change',
    );
    if (attributeChange) {
      const changed =
        attributeChange.target === 'all'
          ? state.players.flatMap((playerState) => playerState.monsters)
          : attributeChange.target === 'all-allies'
            ? source.monsters
            : action.attackerMonster === null
              ? []
              : [source.monsters[action.attackerMonster]];
      changed.forEach((monster) => {
        monster.attribute = attributeChange.attribute;
        if (attributeChange.duration !== 'environment')
          monster.statuses.push({
            kind: 'temporary-attribute',
            attribute: attributeChange.attribute,
            appliedTurn: state.turn,
            expiresTurn: state.turn + 1,
          });
      });
    }
    if (card.effects.some((effect) => effect.kind === 'damage-immunity') && action.attackerMonster !== null)
      source.monsters[action.attackerMonster].statuses.push({
        kind: 'damage-immunity',
        appliedTurn: state.turn,
        expiresTurn: state.turn + 1,
      });
    if (card.effects.some((effect) => effect.kind === 'skip-turn'))
      foe.skipNextTurn = true;
    if (card.id === '126') {
      for (const playerState of state.players)
        playerState.discard.push(...playerState.guts.splice(0).reverse());
    }
    if (card.id === '197') source.permissions.extraBreeders = true;
    if (card.id === '276') source.permissions.extraBreeders = true;
    if (['083', '175', '294'].includes(card.id))
      source.permissions.unlimitedAttacks = true;
    if (card.id === '250') source.permissions.unlimitedAttacks = true;
    if (card.id === '342') source.permissions.freeSpecials = true;
    if (card.id === '057' && action.attackerMonster !== null)
      source.monsters[action.attackerMonster].statuses.push({
        kind: 'attack-protection',
        appliedTurn: state.turn,
        expiresTurn: state.turn + 2,
      });
    if (card.id === '245' && action.attackerMonster !== null)
      source.monsters[action.attackerMonster].statuses.push({
        kind: 'negate-guts-loss',
        appliedTurn: state.turn,
        expiresTurn: state.turn + 2,
      });
    if (card.id === '251' && action.attackerMonster !== null)
      source.monsters[action.attackerMonster].statuses.push({
        kind: 'anger',
        appliedTurn: state.turn,
        expiresTurn: state.turn + 2,
      });
    if ((card.id === '269' || card.effects.some((effect) => effect.kind === 'taunt')) && action.attackerMonster !== null)
      source.monsters[action.attackerMonster].statuses.push({
        kind: 'taunt',
        appliedTurn: state.turn,
        expiresTurn: state.turn + 2,
      });
    if (card.id === '114')
      source.guts.push(...source.drawPile.splice(0, 5));
    if (card.id === '125' && action.attackerMonster !== null) {
      const sacrificed = source.monsters[action.attackerMonster];
      const amount = sacrificed.life;
      sacrificed.life = 0;
      source.guts.push(
        ...source.discard.splice(Math.max(0, source.discard.length - amount), amount),
      );
    }
    if (card.id === '127') source.guts.push(...source.drawPile.splice(0));
    if (card.id === '252') {
      source.drawPile = shuffle(
        [...source.drawPile, ...source.guts.splice(0)],
        Math.floor(random(state) * 0xffffffff),
      );
    }
    if (card.id === '254' && action.target)
      source.monsters[action.target.monster].attacked = false;
    if (card.id === '351' && action.target)
      source.monsters[action.target.monster].statuses = source.monsters[
        action.target.monster
      ].statuses.filter((status) => status.kind !== 'cannot-attack');
    if (card.id === '279') {
      const amount = source.hand.length;
      source.discard.push(...source.hand.splice(0));
      if (source.drawPile.length < amount) {
        state.winner = other(sourceIndex);
        state.phase = 'gameover';
      } else source.hand.push(...source.drawPile.splice(0, amount));
    }
    if (card.id === '304' && foe.hand.length) {
      const [chosen] = foe.hand.splice(
        Math.floor(random(state) * foe.hand.length),
        1,
      );
      foe.discard.push(chosen);
    }
    if (card.id === '306')
      foe.discard.push(...foe.drawPile.splice(0, Math.min(3, foe.drawPile.length)));
    if (['186', '303'].includes(card.id) && action.attackerMonster !== null) {
      const wantedType = card.id === '186' ? ['DGE'] : ['POW', 'INT'];
      const retrievedIndex = source.discard.findLastIndex((instance) => {
        const definition = CARD_BY_ID[instance.cardId];
        return (
          wantedType.includes(definition.type) &&
          compatible(instance.cardId, source.monsters[action.attackerMonster!])
        );
      });
      if (retrievedIndex >= 0)
        source.hand.push(...source.discard.splice(retrievedIndex, 1));
    }
    if (card.id === '278') {
      const lost = foe.guts.pop();
      if (lost) foe.discard.push(lost);
    }
    if (card.id === '364') {
      source.discard.push(...source.hand.splice(0));
      foe.discard.push(...foe.hand.splice(0));
    }
    if (card.handler === 'riddler') {
      foe.drawPile.push(...foe.hand.splice(0));
      if (foe.drawPile.length < 4) {
        state.winner = sourceIndex;
        state.phase = 'gameover';
      } else foe.hand.push(...foe.drawPile.splice(0, 4));
    }
    if (card.handler === 'resurrection') {
      const phoenix = action.target
        ? source.monsters[action.target.monster]
        : undefined;
      if (phoenix) {
        phoenix.life = 4;
        phoenix.attacked = true;
      }
    }
    if (card.handler === 'take-over' && action.attackerMonster !== null && action.target) {
      const donor = source.monsters[action.attackerMonster];
      const revived = source.monsters[action.target.monster];
      revived.life = Math.min(
        MONSTER_BY_ID[revived.definitionId].life,
        donor.life,
      );
      revived.attacked = true;
      donor.life = 0;
    }
    if (card.handler === 'cocoon' && action.attackerMonster !== null)
      source.monsters[action.attackerMonster].statuses.push({
        kind: 'cocoon',
        appliedTurn: state.turn,
        expiresTurn: Number.MAX_SAFE_INTEGER,
      });
    if (
      card.handler === 'emerge' &&
      action.attackerMonster !== null &&
      action.replacementMonsterId
    ) {
      const transformed = source.monsters[action.attackerMonster];
      const from = transformed.definitionId;
      const replacement = MONSTER_BY_ID[action.replacementMonsterId];
      transformed.definitionId = action.replacementMonsterId;
      transformed.life = replacement.life;
      transformed.attribute = replacement.attribute;
      transformed.attacked = true;
      transformed.statuses = transformed.statuses.filter(
        (status) => status.kind !== 'cocoon',
      );
      state.transformationHistory.push({
        turn: state.turn,
        player: sourceIndex,
        monster: action.attackerMonster,
        from,
        to: action.replacementMonsterId,
      });
    }
    if (
      card.handler === 'fusion' &&
      action.replacementMonsterId &&
      action.sacrificedMonsters?.length === 2
    ) {
      const [slot, consumed] = action.sacrificedMonsters;
      const transformed = source.monsters[slot];
      const from = transformed.definitionId;
      const replacement = MONSTER_BY_ID[action.replacementMonsterId];
      source.monsters[consumed].life = 0;
      transformed.definitionId = action.replacementMonsterId;
      transformed.life = replacement.life;
      transformed.attribute = replacement.attribute;
      transformed.attacked = true;
      transformed.statuses = [];
      state.transformationHistory.push({
        turn: state.turn,
        player: sourceIndex,
        monster: slot,
        from,
        to: action.replacementMonsterId,
      });
    }
    if (card.type === 'ENV') {
      if (state.environment) {
        state.players[state.environment.owner].discard.push(
          state.environment.card,
        );
      }
      state.players.forEach((playerState) =>
        playerState.monsters.forEach((monster) => {
          if (
            !monster.statuses.some(
              (status) =>
                status.kind === 'jump' ||
                status.kind === 'temporary-attribute',
            )
          )
            monster.attribute = MONSTER_BY_ID[monster.definitionId].attribute;
        }),
      );
      state.environment = { card: cards[0], owner: sourceIndex };
      const environmentAttribute = card.effects.find(
        (effect) => effect.kind === 'attribute-change',
      );
      if (environmentAttribute)
        state.players.forEach((playerState) =>
          playerState.monsters.forEach((monster) => {
            monster.attribute = environmentAttribute.attribute;
          }),
        );
    } else source.discard.push(...cards, ...modifiers);
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
    checkWinner(state, sourceIndex);
    return;
  }

  const definitions = cards.map((item) => CARD_BY_ID[item.cardId]);
  const combo = definitions[0].effects.find(
    (effect) => effect.kind === 'combo',
  );
  const pairCombo = definitions[0].effects.find(
    (effect) => effect.kind === 'pair-combo',
  );
  let damage =
    combo && cards.length > 1
      ? cards.length === 3
        ? combo.threeDamage
        : combo.twoDamage
      : pairCombo && cards.length > 1
        ? pairCombo.damage
        : (card.damage ?? 0);
  if (action.attackerMonster !== null) {
    const attackerDefinition = MONSTER_BY_ID[
      source.monsters[action.attackerMonster].definitionId
    ];
    for (const modifier of modifiers) {
      for (const effect of CARD_BY_ID[modifier.cardId].effects) {
        if (effect.kind !== 'attack-modifier') continue;
        const applies =
          !effect.condition ||
          effect.condition === 'always' ||
          (effect.condition === 'low-life' &&
            source.monsters[action.attackerMonster].life <= 2) ||
          (effect.condition === 'pure' && attackerDefinition.breedType === 'pure') ||
          (effect.condition === 'deck-empty' && source.drawPile.length === 0);
        if (!applies) continue;
        damage =
          effect.operation === 'add'
            ? damage + effect.amount
            : damage * effect.amount;
      }
    }
  }
  if (
    action.attackerMonster !== null &&
    card.type === 'POW' &&
    source.monsters[action.attackerMonster].statuses.some(
      (status) => status.kind === 'jump',
    )
  )
    damage *= 2;
  if (
    action.attackerMonster !== null &&
    source.monsters[action.attackerMonster].statuses.some(
      (status) => status.kind === 'anger' && state.turn > status.appliedTurn,
    )
  )
    damage *= 2;
  if (action.target) {
    const targetAttribute =
      state.players[action.target.player].monsters[action.target.monster]
        .attribute;
    const attributeDamage = card.effects.find(
      (effect) => effect.kind === 'attribute-damage',
    );
    if (attributeDamage?.attribute === targetAttribute)
      damage *= attributeDamage.multiplier;
  }
  const environmentCard = state.environment
    ? CARD_BY_ID[state.environment.card.cardId]
    : undefined;
  for (const effect of environmentCard?.effects ?? []) {
    if (effect.kind === 'attack-modifier')
      damage =
        effect.operation === 'add'
          ? damage + effect.amount
          : damage * effect.amount;
    if (
      effect.kind === 'environment-damage' &&
      effect.types.includes(card.type as 'POW' | 'INT')
    )
      damage += effect.amount;
  }
  damage = Math.max(0, damage);
  const targets = baseTargets(
    state,
    sourceIndex,
    action.attackerMonster ?? 0,
    card.id,
    action.target!,
  );
  const effects = [...definitions, ...modifiers.map((item) => CARD_BY_ID[item.cardId])]
    .flatMap((item) => item.effects);
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
    unblockable: effects.some((effect) => effect.kind === 'unblockable'),
    returnToHand: effects.some((effect) => effect.kind === 'return-to-hand'),
    locksDamagedMonster: effects.some(
      (effect) => effect.kind === 'attack-lock' && effect.target === 'damaged',
    ),
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
      payGuts(
        state,
        target.player,
        effectiveCost(state, target.player, [instance]),
      );
      player.discard.push(instance);
      const dodge = card.effects.find((effect) => effect.kind === 'dodge');
      const block = card.effects.find((effect) => effect.kind === 'block');
      const blockHalf = card.effects.find(
        (effect) => effect.kind === 'block-half',
      );
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
      if (blockHalf)
        state.pendingAttack.workingDamage = Math.floor(
          state.pendingAttack.workingDamage / 2,
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
      const attributeChange = card.effects.find(
        (effect) => effect.kind === 'attribute-change',
      );
      if (attributeChange) {
        const affected =
          attributeChange.target === 'all'
            ? state.players.flatMap((playerState) => playerState.monsters)
            : attributeChange.target === 'all-allies'
              ? player.monsters.filter(
                  (_, index) => card.id !== '270' || index !== defense.monster,
                )
              : [player.monsters[defense.monster]];
        affected.forEach((monster) => {
          monster.attribute = attributeChange.attribute;
          monster.statuses.push({
            kind: 'temporary-attribute',
            attribute: attributeChange.attribute,
            appliedTurn: state.turn,
            expiresTurn: state.turn + 1,
          });
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
    if (
      state.environment?.card.cardId === '283' &&
      self.gutsConvertedThisTurn >= 2
    )
      return state;
    const moved = removeHandCards(self, [command.instanceId]);
    if (moved.length) {
      self.guts.push(...moved);
      self.gutsConvertedThisTurn += moved.length;
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
    self.gutsConvertedThisTurn = 0;
    self.permissions = {
      extraBreeders: false,
      unlimitedAttacks: false,
      freeSpecials: false,
    };
    self.monsters.forEach((monster) => {
      monster.attacked = false;
      monster.repeatableGroup = null;
      monster.statuses = monster.statuses.filter(
        (status) => status.expiresTurn > state.turn,
      );
      const temporary = [...monster.statuses]
        .reverse()
        .find(
          (status) =>
            status.kind === 'jump' || status.kind === 'temporary-attribute',
        );
      const environmentAttribute = state.environment
        ? CARD_BY_ID[state.environment.card.cardId].effects.find(
            (effect) => effect.kind === 'attribute-change',
          )
        : undefined;
      monster.attribute =
        temporary?.attribute ??
        (temporary?.kind === 'jump' ? 'air' : undefined) ??
        environmentAttribute?.attribute ??
        MONSTER_BY_ID[monster.definitionId].attribute;
    });
    if (state.environment?.card.cardId === '284')
      self.discard.push(...self.hand.splice(0));
    if (state.environment?.card.cardId === '260') {
      self.monsters.forEach((monster) => {
        if (monster.life > 0) monster.life = Math.max(0, monster.life - 1);
      });
      checkWinner(state, other(state.activePlayer));
      if (state.winner !== null) return state;
    }
    state.players[other(state.activePlayer)].dodgeLocked = false;
    state.players[other(state.activePlayer)].blockLocked = false;
    state.activePlayer = other(state.activePlayer);
    state.turn += 1;
    if (state.players[state.activePlayer].skipNextTurn) {
      state.players[state.activePlayer].skipNextTurn = false;
      addEvent(
        state,
        'system',
        `${state.activePlayer === 0 ? 'Your' : "The rival's"} turn is skipped.`,
      );
      state.activePlayer = other(state.activePlayer);
      state.turn += 1;
    }
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
    environment: copy(state.environment),
    self: copy(state.players[perspective]),
    opponent: {
      deckId: opponent.deckId,
      discard: copy(opponent.discard),
      monsters: copy(opponent.monsters),
      breederCardPlayed: opponent.breederCardPlayed,
      dodgeLocked: opponent.dodgeLocked,
      blockLocked: opponent.blockLocked,
      skipNextTurn: opponent.skipNextTurn,
      setupGuts: opponent.setupGuts,
      gutsConvertedThisTurn: opponent.gutsConvertedThisTurn,
      permissions: copy(opponent.permissions),
      handCount: opponent.hand.length,
      drawCount: opponent.drawPile.length,
      gutsCount: opponent.guts.length,
    },
    pendingAttack: copy(state.pendingAttack),
  };
}
