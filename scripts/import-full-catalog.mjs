import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error('Usage: node scripts/import-full-catalog.mjs <saved LegendCup HTML>');
}

const root = process.cwd();
const html = await readFile(path.resolve(sourcePath), 'utf8');
const cardsDirectory = path.resolve(root, '../cards');
const localFiles = (await readdir(cardsDirectory)).filter((name) => name.endsWith('.png'));

const dataStart = html.indexOf('let data = [');
const dataEnd = html.indexOf('];', dataStart);
if (dataStart < 0 || dataEnd < 0) throw new Error('Could not locate the card database array.');
const arraySource = html.slice(html.indexOf('[', dataStart), dataEnd + 1);
const sourceSkills = vm.runInNewContext(`(${arraySource})`);

const monsterTable = html.match(/<table[^>]+id="moncards"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1];
if (!monsterTable) throw new Error('Could not locate the monster database table.');
const decode = (value) => value
  .replace(/&amp;/g, '&')
  .replace(/&#039;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .trim();
const sourceMonsters = [...monsterTable.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((row) =>
  [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cell) => decode(cell[1].replace(/<[^>]*>/g, ''))),
).filter((row) => row.length === 8);

const setOne = new Set(['Tiger', 'Gali', 'Golem', 'Suezo', 'Pixie', 'Dino', 'Naga', 'Hare', 'Mocchi', 'Phoenix']);
const setTwo = new Set(['Monol', 'Ghost', 'Henger', 'Plant', 'Dragon']);
const setThree = new Set(['Jell', 'Mew', 'Worm', 'Durahan', 'Zilla']);
const breedSet = (owner, id) => {
  const number = Number(id);
  if (number >= 285 || number >= 357) return 4;
  if (setOne.has(owner) || number <= 140) return 1;
  if (setTwo.has(owner) || (number >= 249 && number <= 260)) return 2;
  if (setThree.has(owner) || (number >= 273 && number <= 284)) return 3;
  return 4;
};

const cleanText = (text) => text === '-' ? '' : text
  .replace(/[’]/g, "'")
  .replace(/\bDOULE\b/g, 'DOUBLE')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^./, (letter) => letter.toUpperCase())
  .toLowerCase()
  .replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());

const specialHandlers = new Map([
  ['128', 'resurrection'],
  ['149', 'riddler'],
  ['174', 'take-over'],
  ['221', 'cocoon'],
  ['222', 'emerge'],
  ['352', 'fusion'],
  ['366', 'shadow-bind'],
]);

