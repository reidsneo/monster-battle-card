'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DECK_BY_ID } from '@/lib/game/decks';
import { listReplays } from '@/lib/game/persistence';
import type { SavedReplay } from '@/lib/game/types';

export default function ReplaysPage() {
  const [replays, setReplays] = useState<SavedReplay[]>([]);
  useEffect(() => { void listReplays().then(setReplays); }, []);
  return <main className="archive-shell"><AppNav /><section className="page-hero"><p className="eyebrow">MATCH ARCHIVE // INDEXEDDB</p><h1>Authoritative replays.</h1><p>Completed matches retain their seed, deck pairing, outcome, and event sequence entirely on this device.</p></section><section className="replay-list">{replays.map((replay) => <article key={replay.id}><header><div><strong>{DECK_BY_ID[replay.playerDeck].name} vs {DECK_BY_ID[replay.aiDeck].name}</strong><small>{new Date(replay.createdAt).toLocaleString()}</small></div><Badge variant={replay.winner === 0 ? 'default' : 'destructive'}>{replay.winner === 0 ? 'VICTORY' : 'DEFEAT'}</Badge></header><div className="replay-meta"><span>Seed {replay.seed}</span><span>{replay.difficulty} AI</span><span>{replay.events.length} events</span></div><ScrollArea className="replay-events">{replay.events.map((event) => <p key={event.id}><span>{event.id}</span>{event.message}</p>)}</ScrollArea></article>)}{!replays.length && <div className="empty-replays"><strong>No completed matches yet.</strong><p>Your first result will be recorded here automatically.</p></div>}</section></main>;
}
