import { openDB } from 'idb';
import {
  CONTENT_VERSION,
  type CampaignSaveV1,
  type DeckDefinition,
  type GameState,
  type PlayerProfile,
  type SavedDeckRecord,
  type SavedMatch,
  type SavedReplay,
} from './types';
import {
  getDeckDefinition,
  registerDeck,
  unregisterDeck,
  validateDeck,
} from './decks';

const DB_NAME = 'mrbc-local-v1';
const DB_VERSION = 3;

async function database() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('matches'))
        db.createObjectStore('matches', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('replays'))
        db.createObjectStore('replays', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('campaign'))
        db.createObjectStore('campaign', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('decks'))
        db.createObjectStore('decks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('profile'))
        db.createObjectStore('profile', { keyPath: 'id' });
    },
  });
}

export async function saveMatch(state: GameState) {
  const db = await database();
  const saved: SavedMatch = {
    id: 'current',
    contentVersion: CONTENT_VERSION,
    updatedAt: new Date().toISOString(),
    state,
    deckSnapshots: [
      getDeckDefinition(state.players[0].deckId)!,
      getDeckDefinition(state.players[1].deckId)!,
    ],
  };
  await db.put('matches', saved);
}

export async function loadMatch(): Promise<{
  state: GameState | null;
  error?: string;
}> {
  const db = await database();
  const saved = (await db.get('matches', 'current')) as SavedMatch | undefined;
  if (!saved) return { state: null };
  saved.deckSnapshots?.forEach((deck) => registerDeck(deck));
  if (saved.contentVersion !== CONTENT_VERSION || saved.state.contentVersion !== CONTENT_VERSION) {
    const legacy = saved as unknown as {
      contentVersion: string;
      state: Omit<GameState, 'contentVersion'> & { contentVersion: string };
    };
    if (
      ['starter-v1', 'journey-v2'].includes(legacy.contentVersion) &&
      ['starter-v1', 'journey-v2'].includes(legacy.state.contentVersion)
    ) {
      const migrated = legacy.state as unknown as GameState;
      return {
        state: {
          ...migrated,
          contentVersion: CONTENT_VERSION,
          duelContext: migrated.duelContext ?? { mode: 'quick' },
          environment: migrated.environment ?? null,
          revealedInformation: migrated.revealedInformation ?? [],
          transformationHistory: migrated.transformationHistory ?? [],
          players: migrated.players.map((player) => ({
            ...player,
            blockLocked: player.blockLocked ?? false,
            skipNextTurn: player.skipNextTurn ?? false,
            gutsConvertedThisTurn: player.gutsConvertedThisTurn ?? 0,
            permissions: player.permissions ?? {
              extraBreeders: false,
              unlimitedAttacks: false,
              freeSpecials: false,
            },
          })) as GameState['players'],
          pendingAttack: migrated.pendingAttack
            ? {
                ...migrated.pendingAttack,
                unblockable: migrated.pendingAttack.unblockable ?? false,
                returnToHand: migrated.pendingAttack.returnToHand ?? false,
                locksDamagedMonster:
                  migrated.pendingAttack.locksDamagedMonster ?? false,
              }
            : null,
        },
      };
    }
    return {
      state: null,
      error: 'This save was made with an incompatible content version.',
    };
  }
  return { state: saved.state };
}

export async function clearMatch() {
  const db = await database();
  await db.delete('matches', 'current');
}

export async function saveReplay(state: GameState) {
  if (state.winner === null) return;
  const replay: SavedReplay = {
    id: `${state.seed}-${state.events.at(-1)?.id ?? 0}`,
    contentVersion: CONTENT_VERSION,
    createdAt: new Date().toISOString(),
    playerDeck: state.players[0].deckId,
    aiDeck: state.players[1].deckId,
    playerDeckDefinition: getDeckDefinition(state.players[0].deckId),
    aiDeckDefinition: getDeckDefinition(state.players[1].deckId),
    difficulty: state.difficulty,
    winner: state.winner,
    seed: state.seed,
    events: state.events,
    duelContext: state.duelContext,
  };
  const db = await database();
  await db.put('replays', replay);
}

