import catalog from './catalog.generated.json';
import type {
  Attribute,
  CardDefinition,
  ExceptionalHandler,
  MonsterDefinition,
} from './types';

export const CATALOG_SOURCE_REVISION = catalog.sourceRevision;

const registeredHandlers = new Set<ExceptionalHandler>([
  'fusion',
  'cocoon',
  'emerge',
  'take-over',
  'resurrection',
  'riddler',
  'shadow-bind',
]);

export const ALL_CARDS = catalog.skills as unknown as CardDefinition[];
export const CARD_BY_ID = Object.fromEntries(
  ALL_CARDS.map((card) => [card.id, card]),
) as Record<string, CardDefinition>;

const starterIds = new Set([
  '001', '002', '003', '005', '007', '011', '012',
  '013', '014', '017', '019', '021', '023', '024',
  '037', '039', '040', '041', '043', '045', '048',
  '061', '062', '064', '067', '069', '071', '072',
  '085', '086', '087', '090', '093', '095', '096',
  '097', '098', '099', '100', '104', '106', '108',
  '026', '027', '029', '031', '033', '035', '036',
  '049', '052', '053', '055', '056', '058', '059',
  '074', '075', '076', '080', '081', '082', '084',
  '110', '112', '113',
]);
export const STARTER_CARDS = ALL_CARDS.filter((card) => starterIds.has(card.id));

type GeneratedMonster = Omit<MonsterDefinition, 'selectedPrintId'>;
const generatedMonsters = catalog.monsters as unknown as GeneratedMonster[];

function selectedMonster(
  monster: GeneratedMonster,
  printId: string,
  attribute?: Attribute,
): MonsterDefinition {
  return {
    ...monster,
    selectedPrintId: printId,
    attribute: attribute ?? monster.attribute,
    image: `/card-art/detail/${printId}.webp`,
  };
}

export const MONSTERS: MonsterDefinition[] = generatedMonsters.map((monster) =>
  selectedMonster(monster, monster.defaultPrintId),
);

export const MONSTER_BY_ID: Record<string, MonsterDefinition> = {};
for (const monster of generatedMonsters) {
  const defaultMonster = selectedMonster(monster, monster.defaultPrintId);
  MONSTER_BY_ID[monster.logicalId] = defaultMonster;
  for (const printId of monster.prints) {
    const rulePrint = monster.rulesPrints.find(
      (candidate) =>
        candidate.printId === printId ||
        (candidate.printId === 'C-031R' && printId === 'C-031RS'),
    );
    MONSTER_BY_ID[printId] = selectedMonster(
      monster,
      printId,
      rulePrint?.attributeOverride,
    );
  }
}

export function getMonsterDefinition(id: string): MonsterDefinition | undefined {
  return MONSTER_BY_ID[id];
}

export function validateCatalog(): string[] {
  const errors: string[] = [];
  if (ALL_CARDS.length !== 366) errors.push(`Expected 366 skills; found ${ALL_CARDS.length}.`);
  if (new Set(ALL_CARDS.map((card) => card.id)).size !== 366)
    errors.push('Skill IDs are not unique.');
  for (let number = 1; number <= 366; number += 1) {
    const id = String(number).padStart(3, '0');
    const card = CARD_BY_ID[id];
    if (!card) errors.push(`Missing skill ${id}.`);
    else if (
      card.implementation === 'handler' &&
      (!card.handler || !registeredHandlers.has(card.handler))
    )
      errors.push(`${id} references an unregistered handler.`);
  }
  if (MONSTERS.length !== 65) errors.push(`Expected 65 monsters; found ${MONSTERS.length}.`);
  if (MONSTERS.reduce((count, monster) => count + monster.prints.length, 0) !== 89)
    errors.push('Expected 89 mapped monster prints.');
  if (CARD_BY_ID['318']?.image !== '/card-art/detail/318.webp')
    errors.push('Card 318 must use its corrected face.');
  if (MONSTER_BY_ID['C-044']?.selectedPrintId !== 'C-044V')
    errors.push('Gray Wolf must use C-044V by default.');
  return errors;
}

const catalogErrors = validateCatalog();
if (catalogErrors.length)
  throw new Error(`Invalid full card catalog:\n${catalogErrors.join('\n')}`);
