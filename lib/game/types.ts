export const CONTENT_VERSION = 'starter-v1' as const;

export type PlayerIndex = 0 | 1;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Attribute = 'ground' | 'air' | 'water';
export type SkillType = 'POW' | 'INT' | 'SPE' | 'DGE' | 'BLK';
export type CardOwner =
  | 'Tiger' | 'Gali' | 'Suezo' | 'Dino' | 'Hare' | 'Mocchi'
  | 'Golem' | 'Pixie' | 'Naga' | 'Any' | 'Breeder';

export type EffectDefinition =
  | { kind: 'combo'; group: 'tiger-claw'; twoDamage: 3; threeDamage: 7 }
  | { kind: 'undodgeable' }
  | { kind: 'aoe'; target: 'opponents' | 'all-ground-except-self' }
  | { kind: 'self-damage'; amount: number }
  | { kind: 'guts-loss'; amount: number | 'all' }
  | { kind: 'half-on-dodge' }
  | { kind: 'lifesteal' }
  | { kind: 'dodge'; against: Array<'POW' | 'INT'>; minPrintedGuts?: number }
  | { kind: 'block'; against: Array<'POW' | 'INT'>; reduce: number }
  | { kind: 'reflect'; against: 'POW' | 'INT'; amount: 'all' | 'half' }
  | { kind: 'redirect' }
  | { kind: 'jump' }
  | { kind: 'draw'; amount: number; revealOpponentHand?: boolean }
  | { kind: 'discard-opponent'; amount: number }
  | { kind: 'heal'; amount: number; target: 'ally' }
  | { kind: 'double-if-low-life'; threshold: number }
  | { kind: 'lock-dodge'; duration: 'turn' }
  | { kind: 'prevent-ko' }
  | { kind: 'repeatable'; group: 'pixie-spark' };

export interface CardDefinition {
  id: string;
  name: string;
  owner: CardOwner;
  type: SkillType;
  guts: number;
  damage: number | null;
  text: string;
  effects: EffectDefinition[];
  set: 1;
  image: string;
  implemented: true;
}

export interface MonsterDefinition {
  id: string;
  name: Exclude<CardOwner, 'Any' | 'Breeder'>;
  attribute: Attribute;
  life: number;
  mainBreed: string;
  subBreed: string;
  image: string;
  variants: string[];
}

export interface DeckDefinition {
  id: 'miracle' | 'speed' | 'powerful';
  name: string;
  color: string;
  description: string;
  monsterIds: [string, string, string];
  skillIds: string[];
}

export interface CardInstance { instanceId: string; cardId: string }
export interface StatusEffect { kind: 'jump'; appliedTurn: number; expiresTurn: number }
export interface MonsterState {
  definitionId: string;
  life: number;
  attribute: Attribute;
  attacked: boolean;
  repeatableGroup: 'pixie-spark' | null;
  statuses: StatusEffect[];
}

export interface PlayerState {
  deckId: DeckDefinition['id'];
  drawPile: CardInstance[];
  hand: CardInstance[];
  guts: CardInstance[];
  discard: CardInstance[];
  monsters: MonsterState[];
  breederCardPlayed: boolean;
  dodgeLocked: boolean;
  setupGuts: number;
}

export interface TargetRef { player: PlayerIndex; monster: number }
export interface PendingAttack {
  sourcePlayer: PlayerIndex;
  attackerMonster: number | null;
  attackCards: CardInstance[];
  modifierCards: CardInstance[];
  defenseCards: CardInstance[];
  type: 'POW' | 'INT';
  printedGuts: number;
  targets: TargetRef[];
  targetCursor: number;
  baseDamage: number;
  workingDamage: number;
  undodgeable: boolean;
  halfOnDodge: boolean;
  selfDamage: number;
  preventKo: boolean;
  hitAny: boolean;
  totalDamage: number;
  reflectedDamage: number;
  gutsLoss: number | 'all' | null;
  lifesteal: boolean;
}

export type GamePhase = 'setup-guts' | 'attack' | 'defense' | 'guts' | 'gameover';
export interface GameEvent {
  id: number;
  turn: number;
  kind: 'system' | 'draw' | 'play' | 'damage' | 'defense' | 'guts' | 'victory';
  message: string;
}

export interface GameState {
  contentVersion: typeof CONTENT_VERSION;
  seed: number;
  rngState: number;
  difficulty: Difficulty;
  turn: number;
  activePlayer: PlayerIndex;
  startingPlayer: PlayerIndex;
  phase: GamePhase;
  players: [PlayerState, PlayerState];
  pendingAttack: PendingAttack | null;
  winner: PlayerIndex | null;
  eventSequence: number;
  events: GameEvent[];
  selectedSetupCards: string[];
}

export type GameCommand =
  | { type: 'setup-toggle-guts'; instanceId: string }
  | { type: 'finish-setup' }
  | { type: 'play-action'; actionId: string }
  | { type: 'play-defense'; instanceId: string; monster: number }
  | { type: 'pass-defense' }
  | { type: 'finish-attacking' }
  | { type: 'convert-guts'; instanceId: string }
  | { type: 'finish-turn' };

export interface LegalAction {
  id: string;
  kind: 'attack' | 'special';
  label: string;
  detail: string;
  cardInstanceIds: string[];
  modifierInstanceIds: string[];
  attackerMonster: number | null;
  target: TargetRef | null;
  scoreHint: number;
}

export interface LegalDefense {
  instanceId: string;
  monster: number;
  label: string;
  detail: string;
  scoreHint: number;
}

export interface PlayerObservation {
  perspective: PlayerIndex;
  turn: number;
  phase: GamePhase;
  self: PlayerState;
  opponent: Omit<PlayerState, 'hand' | 'drawPile' | 'guts'> & {
    handCount: number;
    drawCount: number;
    gutsCount: number;
  };
  pendingAttack: PendingAttack | null;
}

export interface SavedMatch {
  id: 'current';
  contentVersion: typeof CONTENT_VERSION;
  updatedAt: string;
  state: GameState;
}

export interface SavedReplay {
  id: string;
  contentVersion: typeof CONTENT_VERSION;
  createdAt: string;
  playerDeck: DeckDefinition['id'];
  aiDeck: DeckDefinition['id'];
  difficulty: Difficulty;
  winner: PlayerIndex;
  seed: number;
  events: GameEvent[];
}