function effectsFor(row) {
  const raw = row.carddesc === '-' ? '' : row.carddesc.replace(/[’]/g, "'");
  const text = raw.toUpperCase();
  const effects = [];
  const add = (effect) => effects.push(effect);

  if (row.cardtype === 'DGE') {
    const against = text.includes('POWER OR AN INTELLIGENCE') ? ['POW', 'INT'] : text.includes('INTELLIGENCE') ? ['INT'] : ['POW'];
    const minimum = text.match(/WITH (\d+) OR MORE GUTS/);
    add({ kind: 'dodge', against, ...(minimum ? { minPrintedGuts: Number(minimum[1]) } : {}) });
  }
  if (row.cardtype === 'BLK') {
    const against = text.includes('POWER OR AN INTELLIGENCE') ? ['POW', 'INT'] : text.includes('INTELLIGENCE') ? ['INT'] : ['POW'];
    const reduce = text.match(/BY (\d+)/);
    if (text.includes('REFLECT HALF')) add({ kind: 'reflect', against: against[0], amount: 'half' });
    else if (text.includes('REFLECT THE DAMAGE')) add({ kind: 'reflect', against: against[0], amount: 'all' });
    else if (text.includes('TAKES ALL DAMAGE') || text.includes('MAKE ANOTHER MONSTER')) add({ kind: 'redirect' });
    else if (text.includes('BY HALF')) add({ kind: 'block-half', against });
    else add({ kind: 'block', against, reduce: text.includes('TO 0') ? 99 : Number(reduce?.[1] ?? 0) });
  }
  if (text.includes('CANNOT BE DODGED')) add({ kind: 'undodgeable' });
  if (text.includes('CANNOT BE BLOCKED OR DODGED')) {
    add({ kind: 'undodgeable' });
    add({ kind: 'unblockable' });
  }
  if (text.includes('DAMAGE CANNOT BE REDUCED BY BLOCK') || text.includes('DAMAGE CANNOT BE REDUCED BY BLOCK')) add({ kind: 'unblockable' });
  if (text.includes('STILL DEALS HALF DAMAGE IF DODGED')) add({ kind: 'half-on-dodge' });
  if (text.includes("ALL OPPONENT'S MONSTERS") || text.includes('ALL OPPONENT’S MONSTERS')) add({ kind: 'aoe', target: 'opponents' });
  else if (text.includes("ALL OPPONENT'S AIR MONSTERS")) add({ kind: 'aoe', target: 'opponent-air' });
  else if (text.includes("ALL OPPONENT'S GROUND MONSTERS")) add({ kind: 'aoe', target: 'opponent-ground' });
  else if (text.includes('ALL GROUND MONSTERS EXCEPT THIS MONSTER')) add({ kind: 'aoe', target: 'all-ground-except-self' });
  else if (text.includes('ALL MONSTERS EXCEPT THIS MONSTER')) add({ kind: 'aoe', target: 'all-except-self' });
  if (text.includes('DAMAGE CAN BE DISTRIBUTED')) add({ kind: 'distributed' });
  const selfDamage = text.match(/THIS MONSTER (?:ALSO )?TAKES (\d+) DAMAGE/);
  if (selfDamage) add({ kind: 'self-damage', amount: Number(selfDamage[1]), timing: text.includes('IF THIS IS DODGED') ? 'dodged' : text.includes('IF THIS IS NOT DODGED') ? 'hit' : 'always' });
  const gutsLoss = text.match(/OPPONENT LOSES (\d+) GUTS/);
  if (gutsLoss) add({ kind: 'guts-loss', amount: Number(gutsLoss[1]) });
  if (text.includes('OPPONENT LOSES ALL GUTS')) add({ kind: 'guts-loss', amount: 'all' });
  if (text.includes('LIFE POINTS BY THE AMOUNT OF DAMAGE DEALT')) add({ kind: 'lifesteal' });
  const heal = text.match(/HEAL ONE OF YOUR MONSTER'S LIFE POINTS BY (\d+)/);
  if (heal) add({ kind: 'heal', amount: Number(heal[1]), target: 'ally' });
  if (text.includes('DRAW A CARD')) add({ kind: 'draw', amount: 1, revealOpponentHand: text.includes("LOOK AT YOUR OPPONENT'S HAND") });
  const drawMany = text.match(/DRAW (\d+) CARDS/);
  if (drawMany) add({ kind: 'draw', amount: Number(drawMany[1]) });
  if (text.includes("OPPONENT DISCARDS A CARD FROM THEIR HAND") || text.includes("YOUR OPPONENT DISCARDS A CARD FROM THEIR HAND")) add({ kind: 'discard-opponent', amount: 1 });
  if (text.includes('CANNOT ATTACK NEXT TURN')) add({ kind: 'attack-lock', target: text.startsWith('ALL OPPONENT') ? 'opponents' : 'damaged', duration: 'next-turn' });
  if (text.includes('CAN ONLY USE DAMAGING MOVES IF THEY WOULD AFFECT THIS MONSTER')) add({ kind: 'taunt', duration: 'next-turn' });
  if (text.includes('CANNOT USE DODGE MOVES')) add({ kind: 'lock-defense', defense: 'DGE', duration: text.includes('NEXT TURN') ? 'next-turn' : 'turn' });
  if (text.includes('CANNOT USE BLOCK MOVES')) add({ kind: 'lock-defense', defense: 'BLK', duration: 'turn' });
  if (text.includes('DEALS DOUBLE DAMAGE TO AIR')) add({ kind: 'attribute-damage', attribute: 'air', multiplier: 2 });
  if (text.includes('DEALS DOUBLE DAMAGE TO GROUND')) add({ kind: 'attribute-damage', attribute: 'ground', multiplier: 2 });
  if (text.includes('CAN ONLY DAMAGE GROUND') || text.includes('CANNOT DAMAGE AIR')) add({ kind: 'target-restriction', attribute: 'ground' });
  if (text.includes('RETURN IT TO YOUR HAND')) add({ kind: 'return-to-hand' });
  if (text.includes('CANNOT REDUCE A MONSTER')) add({ kind: 'prevent-ko' });
  if (text.includes('MULTIPLE ') && text.includes('CAN BE USED DURING THE SAME TURN'))
    add({ kind: 'repeatable', group: ['052', '053'].includes(row.cardno) ? 'pixie-spark' : `card-${row.cardno}` });
  if (['001', '002', '003'].includes(row.cardno)) add({ kind: 'combo', group: 'tiger-claw', twoDamage: 3, threeDamage: 7 });
  if (['285', '286'].includes(row.cardno)) add({ kind: 'pair-combo', cardIds: ['285', '286'], damage: 4 });
  if (row.cardno === '178') add({ kind: 'pair-combo', cardIds: ['178', '178'], damage: 10 });
  if (row.cardno === '214') add({ kind: 'pair-combo', cardIds: ['214', '214'], damage: 12 });
  if (row.cardtype === 'SPE' && text.includes('INCREASE ITS DAMAGE BY 2')) add({ kind: 'attack-modifier', operation: 'add', amount: 2 });
  if (row.cardtype === 'SPE' && (text.includes('DEALS DOUBLE DAMAGE') || text.includes('IT DEALS DOUBLE DAMAGE'))) add({ kind: 'attack-modifier', operation: 'multiply', amount: 2, condition: text.includes('2 OR LESS LIFE') ? 'low-life' : text.includes('PURE-BREED') ? 'pure' : 'always' });
  if (row.cardtype === 'SPE' && text.includes('DEALS TRIPLE DAMAGE')) add({ kind: 'attack-modifier', operation: 'multiply', amount: 3, condition: text.includes('NO CARDS LEFT') ? 'deck-empty' : 'always' });
  if (
    row.cardtype === 'SPE' &&
    /^(PLAY|USE) (THIS )?(WITH|AGAINST) (A |ONE OF YOUR )?(POWER|INTELLIGENCE|POWER OR AN INTELLIGENCE)/.test(text) &&
    !effects.some((effect) => effect.kind === 'attack-modifier')
  ) add({ kind: 'attack-modifier', operation: 'add', amount: 0, condition: 'always' });
  const discount = text.match(/SPEND (\d+) LESS GUTS/);
  if (discount) add({ kind: 'cost-modifier', amount: -Number(discount[1]) });
  const surcharge = text.match(/SPEND (\d+) MORE GUTS/);
  if (surcharge) add({ kind: 'cost-modifier', amount: Number(surcharge[1]) });
  const finalDamage = text.match(/(INCREASE|DECREASE) THE FINAL DAMAGE OF (POWER AND INTELLIGENCE|POWER|INTELLIGENCE) MOVES BY (\d+)/);
  if (finalDamage) add({
    kind: 'environment-damage',
    types: finalDamage[2] === 'POWER AND INTELLIGENCE' ? ['POW', 'INT'] : [finalDamage[2] === 'POWER' ? 'POW' : 'INT'],
    amount: Number(finalDamage[3]) * (finalDamage[1] === 'DECREASE' ? -1 : 1),
  });
  if (row.cardtype === 'ENV') add({ kind: 'environment', code: `environment-${row.cardno}` });
  if (text.includes("ATTRIBUTE BECOMES AIR") || text.includes("ATTRIBUTES BECOME AIR")) add({ kind: 'attribute-change', attribute: 'air', target: text.includes('ALL MONSTERS') ? 'all' : 'self', duration: text.includes('UNTIL THIS CARD IS REMOVED') ? 'environment' : 'next-turn' });
  if (['012', '060', '236'].includes(row.cardno)) add({ kind: 'jump' });
  if (text.includes("ATTRIBUTES BECOME GROUND")) add({ kind: 'attribute-change', attribute: 'ground', target: 'all', duration: 'environment' });
  if (text.includes("ATTRIBUTES BECOME WATER")) add({ kind: 'attribute-change', attribute: 'water', target: 'all-allies', duration: 'next-turn' });
  if (text.includes('WILL NOT RECEIVE ANY DAMAGE')) add({ kind: 'damage-immunity', duration: 'next-turn' });
  if (text.includes('CHOOSE A CARD FROM YOUR DISCARD')) add({ kind: 'retrieve', destination: text.includes('BOTTOM OF YOUR DECK') ? 'deck-bottom' : 'hand' });
  if (text.includes('SKIPS THEIR NEXT TURN')) add({ kind: 'skip-turn' });

  const handler = specialHandlers.get(row.cardno);
  if (!raw) return { implementation: 'dsl', effects };
  if (handler) return { implementation: 'handler', handler, effects };
  if (!effects.length) add({ kind: 'rule', code: `card-${row.cardno}`, trigger: row.cardtype === 'ENV' ? 'environment' : 'play' });
  return { implementation: 'dsl', effects };
}

const visualFor = (row) => {
  const words = `${row.cardname} ${row.carddesc}`.toLowerCase();
  if (/heal|recover|mango|resurrect|revive/.test(words)) return { kind: 'heal', color: '#70efad', intensity: 2, shake: 0 };
  if (/reflect|counter|bounce/.test(words)) return { kind: 'reflect', color: '#d990ff', intensity: 3, shake: 1 };
  if (row.cardtype === 'DGE' || row.cardtype === 'BLK') return { kind: 'shield', color: '#6be0ff', intensity: 2, shake: 0 };
  if (/bite|fang|claw/.test(words)) return { kind: 'fang', color: '#ff8a59', intensity: 2, shake: 1 };
  if (/slash|cut|blade|pierce|stab|thrust|scythe/.test(words)) return { kind: 'slash', color: '#ff605a', intensity: 2, shake: 1 };
  if (/shot|beam|ray|throw|gun|cannon/.test(words)) return { kind: 'projectile', color: '#ffd85c', intensity: 2, shake: 1 };
  if (row.cardtype === 'INT') return { kind: 'energy', color: '#68d9ff', intensity: Number(row.carddmg) >= 5 ? 3 : 2, shake: Number(row.carddmg) >= 5 ? 2 : 1 };
  if (row.cardtype === 'SPE' || row.cardtype === 'ENV') return { kind: 'status', color: '#d2a3ff', intensity: 1, shake: 0 };
  return { kind: 'impact', color: '#ff744f', intensity: Number(row.carddmg) >= 5 ? 3 : 2, shake: Number(row.carddmg) >= 5 ? 2 : 1 };
};

const skills = sourceSkills
  .map((row) => {
    const owner = row.cardcategory === 'Any Monster Cards' ? 'Any' : row.cardcategory === 'Breeder Cards' ? 'Breeder' : row.cardcategory;
    const implementation = effectsFor(row);
    return {
      id: row.cardno,
      name: row.cardname,
      owner,
      type: row.cardtype,
      damage: row.carddmg === '-' ? null : Number(row.carddmg),
      guts: Number(row.cardguts),
      text: cleanText(row.carddesc),
      set: breedSet(owner, row.cardno),
      image: `/card-art/detail/${row.cardno}.webp`,
      ...implementation,
      visual: visualFor(row),
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const printNamesFor = (id) => localFiles
  .filter((file) => file.startsWith(id) && /^C-\d{3}[A-Z]*\.png$/.test(file))
  .map((file) => file.replace('.png', ''))
  .sort();
const monstersById = new Map();
for (const [id, , name, attribute, life, breedType, mainBreed, subBreed] of sourceMonsters) {
  const existing = monstersById.get(id);
  const attributeId = attribute === 'Aerial' ? 'air' : attribute === 'Underwater' ? 'water' : 'ground';
  if (existing && id === 'C-031') {
    existing.rulesPrints.push({ printId: 'C-031R', attributeOverride: attributeId });
    continue;
  }
  const prints = printNamesFor(id);
  const defaultPrintId = id === 'C-044' ? 'C-044V' : id;
  monstersById.set(id, {
    id,
    logicalId: id,
    name,
    attribute: attributeId,
    life: Number(life),
    breedType: breedType.toLowerCase(),
    mainBreed,
    subBreed,
    defaultPrintId,
    image: `/card-art/detail/${defaultPrintId}.webp`,
    variants: prints.filter((printId) => printId !== defaultPrintId),
    prints,
    rulesPrints: [{ printId: id, attributeOverride: attributeId }],
  });
}
const monsters = [...monstersById.values()].sort((a, b) => a.id.localeCompare(b.id));

if (skills.length !== 366 || new Set(skills.map((card) => card.id)).size !== 366) throw new Error(`Expected 366 unique skills, found ${skills.length}.`);
if (monsters.length !== 65) throw new Error(`Expected 65 logical monsters, found ${monsters.length}.`);
if (!skills.find((card) => card.id === '318') || skills.find((card) => card.id === '318')?.image.includes('misprint')) throw new Error('Corrected card 318 mapping is invalid.');
if (monsters.reduce((count, monster) => count + monster.prints.length, 0) !== 89) throw new Error('Expected 89 mapped monster images.');

await writeFile(path.resolve(root, 'lib/game/catalog.generated.json'), JSON.stringify({
  contentVersion: 'full-pool-v1',
  sourceRevision: 'LegendCup 2026-09-06 / local card archive 2026-07-18',
  skills,
  monsters,
}, null, 2));

console.log(`Generated ${skills.length} skills and ${monsters.length} logical monsters (${monsters.reduce((count, monster) => count + monster.prints.length, 0)} prints).`);