export async function listReplays(): Promise<SavedReplay[]> {
  const db = await database();
  const rows = (await db.getAll('replays')) as SavedReplay[];
  rows.forEach((replay) => {
    if (replay.playerDeckDefinition) registerDeck(replay.playerDeckDefinition);
    if (replay.aiDeckDefinition) registerDeck(replay.aiDeckDefinition);
  });
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveCampaign(save: CampaignSaveV1) {
  const db = await database();
  await db.put('campaign', { ...save, updatedAt: new Date().toISOString() });
}

export async function loadCampaign(): Promise<CampaignSaveV1 | null> {
  const db = await database();
  const saved = (await db.get('campaign', 'campaign')) as unknown;
  if (!saved || typeof saved !== 'object') return null;
  const current = saved as Record<string, unknown> & {
    schemaVersion?: number;
    contentVersion?: string;
    starterDeckId?: string;
    activeDeckId?: string;
  };
  if (current.schemaVersion === 2 && current.contentVersion === CONTENT_VERSION)
    return current as unknown as CampaignSaveV1;
  if (
    current.schemaVersion === 1 &&
    ['starter-v1', 'journey-v2'].includes(current.contentVersion ?? '')
  ) {
    const starter = current.starterDeckId ?? 'miracle';
    const migrated = {
      ...current,
      schemaVersion: 2,
      contentVersion: CONTENT_VERSION,
      initialStarterDeckId: starter,
      activeDeckId: starter,
    } as CampaignSaveV1;
    delete (migrated as CampaignSaveV1 & { starterDeckId?: string }).starterDeckId;
    await saveCampaign(migrated);
    return migrated;
  }
  return null;
}

export async function clearCampaign() {
  const db = await database();
  await db.delete('campaign', 'campaign');
}

export async function listSavedDecks(): Promise<SavedDeckRecord[]> {
  const db = await database();
  const records = (await db.getAll('decks')) as SavedDeckRecord[];
  records.forEach((record) => registerDeck(record.deck));
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveCustomDeck(deck: DeckDefinition) {
  if (!deck.id.startsWith('custom:'))
    throw new Error('Custom deck IDs must start with custom:.');
  const record: SavedDeckRecord = {
    id: deck.id as `custom:${string}`,
    schemaVersion: 1,
    contentVersion: CONTENT_VERSION,
    updatedAt: new Date().toISOString(),
    deck: { ...deck, source: 'custom' },
  };
  const db = await database();
  await db.put('decks', record);
  registerDeck(record.deck);
  return { record, errors: validateDeck(record.deck) };
}

export async function deleteCustomDeck(deckId: string) {
  if (!deckId.startsWith('custom:')) return;
  const db = await database();
  await db.delete('decks', deckId);
  unregisterDeck(deckId);
  const profile = await getPlayerProfile();
  if (profile.activeDeckId === deckId) await setActiveDeckId('miracle');
  const campaign = await loadCampaign();
  if (campaign?.activeDeckId === deckId)
    await saveCampaign({ ...campaign, activeDeckId: 'miracle' });
}

export async function getPlayerProfile(): Promise<PlayerProfile> {
  const db = await database();
  const saved = (await db.get('profile', 'profile')) as PlayerProfile | undefined;
  return saved ?? {
    id: 'profile',
    schemaVersion: 1,
    activeDeckId: 'miracle',
    updatedAt: new Date().toISOString(),
  };
}

export async function setActiveDeckId(activeDeckId: string) {
  const db = await database();
  const profile: PlayerProfile = {
    id: 'profile',
    schemaVersion: 1,
    activeDeckId,
    updatedAt: new Date().toISOString(),
  };
  await db.put('profile', profile);
  const campaign = await loadCampaign();
  if (campaign) await saveCampaign({ ...campaign, activeDeckId });
  return profile;
}
