export const CONTENT_VERSION = 'full-pool-v1' as const;

export type PlayerIndex = 0 | 1;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Attribute = 'ground' | 'air' | 'water';
export type SkillType = 'POW' | 'INT' | 'SPE' | 'DGE' | 'BLK' | 'ENV';
export type BreedId =
  | 'Tiger'
  | 'Gali'
  | 'Golem'
  | 'Suezo'
  | 'Pixie'
  | 'Dino'
  | 'Naga'
  | 'Hare'
  | 'Mocchi'
  | 'Phoenix'
  | 'Jell'
  | 'Monol'
  | 'Ghost'
  | 'Henger'
  | 'Mew'
  | 'Plant'
  | 'Worm'
  | 'Dragon'
  | 'Durahan'
  | 'Zilla'
  | 'Metalner'
  | 'Joker'
  | 'Arrow Head'
  | 'Centaur'
  | 'Color Pandora';
export type CardOwner = BreedId
  | 'Any'
  | 'Breeder';

export type ExceptionalHandler =
  | 'fusion'
  | 'cocoon'
  | 'emerge'
  | 'take-over'
  | 'resurrection'
  | 'riddler'
  | 'shadow-bind';

export type EffectDefinition =
  | { kind: 'combo'; group: 'tiger-claw'; twoDamage: 3; threeDamage: 7 }
  | { kind: 'undodgeable' }
  | { kind: 'aoe'; target: 'opponents' | 'opponent-air' | 'opponent-ground' | 'all-ground-except-self' | 'all-except-self' }
  | { kind: 'self-damage'; amount: number; timing?: 'hit' | 'dodged' | 'always' }
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
  | { kind: 'repeatable'; group: string }
  | { kind: 'pair-combo'; cardIds: string[]; damage: number }
  | { kind: 'unblockable' }
  | { kind: 'block-half'; against: Array<'POW' | 'INT'> }
  | { kind: 'distributed' }
  | { kind: 'attack-lock'; target: 'damaged' | 'opponents'; duration: 'next-turn' }
  | { kind: 'taunt'; duration: 'next-turn' }
  | { kind: 'lock-defense'; defense: 'DGE' | 'BLK'; duration: 'turn' | 'next-turn' }
  | { kind: 'attribute-damage'; attribute: Attribute; multiplier: number }
  | { kind: 'target-restriction'; attribute: Attribute }
  | { kind: 'return-to-hand' }
  | { kind: 'attack-modifier'; operation: 'add' | 'multiply'; amount: number; condition?: 'always' | 'low-life' | 'pure' | 'deck-empty' }
  | { kind: 'cost-modifier'; amount: number }
  | { kind: 'environment'; code: string }
  | { kind: 'environment-damage'; types: Array<'POW' | 'INT'>; amount: number }
  | { kind: 'attribute-change'; attribute: Attribute; target: 'self' | 'all' | 'all-allies'; duration: 'turn' | 'next-turn' | 'environment' }
  | { kind: 'damage-immunity'; duration: 'next-turn' }
  | { kind: 'retrieve'; destination: 'hand' | 'deck-bottom' }
  | { kind: 'skip-turn' }
  | { kind: 'rule'; code: string; trigger: 'play' | 'environment' };

export interface CardDefinition {
  id: string;
  name: string;
  owner: CardOwner;
  type: SkillType;
  guts: number;
  damage: number | null;
  text: string;
  effects: EffectDefinition[];
  set: 1 | 2 | 3 | 4;
  image: string;
  implementation: 'dsl' | 'handler';
  handler?: ExceptionalHandler;
  visual: VisualEffectProfile;
}

export interface MonsterDefinition {
  id: string;
  logicalId: string;
  selectedPrintId: string;
  defaultPrintId: string;
  name: string;
  attribute: Attribute;
  life: number;
  breedType: 'pure' | 'mixed';
  mainBreed: BreedId;
  subBreed: BreedId | '???';
  image: string;
  variants: string[];
  prints: string[];
  rulesPrints: Array<{ printId: string; attributeOverride: Attribute }>;
}

export interface DeckDefinition {
  id: string;
  source?: 'starter' | 'npc' | 'custom' | 'random';
  name: string;
  color: string;
  description: string;
  monsterIds: [string, string, string];
  skillIds: string[];
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
}
export interface StatusEffect {
  kind: 'jump' | 'temporary-attribute' | 'cannot-attack' | 'damage-immunity' | 'attack-protection' | 'negate-guts-loss' | 'anger' | 'taunt' | 'cocoon';
  appliedTurn: number;
  expiresTurn: number;
  attribute?: Attribute;
}
export interface MonsterState {
  definitionId: string;
  life: number;
  attribute: Attribute;
  attacked: boolean;
  repeatableGroup: string | null;
  statuses: StatusEffect[];
}

export interface PlayerState {
  deckId: string;
  drawPile: CardInstance[];
  hand: CardInstance[];
  guts: CardInstance[];
  discard: CardInstance[];
  monsters: MonsterState[];
  breederCardPlayed: boolean;
  dodgeLocked: boolean;
  blockLocked: boolean;
  skipNextTurn: boolean;
  setupGuts: number;
  gutsConvertedThisTurn: number;
  permissions: {
    extraBreeders: boolean;
    unlimitedAttacks: boolean;
    freeSpecials: boolean;
  };
}

