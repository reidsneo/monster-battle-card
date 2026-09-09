import { ALL_CARDS, CARD_BY_ID, MONSTERS, MONSTER_BY_ID } from './cards';
import type { CardDefinition, DeckDefinition, MonsterDefinition } from './types';

const copies = (...entries: Array<[string, number]>) =>
  entries.flatMap(([id, count]) => Array.from({ length: count }, () => id));

export const STARTER_DECKS: DeckDefinition[] = [
  {
    id: 'miracle',
    source: 'starter',
    name: 'Miracle Team',
    color: '#f8c83d',
    description: 'Measured Tiger combos, Gali magic, and Suezo disruption.',
    monsterIds: ['C-001', 'C-002', 'C-004'],
    skillIds: copies(
      ['002', 3],
      ['001', 3],
      ['003', 3],
      ['005', 2],
      ['007', 1],
      ['011', 2],
      ['012', 1],
      ['014', 3],
      ['013', 3],
      ['017', 1],
      ['019', 1],
      ['021', 3],
      ['023', 2],
      ['024', 2],
      ['037', 3],
      ['039', 3],
      ['040', 2],
      ['041', 2],
      ['043', 1],
      ['045', 1],
      ['048', 3],
      ['110', 1],
      ['113', 2],
      ['112', 2],
    ),
  },
  {
    id: 'speed',
    source: 'starter',
    name: 'Speed Team',
    color: '#63b7ec',
    description:
      'Fast pressure from Dino, Hare, and Mocchi with efficient defense.',
    monsterIds: ['C-006', 'C-008', 'C-009'],
    skillIds: copies(
      ['061', 3],
      ['062', 1],
      ['064', 3],
      ['067', 1],
      ['069', 2],
      ['071', 3],
      ['072', 2],
      ['085', 2],
      ['086', 3],
      ['087', 2],
      ['090', 3],
      ['093', 1],
      ['095', 1],
      ['096', 3],
      ['097', 3],
      ['098', 3],
      ['099', 1],
      ['100', 3],
      ['104', 1],
      ['106', 2],
      ['108', 2],
      ['110', 1],
      ['112', 2],
      ['113', 2],
    ),
  },
  {
    id: 'powerful',
    source: 'starter',
    name: 'Powerful Team',
    color: '#ea665c',
    description: 'Heavy Golem blows, Pixie sparks, and Naga counters.',
    monsterIds: ['C-003', 'C-005', 'C-007'],
    skillIds: copies(
      ['112', 2],
      ['113', 2],
      ['110', 1],
      ['033', 1],
      ['031', 1],
      ['035', 2],
      ['036', 2],
      ['026', 3],
      ['029', 3],
      ['027', 3],
      ['049', 3],
      ['052', 3],
      ['053', 2],
      ['055', 2],
      ['056', 1],
      ['058', 1],
      ['059', 3],
      ['074', 3],
      ['075', 3],
      ['076', 3],
      ['080', 2],
      ['081', 1],
      ['082', 1],
      ['084', 2],
    ),
  },
];

function variant(
  baseId: 'miracle' | 'speed' | 'powerful',
  id: string,
  name: string,
  description: string,
  swaps: Array<[string, string]>,
) {
  const base = STARTER_DECKS.find((deck) => deck.id === baseId)!;
  const skillIds = [...base.skillIds];
  for (const [remove, add] of swaps) {
    const index = skillIds.indexOf(remove);
    if (index >= 0) skillIds[index] = add;
  }
  return { ...base, id, source: 'npc' as const, name, description, skillIds };
}

export const NPC_DECKS: DeckDefinition[] = [
  variant(
    'miracle',
    'lyra-miracle',
    'Lyra Counterweave',
    'A defensive Miracle list with additional recovery and counters.',
    [
      ['001', '005'],
      ['014', '007'],
    ],
  ),
  variant(
    'powerful',
    'rook-powerful',
    'Rook Iron Pressure',
    'A low-cost Powerful list that keeps attacking through resistance.',
    [
      ['026', '033'],
      ['049', '056'],
    ],
  ),
  variant(
    'speed',
    'veyra-speed',
    'Veyra Tempest Control',
    'A technical Speed list tuned for disruption and chained tempo.',
    [
      ['061', '062'],
      ['086', '067'],
    ],
  ),
];

export const ALL_DECKS = [...STARTER_DECKS, ...NPC_DECKS];
export const DECK_BY_ID = Object.fromEntries(
  ALL_DECKS.map((deck) => [deck.id, deck]),
) as Record<string, DeckDefinition>;

export function registerDeck(deck: DeckDefinition) {
  DECK_BY_ID[deck.id] = deck;
}

export function unregisterDeck(deckId: string) {
  if (deckId.startsWith('custom:') || deckId.startsWith('random:'))
    delete DECK_BY_ID[deckId];
}

export function getDeckDefinition(deckId: string) {
  return DECK_BY_ID[deckId];
}

