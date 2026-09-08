import type { CardDefinition, EffectDefinition, MonsterDefinition } from './types';

const e = (...effects: EffectDefinition[]) => effects;
const card = (
  id: string,
  name: string,
  owner: CardDefinition['owner'],
  type: CardDefinition['type'],
  guts: number,
  damage: number | null,
  text = '',
  effects: EffectDefinition[] = [],
): CardDefinition => ({ id, name, owner, type, guts, damage, text, effects, set: 1, image: `/card-art/detail/${id}.webp`, implemented: true });

export const STARTER_CARDS: CardDefinition[] = [
  card('001', 'Right Claw', 'Tiger', 'POW', 0, 1, 'May be combined with Left Claw and Horn. Two cards deal 3 damage; three deal 7.', e({ kind: 'combo', group: 'tiger-claw', twoDamage: 3, threeDamage: 7 })),
  card('002', 'Left Claw', 'Tiger', 'POW', 0, 1, 'May be combined with Right Claw and Horn. Two cards deal 3 damage; three deal 7.', e({ kind: 'combo', group: 'tiger-claw', twoDamage: 3, threeDamage: 7 })),
  card('003', 'Horn', 'Tiger', 'POW', 0, 1, 'May be combined with Right Claw and Left Claw. Two cards deal 3 damage; three deal 7.', e({ kind: 'combo', group: 'tiger-claw', twoDamage: 3, threeDamage: 7 })),
  card('005', 'Stab', 'Tiger', 'POW', 3, 4),
  card('007', 'Bolt', 'Tiger', 'INT', 2, 3),
  card('011', 'Backflip', 'Tiger', 'DGE', 1, null, 'Dodge a Power or Intelligence move.', e({ kind: 'dodge', against: ['POW', 'INT'] })),
  card('012', 'Jump', 'Tiger', 'DGE', 2, null, 'Dodge a Power move. Become Air and double this monster’s Power damage until the end of its next turn.', e({ kind: 'dodge', against: ['POW'] }, { kind: 'jump' })),

  card('013', 'Scratch', 'Gali', 'POW', 1, 1),
  card('014', 'Kick', 'Gali', 'POW', 2, 2),
  card('017', 'Holy Ray', 'Gali', 'INT', 3, 2, 'This cannot be dodged.', e({ kind: 'undodgeable' })),
  card('019', 'Flame Wall', 'Gali', 'INT', 4, 2, 'Damage every opposing monster.', e({ kind: 'aoe', target: 'opponents' })),
  card('021', 'Flame', 'Gali', 'INT', 5, 8),
  card('023', 'Deflect', 'Gali', 'BLK', 3, null, 'Reflect all damage from an Intelligence move to its attacker.', e({ kind: 'reflect', against: 'INT', amount: 'all' })),
  card('024', 'Lie Down', 'Gali', 'DGE', 3, null, 'Dodge a Power or Intelligence move.', e({ kind: 'dodge', against: ['POW', 'INT'] })),

  card('037', 'Spit', 'Suezo', 'POW', 1, 2),
  card('039', 'Tail Assault', 'Suezo', 'POW', 2, 2, 'If this deals damage, the opponent loses 1 Guts.', e({ kind: 'guts-loss', amount: 1 })),
  card('040', 'Bite', 'Suezo', 'POW', 4, 6),
  card('041', 'Tongue Slap', 'Suezo', 'POW', 5, 6, 'If this deals damage, the opponent loses 3 Guts.', e({ kind: 'guts-loss', amount: 3 })),
  card('043', 'Lick', 'Suezo', 'INT', 4, 2, 'If this deals damage, the opponent loses all Guts.', e({ kind: 'guts-loss', amount: 'all' })),
  card('045', 'Scouting', 'Suezo', 'SPE', 1, null, 'Look at the opponent’s hand, then draw a card.', e({ kind: 'draw', amount: 1, revealOpponentHand: true })),
  card('048', 'Side Roll', 'Suezo', 'DGE', 1, null, 'Dodge a Power or Intelligence move with printed Guts cost 2 or more.', e({ kind: 'dodge', against: ['POW', 'INT'], minPrintedGuts: 2 })),

  card('061', 'Punch', 'Dino', 'POW', 2, 3),
  card('062', 'Charge', 'Dino', 'POW', 2, 4, 'If this is not dodged, this monster also takes 1 damage.', e({ kind: 'self-damage', amount: 1 })),
  card('064', 'Bite', 'Dino', 'POW', 4, 6),
  card('067', 'Fire Dash', 'Dino', 'POW', 6, 11, 'If this is not dodged, this monster also takes 3 damage.', e({ kind: 'self-damage', amount: 3 })),
  card('069', 'Flame', 'Dino', 'INT', 3, 4),
  card('071', 'Endure', 'Dino', 'BLK', 1, null, 'Reduce Power damage by 2.', e({ kind: 'block', against: ['POW'], reduce: 2 })),
  card('072', 'Jump Aside', 'Dino', 'DGE', 2, null, 'Dodge a Power or Intelligence move.', e({ kind: 'dodge', against: ['POW', 'INT'] })),

  card('085', 'Head Butt', 'Hare', 'POW', 1, 4, 'If this is not dodged, this monster also takes 2 damage.', e({ kind: 'self-damage', amount: 2 })),
  card('086', 'Sobat', 'Hare', 'POW', 2, 3),
  card('087', '1-2 Punch', 'Hare', 'POW', 3, 4, 'This still deals half damage when dodged.', e({ kind: 'half-on-dodge' })),
  card('090', 'Spin Fist', 'Hare', 'POW', 4, 6),
  card('093', 'Gas', 'Hare', 'INT', 3, 2, 'Damage every opposing monster.', e({ kind: 'aoe', target: 'opponents' })),
  card('095', 'Shriek', 'Hare', 'SPE', 0, null, 'The opponent discards a card from their hand.', e({ kind: 'discard-opponent', amount: 1 })),
  card('096', 'Footwork', 'Hare', 'DGE', 0, null, 'Dodge a Power or Intelligence move with printed Guts cost 2 or more.', e({ kind: 'dodge', against: ['POW', 'INT'], minPrintedGuts: 2 })),

  card('097', 'Slap', 'Mocchi', 'POW', 0, 1),
  card('098', 'Roll Attack', 'Mocchi', 'POW', 1, 2),
  card('099', 'Thrust', 'Mocchi', 'POW', 2, 2, 'This cannot be dodged.', e({ kind: 'undodgeable' })),
  card('100', 'Head Butt', 'Mocchi', 'POW', 2, 3),
  card('104', 'Petal Swirl', 'Mocchi', 'INT', 3, 2, 'Damage every opposing monster.', e({ kind: 'aoe', target: 'opponents' })),
  card('106', 'Round', 'Mocchi', 'BLK', 0, null, 'Reduce Power or Intelligence damage by 3.', e({ kind: 'block', against: ['POW', 'INT'], reduce: 3 })),
  card('108', 'Roll', 'Mocchi', 'DGE', 1, null, 'Dodge a Power or Intelligence move.', e({ kind: 'dodge', against: ['POW', 'INT'] })),

  card('026', 'Brow Hit', 'Golem', 'POW', 3, 5),
  card('027', 'Kick', 'Golem', 'POW', 4, 7),
  card('029', 'Chop', 'Golem', 'POW', 5, 8),
  card('031', 'Roller', 'Golem', 'POW', 7, 12),
  card('033', 'Quake', 'Golem', 'INT', 6, 3, 'Damage every Ground monster except this monster.', e({ kind: 'aoe', target: 'all-ground-except-self' })),
  card('035', 'Defense', 'Golem', 'BLK', 2, null, 'Reduce Power damage by 5.', e({ kind: 'block', against: ['POW'], reduce: 5 })),
  card('036', 'Protect', 'Golem', 'BLK', 1, null, 'This monster takes all damage from an attack against an ally.', e({ kind: 'redirect' })),

  card('049', 'Scratch', 'Pixie', 'POW', 0, 1),
  card('052', 'Thunder', 'Pixie', 'INT', 0, 1, 'Multiple Thunder and Bolt moves may be used in the same turn.', e({ kind: 'repeatable', group: 'pixie-spark' })),
  card('053', 'Bolt', 'Pixie', 'INT', 1, 2, 'Multiple Thunder and Bolt moves may be used in the same turn.', e({ kind: 'repeatable', group: 'pixie-spark' })),
  card('055', 'Lightning', 'Pixie', 'INT', 4, 4, 'This cannot be dodged.', e({ kind: 'undodgeable' })),
  card('056', 'Kiss', 'Pixie', 'INT', 4, 1, 'If this deals damage, the opponent loses all Guts.', e({ kind: 'guts-loss', amount: 'all' })),
  card('058', 'Recover', 'Pixie', 'SPE', 2, null, 'Heal one allied monster by 3 Life.', e({ kind: 'heal', amount: 3, target: 'ally' })),
  card('059', 'Step', 'Pixie', 'DGE', 0, null, 'Dodge a Power or Intelligence move with printed Guts cost 1 or more.', e({ kind: 'dodge', against: ['POW', 'INT'], minPrintedGuts: 1 })),

  card('074', 'Stab', 'Naga', 'POW', 2, 3),
  card('075', 'Pierce', 'Naga', 'POW', 3, 2, 'This cannot be dodged.', e({ kind: 'undodgeable' })),
  card('076', 'Thwack', 'Naga', 'POW', 3, 4),
  card('080', 'Life Steal', 'Naga', 'INT', 6, 4, 'Heal this monster by the damage dealt.', e({ kind: 'lifesteal' })),
  card('081', 'Evil Shots', 'Naga', 'INT', 6, 8, 'This still deals half damage when dodged.', e({ kind: 'half-on-dodge' })),
  card('082', 'Glare', 'Naga', 'SPE', 3, null, 'The opponent cannot use Dodge moves during this turn.', e({ kind: 'lock-dodge', duration: 'turn' })),
  card('084', 'Counter', 'Naga', 'BLK', 3, null, 'Reflect half Power damage, rounded down, to the attacker.', e({ kind: 'reflect', against: 'POW', amount: 'half' })),

  card('110', 'Will Power', 'Any', 'SPE', 1, null, 'Play with a Power or Intelligence move. Double its damage if the monster has 2 Life or less.', e({ kind: 'double-if-low-life', threshold: 2 })),
  card('112', 'Help', 'Breeder', 'POW', 1, 1, 'This cannot reduce a monster’s Life to 0.', e({ kind: 'prevent-ko' })),
  card('113', 'Mango', 'Breeder', 'SPE', 0, null, 'Heal one allied monster by 1 Life.', e({ kind: 'heal', amount: 1, target: 'ally' })),
];

