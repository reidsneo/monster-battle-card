import { openDB } from 'idb';
import {
  CONTENT_VERSION,
  type CampaignSaveV1,
  type GameState,
  type SavedMatch,
  type SavedReplay,
} from './types';

const DB_NAME = 'mrbc-local-v1';
const DB_VERSION = 2;

async function database() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('matches'))
        db.createObjectStore('matches', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('replays'))
        db.createObjectStore('replays', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('campaign'))
        db.createObjectStore('campaign', { keyPath: 'id' });
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
  if (
    saved.contentVersion !== CONTENT_VERSION ||
    saved.state.contentVersion !== CONTENT_VERSION
  ) {
    const legacy = saved as unknown as {
      contentVersion: string;
      state: Omit<GameState, 'contentVersion'> & { contentVersion: string };
    };
    if (
      legacy.contentVersion === 'starter-v1' &&
      legacy.state.contentVersion === 'starter-v1'
    ) {
      return {
        state: {
          ...legacy.state,
          contentVersion: CONTENT_VERSION,
          duelContext: { mode: 'quick' },
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
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveCampaign(save: CampaignSaveV1) {
  const db = await database();
  await db.put('campaign', { ...save, updatedAt: new Date().toISOString() });
}

export async function loadCampaign(): Promise<CampaignSaveV1 | null> {
  const db = await database();
  const saved = (await db.get('campaign', 'campaign')) as
    | CampaignSaveV1
    | undefined;
  if (
    !saved ||
    saved.schemaVersion !== 1 ||
    saved.contentVersion !== CONTENT_VERSION
  )
    return null;
  return saved;
}

export async function clearCampaign() {
  const db = await database();
  await db.delete('campaign', 'campaign');
}
