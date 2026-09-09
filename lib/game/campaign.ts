import { DECK_BY_ID } from './decks';
import type {
  CampaignSaveV1,
  DialogueGraph,
  NpcDefinition,
  OutfitPalette,
  WorldAreaId,
  WorldDefinition,
} from './types';
import { CONTENT_VERSION } from './types';

export const OUTFIT_PALETTES: Record<
  OutfitPalette,
  { label: string; color: string; portrait: string }
> = {
  azure: {
    label: 'Azure',
    color: '#4cc9ff',
    portrait: '/portraits/player-azure.webp',
  },
  vermilion: {
    label: 'Vermilion',
    color: '#ff625c',
    portrait: '/portraits/player-vermilion.webp',
  },
  moss: {
    label: 'Moss',
    color: '#7fbd55',
    portrait: '/portraits/player-moss.webp',
  },
  gold: {
    label: 'Gold',
    color: '#f2bf42',
    portrait: '/portraits/player-gold.webp',
  },
};

export const WORLDS: Record<WorldAreaId, WorldDefinition> = {
  ranch: {
    id: 'ranch',
    name: 'Ranch Grounds',
    subtitle: 'Where every breeder begins',
    npcIds: ['mina', 'kiro', 'bram'],
  },
  festival: {
    id: 'festival',
    name: 'Festival Courtyard',
    subtitle: 'The regional breeder trials',
    npcIds: ['lyra', 'rook', 'veyra'],
  },
};

export const NPCS: Record<string, NpcDefinition> = {
  mina: {
    id: 'mina',
    name: 'Mina',
    title: 'Ranch Mentor',
    areaId: 'ranch',
    deckId: 'miracle',
    difficulty: 'easy',
    portrait: '/portraits/mina.webp',
    position: [-4.4, 0, -2.2],
    greeting:
      'A calm hand wins more battles than a hurried one. Want to practice?',
    rematch: 'Back for another lesson? Let us see what changed.',
  },
  kiro: {
    id: 'kiro',
    name: 'Kiro',
    title: 'Windstep Breeder',
    areaId: 'ranch',
    deckId: 'speed',
    difficulty: 'easy',
    portrait: '/portraits/kiro.webp',
    position: [2.9, 0, -4.1],
    greeting:
      'Cards up! I promise to slow down just enough for you to see me win.',
    rematch: 'You know my rhythm now. Can you break it?',
  },
  bram: {
    id: 'bram',
    name: 'Bram',
    title: 'Ranch Foreman',
    areaId: 'ranch',
    deckId: 'powerful',
    difficulty: 'normal',
    portrait: '/portraits/bram.webp',
    position: [5.1, 0, 1.8],
    greeting:
      'Strength is timing, not noise. Show me you can stand your ground.',
    rematch: 'Good. A solid deck only gets better under pressure.',
  },
  lyra: {
    id: 'lyra',
    name: 'Lyra',
    title: 'Counterweave',
    areaId: 'festival',
    deckId: 'lyra-miracle',
    difficulty: 'normal',
    portrait: '/portraits/lyra.webp',
    position: [-4.8, 0, -2.8],
    greeting:
      'Every attack leaves a question behind it. Mine is simple: what will you do next?',
    rematch: 'A rematch reveals which lessons truly stayed.',
  },
  rook: {
    id: 'rook',
    name: 'Rook',
    title: 'Iron Pressure',
    areaId: 'festival',
    deckId: 'rook-powerful',
    difficulty: 'normal',
    portrait: '/portraits/rook.webp',
    position: [4.5, 0, -2.8],
    greeting: 'No wasted motion. No wasted Guts. Meet me on the field.',
    rematch: 'Respect is earned twice. Let us begin.',
  },
  veyra: {
    id: 'veyra',
    name: 'Veyra',
    title: 'Tempest Rival',
    areaId: 'festival',
    deckId: 'veyra-speed',
    difficulty: 'hard',
    portrait: '/portraits/veyra.webp',
    position: [0, 0, -6.3],
    greeting:
      'You crossed the ranch and the courtyard. Now prove you can read the whole battle.',
    rematch: 'The final table remembers every mistake.',
    lockedText: 'Win against Lyra and Rook before challenging me.',
    prerequisite: 'final',
  },
};

export function createCampaign(
  starterDeckId = 'miracle',
  outfit: OutfitPalette = 'azure',
): CampaignSaveV1 {
  const safeDeck =
    DECK_BY_ID[starterDeckId]?.source === 'starter' ? starterDeckId : 'miracle';
  return {
    id: 'campaign',
    schemaVersion: 1,
    contentVersion: CONTENT_VERSION,
    updatedAt: new Date().toISOString(),
    playerName: 'Breeder',
    starterDeckId: safeDeck,
    outfit,
    areaId: 'ranch',
    position: [0, 0, 4.7],
    yaw: Math.PI,
    defeatedNpcIds: [],
    campaignComplete: false,
  };
}

export function festivalUnlocked(save: CampaignSaveV1) {
  return (
    ['mina', 'kiro', 'bram'].filter((id) => save.defeatedNpcIds.includes(id))
      .length >= 2
  );
}

export function npcUnlocked(save: CampaignSaveV1, npc: NpcDefinition) {
  if (npc.areaId === 'festival' && !festivalUnlocked(save)) return false;
  if (npc.prerequisite === 'final')
    return (
      save.defeatedNpcIds.includes('lyra') &&
      save.defeatedNpcIds.includes('rook')
    );
  return true;
}

export function dialogueFor(
  save: CampaignSaveV1,
  npc: NpcDefinition,
): DialogueGraph {
  const unlocked = npcUnlocked(save, npc);
  return {
    npcId: npc.id,
    line: unlocked
      ? save.defeatedNpcIds.includes(npc.id)
        ? npc.rematch
        : npc.greeting
      : (npc.lockedText ?? 'The next trial has not opened yet.'),
    choices: unlocked
      ? [
          { id: 'duel', label: 'Duel' },
          { id: 'leave', label: 'Not yet' },
        ]
      : [{ id: 'leave', label: 'Understood' }],
  };
}

export function rivalForDeck(deckId: string) {
  return Object.values(NPCS).find((npc) => npc.deckId === deckId) ?? NPCS.mina;
}