export const CARD_BY_ID = Object.fromEntries(STARTER_CARDS.map((item) => [item.id, item])) as Record<string, CardDefinition>;

export const MONSTERS: MonsterDefinition[] = [
  { id: 'C-001', name: 'Tiger', attribute: 'ground', life: 6, mainBreed: 'Tiger', subBreed: 'Tiger', image: '/card-art/detail/C-001.webp', variants: ['C-001V'] },
  { id: 'C-002', name: 'Gali', attribute: 'air', life: 7, mainBreed: 'Gali', subBreed: 'Gali', image: '/card-art/detail/C-002.webp', variants: [] },
  { id: 'C-004', name: 'Suezo', attribute: 'ground', life: 7, mainBreed: 'Suezo', subBreed: 'Suezo', image: '/card-art/detail/C-004.webp', variants: ['C-004V'] },
  { id: 'C-006', name: 'Dino', attribute: 'ground', life: 8, mainBreed: 'Dino', subBreed: 'Dino', image: '/card-art/detail/C-006.webp', variants: [] },
  { id: 'C-008', name: 'Hare', attribute: 'ground', life: 6, mainBreed: 'Hare', subBreed: 'Hare', image: '/card-art/detail/C-008.webp', variants: ['C-008V'] },
  { id: 'C-009', name: 'Mocchi', attribute: 'ground', life: 7, mainBreed: 'Mocchi', subBreed: 'Mocchi', image: '/card-art/detail/C-009.webp', variants: ['C-009V'] },
  { id: 'C-003', name: 'Golem', attribute: 'ground', life: 9, mainBreed: 'Golem', subBreed: 'Golem', image: '/card-art/detail/C-003.webp', variants: ['C-003V'] },
  { id: 'C-005', name: 'Pixie', attribute: 'air', life: 6, mainBreed: 'Pixie', subBreed: 'Pixie', image: '/card-art/detail/C-005.webp', variants: ['C-005V'] },
  { id: 'C-007', name: 'Naga', attribute: 'ground', life: 8, mainBreed: 'Naga', subBreed: 'Naga', image: '/card-art/detail/C-007.webp', variants: [] },
];

export const MONSTER_BY_ID = Object.fromEntries(MONSTERS.map((item) => [item.id, item])) as Record<string, MonsterDefinition>;