export interface TargetRef {
  player: PlayerIndex;
  monster: number;
}
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
  unblockable: boolean;
  returnToHand: boolean;
  locksDamagedMonster: boolean;
}

export type GamePhase =
  | 'setup-guts'
  | 'attack'
  | 'defense'
  | 'guts'
  | 'gameover';
export interface GameEvent {
  id: number;
  turn: number;
  kind: 'system' | 'draw' | 'play' | 'damage' | 'defense' | 'guts' | 'victory';
  message: string;
  data?: {
    actor?: PlayerIndex;
    cardIds?: string[];
    sourceMonster?: number | null;
    target?: TargetRef;
    targets?: TargetRef[];
    amount?: number;
    beforeLife?: number;
    afterLife?: number;
    attackType?: 'POW' | 'INT';
    role?: 'attack' | 'special' | 'defense' | 'draw' | 'guts' | 'result';
  };
}

export interface DuelContext {
  mode: 'quick' | 'campaign';
  npcId?: string;
  returnPath?: string;
  areaId?: WorldAreaId;
}

export interface GameSetup {
  playerDeckId: string;
  opponentDeckId?: string;
  playerDeck?: DeckDefinition;
  opponentDeck?: DeckDefinition;
  difficulty: Difficulty;
  seed?: number;
  duelContext?: DuelContext;
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
  environment: { card: CardInstance; owner: PlayerIndex } | null;
  revealedInformation: string[];
  transformationHistory: Array<{ turn: number; player: PlayerIndex; monster: number; from: string; to: string }>;
  duelContext?: DuelContext;
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
  estimatedDamage?: number;
  sacrificedMonsters?: number[];
  replacementMonsterId?: string;
  retrievedInstanceId?: string;
  discardedInstanceIds?: string[];
  namedDefense?: string;
}

export interface LegalDefense {
  instanceId: string;
  monster: number;
  label: string;
  detail: string;
  scoreHint: number;
}

export interface CardActionIntent {
  sourceInstanceId: string;
  candidateActionIds: string[];
  chainInstanceIds: string[];
  targets: TargetRef[];
}

export interface TargetIntent {
  target: TargetRef;
  actionIds: string[];
  tone: 'attack' | 'heal' | 'defense';
}

export type PresentationPhase =
  | 'setup'
  | 'draw'
  | 'attack'
  | 'defense'
  | 'guts'
  | 'result';
export interface BattlePresentationCue {
  id: string;
  phase: PresentationPhase;
  owner: PlayerIndex;
  title: string;
  eventId?: number;
}

export type VisualEffectKind =
  | 'slash'
  | 'fang'
  | 'impact'
  | 'projectile'
  | 'energy'
  | 'shield'
  | 'redirect'
  | 'reflect'
  | 'heal'
  | 'status'
  | 'guts';
export interface VisualEffectProfile {
  kind: VisualEffectKind;
  color: string;
  intensity: 1 | 2 | 3;
  shake: 0 | 1 | 2;
}

export type OutfitPalette = 'azure' | 'vermilion' | 'moss' | 'gold';
export type WorldAreaId = 'ranch' | 'festival';
export interface PresentationSettings {
  speed: 1 | 1.5 | 2;
  reducedMotion: boolean;
  cameraMotion: boolean;
  particleDensity: 'low' | 'high';
  effectsMuted: boolean;
}

export interface NpcDefinition {
  id: string;
  name: string;
  title: string;
  areaId: WorldAreaId;
  deckId: string;
  difficulty: Difficulty;
  portrait: string;
  position: [number, number, number];
  greeting: string;
  rematch: string;
  lockedText?: string;
  prerequisite?: 'festival' | 'final';
}

export interface WorldDefinition {
  id: WorldAreaId;
  name: string;
  subtitle: string;
  npcIds: string[];
}

export interface DialogueChoice {
  id: 'duel' | 'leave';
  label: string;
}
export interface DialogueGraph {
  npcId: string;
  line: string;
  choices: DialogueChoice[];
}

export interface CampaignSaveV2 {
  id: 'campaign';
  schemaVersion: 2;
  contentVersion: typeof CONTENT_VERSION;
  updatedAt: string;
  playerName: string;
  initialStarterDeckId: string;
  activeDeckId: string;
  outfit: OutfitPalette;
  areaId: WorldAreaId;
  position: [number, number, number];
  yaw: number;
  defeatedNpcIds: string[];
  campaignComplete: boolean;
}

export type CampaignSaveV1 = CampaignSaveV2;

export interface SavedDeckRecord {
  id: `custom:${string}`;
  schemaVersion: 1;
  contentVersion: string;
  updatedAt: string;
  deck: DeckDefinition;
}

export interface PlayerProfile {
  id: 'profile';
  schemaVersion: 1;
  activeDeckId: string;
  updatedAt: string;
}

export interface PlayerObservation {
  perspective: PlayerIndex;
  turn: number;
  phase: GamePhase;
  environment: { card: CardInstance; owner: PlayerIndex } | null;
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
  deckSnapshots?: [DeckDefinition, DeckDefinition];
}

export interface SavedReplay {
  id: string;
  contentVersion: typeof CONTENT_VERSION;
  createdAt: string;
  playerDeck: string;
  aiDeck: string;
  playerDeckDefinition?: DeckDefinition;
  aiDeckDefinition?: DeckDefinition;
  difficulty: Difficulty;
  winner: PlayerIndex;
  seed: number;
  events: GameEvent[];
  duelContext?: DuelContext;
}
