import { CARD_BY_ID, MONSTER_BY_ID } from './cards';
import type { DeckDefinition } from './types';

const copies = (...entries: Array<[string, number]>) =>
  entries.flatMap(([id, count]) => Array.from({ length: count }, () => id));

export const STARTER_DECKS: DeckDefinition[] = [
  {
    id: 'miracle',
    name: 'Miracle Team',
    color: '#f8c83d',
    description: 'Measured Tiger combos, Gali magic, and Suezo disruption.',
    monsterIds: ['C-001', 'C-002', 'C-004'],
    skillIds: copies(
      ['002', 3], ['001', 3], ['003', 3], ['005', 2], ['007', 1], ['011', 2], ['012', 1],
      ['014', 3], ['013', 3], ['017', 1], ['019', 1], ['021', 3], ['023', 2], ['024', 2],
      ['037', 3], ['039', 3], ['040', 2], ['041', 2], ['043', 1], ['045', 1], ['048', 3],
      ['110', 1], ['113', 2], ['112', 2],
    ),
  },
  {
    id: 'speed',
    name: 'Speed Team',
    color: '#63b7ec',
    description: 'Fast pressure from Dino, Hare, and Mocchi with efficient defense.',
    monsterIds: ['C-006', 'C-008', 'C-009'],
    skillIds: copies(
      ['061', 3], ['062', 1], ['064', 3], ['067', 1], ['069', 2], ['071', 3], ['072', 2],
      ['085', 2], ['086', 3], ['087', 2], ['090', 3], ['093', 1], ['095', 1], ['096', 3],
      ['097', 3], ['098', 3], ['099', 1], ['100', 3], ['104', 1], ['106', 2], ['108', 2],
      ['110', 1], ['112', 2], ['113', 2],
    ),
  },
  {
    id: 'powerful',
    name: 'Powerful Team',
    color: '#ea665c',
    description: 'Heavy Golem blows, Pixie sparks, and Naga counters.',
    monsterIds: ['C-003', 'C-005', 'C-007'],
    skillIds: copies(
      ['112', 2], ['113', 2], ['110', 1], ['033', 1], ['031', 1], ['035', 2], ['036', 2],
      ['026', 3], ['029', 3], ['027', 3], ['049', 3], ['052', 3], ['053', 2], ['055', 2],
      ['056', 1], ['058', 1], ['059', 3], ['074', 3], ['075', 3], ['076', 3], ['080', 2],
      ['081', 1], ['082', 1], ['084', 2],
    ),
  },
];

export const DECK_BY_ID = Object.fromEntries(STARTER_DECKS.map((deck) => [deck.id, deck])) as Record<DeckDefinition['id'], DeckDefinition>;

export function validateDeck(deck: DeckDefinition): string[] {
  const errors: string[] = [];
  if (deck.monsterIds.length !== 3 || new Set(deck.monsterIds).size !== 3) errors.push('A deck needs exactly three uniquely named monsters.');
  if (deck.skillIds.length !== 50) errors.push('A deck needs exactly 50 skill cards.');
  const counts = new Map<string, number>();
  for (const id of deck.skillIds) {
    if (!CARD_BY_ID[id]) errors.push(`Unknown or unimplemented skill ${id}.`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of counts) if (count > 3) errors.push(`${id} has ${count} copies; the maximum is three.`);
  const owners = new Set(deck.monsterIds.map((id) => MONSTER_BY_ID[id]?.name));
  for (const id of counts.keys()) {
    const owner = CARD_BY_ID[id]?.owner;
    if (owner && owner !== 'Any' && owner !== 'Breeder' && !owners.has(owner)) errors.push(`${id} (${owner}) is incompatible with this team.`);
  }
  return [...new Set(errors)];
}