export function isCardCompatibleWithMonster(
  card: CardDefinition,
  monster: MonsterDefinition,
) {
  if (card.owner === 'Any' || card.owner === 'Breeder') return true;
  if (monster.breedType === 'pure' || monster.subBreed === '???')
    return monster.mainBreed === card.owner;
  if (card.type === 'DGE' || card.type === 'BLK')
    return monster.subBreed === card.owner;
  return monster.mainBreed === card.owner;
}

export function compatibleMonsters(card: CardDefinition, monsterIds: string[]) {
  return monsterIds
    .map((id) => MONSTER_BY_ID[id])
    .filter((monster): monster is MonsterDefinition => Boolean(monster))
    .filter((monster) => isCardCompatibleWithMonster(card, monster));
}

export function validateDeck(deck: DeckDefinition): string[] {
  const errors: string[] = [];
  const selectedMonsters = deck.monsterIds.map((id) => MONSTER_BY_ID[id]);
  if (selectedMonsters.some((monster) => !monster))
    errors.push('Every monster selection must reference a known local print.');
  if (
    deck.monsterIds.length !== 3 ||
    new Set(selectedMonsters.filter(Boolean).map((monster) => monster.logicalId)).size !== 3
  )
    errors.push('A deck needs exactly three uniquely named monsters.');
  if (deck.skillIds.length !== 50)
    errors.push('A deck needs exactly 50 skill cards.');
  const counts = new Map<string, number>();
  for (const id of deck.skillIds) {
    if (!CARD_BY_ID[id]) errors.push(`Unknown skill ${id}.`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of counts)
    if (count > 3)
      errors.push(`${id} has ${count} copies; the maximum is three.`);
  for (const id of counts.keys()) {
    const card = CARD_BY_ID[id];
    if (card && compatibleMonsters(card, deck.monsterIds).length === 0)
      errors.push(`${id} ${card.name} (${card.owner} ${card.type}) is incompatible with this team.`);
  }
  return [...new Set(errors)];
}

function seeded(seed: number) {
  let value = seed || 0x6d2b79f5;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x100000000;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function takeCards(
  output: string[],
  candidates: CardDefinition[],
  amount: number,
  random: () => number,
  predicate: (card: CardDefinition) => boolean = () => true,
) {
  let guard = 0;
  while (amount > 0 && guard < 5000) {
    guard += 1;
    const available = shuffled(candidates, random).find(
      (card) =>
        predicate(card) &&
        output.filter((id) => id === card.id).length < 3,
    );
    if (!available) break;
    output.push(available.id);
    amount -= 1;
  }
  return amount;
}

export function generateRandomDeck(seed: number): DeckDefinition {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const attemptSeed = (seed + Math.imul(attempt + 1, 0x9e3779b9)) >>> 0;
    const random = seeded(attemptSeed);
    const monsterIds = shuffled(MONSTERS, random)
      .slice(0, 3)
      .map((monster) => monster.defaultPrintId) as [string, string, string];
    const compatible = ALL_CARDS.filter(
      (card) => compatibleMonsters(card, monsterIds).length > 0,
    );
    const skillIds: string[] = [];
    let shortage = 0;
    shortage += takeCards(skillIds, compatible, 24, random, (card) =>
      card.owner !== 'Any' && card.owner !== 'Breeder' &&
      (card.type === 'POW' || card.type === 'INT'),
    );
    shortage += takeCards(skillIds, compatible, 8, random, (card) =>
      card.owner !== 'Any' && card.owner !== 'Breeder' &&
      (card.type === 'DGE' || card.type === 'BLK'),
    );
    shortage += takeCards(skillIds, compatible, 6, random, (card) =>
      card.owner !== 'Any' && card.owner !== 'Breeder' && card.type === 'SPE',
    );
    shortage += takeCards(skillIds, compatible, 6, random, (card) => card.owner === 'Any');
    shortage += takeCards(skillIds, compatible, 6, random, (card) =>
      card.owner === 'Breeder' &&
      (card.type !== 'ENV' || skillIds.filter((id) => CARD_BY_ID[id].type === 'ENV').length < 2),
    );
    if (shortage > 0)
      takeCards(
        skillIds,
        compatible,
        shortage,
        random,
        (card) =>
          card.type !== 'ENV' ||
          skillIds.filter((id) => CARD_BY_ID[id].type === 'ENV').length < 2,
      );
    const deck: DeckDefinition = {
      id: `random:${seed >>> 0}`,
      source: 'random',
      name: `Seeded Rival ${String(seed >>> 0).padStart(10, '0')}`,
      color: '#d95757',
      description: 'A deterministic legal deck assembled from the complete card pool.',
      monsterIds,
      skillIds,
    };
    if (validateDeck(deck).length === 0) {
      registerDeck(deck);
      return deck;
    }
  }
  throw new Error(`Unable to generate a legal full-pool deck for seed ${seed}.`);
}
