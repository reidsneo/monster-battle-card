import { openDB } from 'idb';
import { CONTENT_VERSION, type GameState, type SavedMatch, type SavedReplay } from './types';

const DB_NAME = 'mrbc-local-v1';
const DB_VERSION = 1;

async function database() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('matches')) db.createObjectStore('matches', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('replays')) db.createObjectStore('replays', { keyPath: 'id' });
    },
  });
}

export async function saveMatch(state: GameState) {
  const db = await database();
  const saved: SavedMatch = { id: 'current', contentVersion: CONTENT_VERSION, updatedAt: new Date().toISOString(), state };
  await db.put('matches', saved);
}

export async function loadMatch(): Promise<{ state: GameState | null; error?: string }> {
  const db = await database();
  const saved = await db.get('matches', 'current') as SavedMatch | undefined;
  if (!saved) return { state: null };
  if (saved.contentVersion !== CONTENT_VERSION || saved.state.contentVersion !== CONTENT_VERSION) return { state: null, error: 'This save was made with an incompatible content version.' };
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
    contentVersion: CONTENT_VERSION, createdAt: new Date().toISOString(), playerDeck: state.players[0].deckId,
    aiDeck: state.players[1].deckId, difficulty: state.difficulty, winner: state.winner, seed: state.seed, events: state.events,
  };
  const db = await database();
  await db.put('replays', replay);
}

export async function listReplays(): Promise<SavedReplay[]> {
  const db = await database();
  const rows = await db.getAll('replays') as SavedReplay[];
  return rows.filter((row) => row.contentVersion === CONTENT_VERSION).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
