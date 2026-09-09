'use client';

import { Check, Copy, Minus, Plus, Save, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { ALL_CARDS, CARD_BY_ID, MONSTERS, MONSTER_BY_ID } from '@/lib/game/cards';
import {
  compatibleMonsters,
  STARTER_DECKS,
  validateDeck,
} from '@/lib/game/decks';
import {
  deleteCustomDeck,
  getPlayerProfile,
  listSavedDecks,
  saveCustomDeck,
  setActiveDeckId,
} from '@/lib/game/persistence';
import type { DeckDefinition, SavedDeckRecord, SkillType } from '@/lib/game/types';

const newId = () => `custom:${crypto.randomUUID()}`;
const owners = [...new Set(ALL_CARDS.map((card) => card.owner))].sort();
const freshDeck = (): DeckDefinition => ({
  ...STARTER_DECKS[0],
  id: newId(),
  source: 'custom',
  name: 'New Breeder Deck',
  description: 'A locally authored full-pool deck.',
  monsterIds: [...STARTER_DECKS[0].monsterIds],
  skillIds: [...STARTER_DECKS[0].skillIds],
});

function countCards(ids: string[]) {
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  return counts;
}

export default function DeckBuilderPage() {
  const [records, setRecords] = useState<SavedDeckRecord[]>([]);
  const [draft, setDraft] = useState<DeckDefinition | null>(null);
  const [activeDeckId, setActive] = useState('miracle');
  const [query, setQuery] = useState('');
  const [monsterQuery, setMonsterQuery] = useState('');
  const [type, setType] = useState<'all' | SkillType>('all');
  const [owner, setOwner] = useState('all');
  const [setFilter, setSetFilter] = useState<'all' | '1' | '2' | '3' | '4'>('all');
  const [implementation, setImplementation] = useState<'all' | 'dsl' | 'handler'>('all');
  const [compatibilityOnly, setCompatibilityOnly] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = async (preferredId?: string) => {
    const [saved, profile] = await Promise.all([listSavedDecks(), getPlayerProfile()]);
    setRecords(saved);
    setActive(profile.activeDeckId);
    const selected = saved.find((record) => record.id === preferredId)?.deck;
    if (selected) setDraft(structuredClone(selected));
    else if (!draft) setDraft(saved[0] ? structuredClone(saved[0].deck) : freshDeck());
  };

  useEffect(() => {
    void refresh();
    // Initial IndexedDB hydration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => countCards(draft?.skillIds ?? []), [draft?.skillIds]);
  const errors = useMemo(() => (draft ? validateDeck(draft) : []), [draft]);
  const visibleMonsters = useMemo(() => {
    const lower = monsterQuery.trim().toLowerCase();
    return MONSTERS.filter((monster) =>
      !lower ||
      [monster.id, monster.name, monster.mainBreed, monster.subBreed]
        .join(' ')
        .toLowerCase()
        .includes(lower),
    );
  }, [monsterQuery]);
  const visibleCards = useMemo(() => {
    if (!draft) return [];
    const lower = query.trim().toLowerCase();
    return ALL_CARDS.filter((card) => {
      if (type !== 'all' && card.type !== type) return false;
      if (owner !== 'all' && card.owner !== owner) return false;
      if (setFilter !== 'all' && card.set !== Number(setFilter)) return false;
      if (implementation !== 'all' && card.implementation !== implementation) return false;
      if (compatibilityOnly && compatibleMonsters(card, draft.monsterIds).length === 0)
        return false;
      return (
        !lower ||
        [card.id, card.name, card.owner, card.type, card.text]
          .join(' ')
          .toLowerCase()
          .includes(lower)
      );
    });
  }, [compatibilityOnly, draft, implementation, owner, query, setFilter, type]);

  if (!draft)
    return <main className="archive-shell"><AppNav /><div className="deck-loading">Opening local deck case…</div></main>;

  const updateCount = (cardId: string, delta: number) => {
    setDraft((current) => {
      if (!current) return current;
      const next = [...current.skillIds];
      if (delta > 0) {
        if ((counts.get(cardId) ?? 0) >= 3 || next.length >= 50) return current;
        next.push(cardId);
      } else {
        const index = next.lastIndexOf(cardId);
        if (index < 0) return current;
        next.splice(index, 1);
      }
      return { ...current, skillIds: next };
    });
  };

  const toggleMonster = (logicalId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const next = [...current.monsterIds];
      const selectedIndex = next.findIndex(
        (id) => MONSTER_BY_ID[id]?.logicalId === logicalId,
      );
      if (selectedIndex >= 0) next.splice(selectedIndex, 1);
      else if (next.length < 3) next.push(MONSTER_BY_ID[logicalId].defaultPrintId);
      return { ...current, monsterIds: next as [string, string, string] };
    });
  };

  const save = async () => {
    await saveCustomDeck(draft);
    setNotice(errors.length ? 'Saved for editing. Resolve the highlighted issues before activation.' : 'Deck saved locally.');
    await refresh(draft.id);
  };

  const activate = async () => {
    if (errors.length) {
      setNotice('Only a valid 3-monster, 50-card deck can enter battle.');
      return;
    }
    await saveCustomDeck(draft);
    await setActiveDeckId(draft.id);
    setActive(draft.id);
    setNotice('Active deck updated for Quick Duel and campaign battles.');
  };

  return (
    <main className="deck-builder-shell">
      <AppNav />
      <header className="deck-builder-head">
        <div>
          <small>BREEDER DECK CASE // ALL CARDS UNLOCKED</small>
          <h1>Build your team</h1>
          <p>Choose three unique monsters and exactly 50 compatible skills. Mixed breeds attack from their main breed and defend from their sub-breed.</p>
        </div>
        <div className="deck-file-controls">
          <select
            aria-label="Saved decks"
            value={records.some((record) => record.id === draft.id) ? draft.id : 'new'}
            onChange={(event) => {
              const selected = records.find((record) => record.id === event.target.value);
              setDraft(selected ? structuredClone(selected.deck) : freshDeck());
              setNotice('');
            }}
          >
            <option value="new">＋ Unsaved deck</option>
            {records.map((record) => <option key={record.id} value={record.id}>{record.deck.name}</option>)}
          </select>
          <input
            aria-label="Deck name"
            value={draft.name}
            maxLength={48}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <button onClick={() => void save()}><Save /> Save</button>
          <button
            onClick={() => {
              setDraft({ ...draft, id: newId(), name: `${draft.name} Copy`, skillIds: [...draft.skillIds], monsterIds: [...draft.monsterIds] as [string, string, string] });
              setNotice('Duplicate ready. Save when you are happy with it.');
            }}
          ><Copy /> Duplicate</button>
          <button
            disabled={!records.some((record) => record.id === draft.id)}
            onClick={() => {
              if (!window.confirm(`Delete ${draft.name}? This cannot be undone.`)) return;
              void deleteCustomDeck(draft.id).then(() => {
                setDraft(freshDeck());
                void refresh();
              });
            }}
          ><Trash2 /> Delete</button>
          <button className="activate-deck" disabled={errors.length > 0} onClick={() => void activate()}>
            <ShieldCheck /> {activeDeckId === draft.id ? 'Active Deck' : 'Use This Deck'}
          </button>
        </div>
      </header>

      {notice && <output className="deck-notice">{notice}</output>}
      <section className="deck-builder-grid">
        <aside className="deck-team-panel">
          <header><span>01</span><div><small>MONSTER TEAM</small><strong>{draft.monsterIds.length}/3 chosen</strong></div></header>
          <input value={monsterQuery} onChange={(event) => setMonsterQuery(event.target.value)} placeholder="Find a monster or breed" />
          <div className="chosen-monsters">
            {draft.monsterIds.map((id, index) => {
              const monster = MONSTER_BY_ID[id];
              if (!monster) return null;
              return (
                <article key={`${monster.logicalId}-${index}`}>
                  <img src={monster.image.replace('/detail/', '/scene/')} alt="" />
                  <div><strong>{monster.name}</strong><small>{monster.mainBreed}/{monster.subBreed}</small>
                    <select
                      aria-label={`${monster.name} print`}
                      value={id}
                      onChange={(event) => {
                        const monsterIds = [...draft.monsterIds];
                        monsterIds[index] = event.target.value;
                        setDraft({ ...draft, monsterIds: monsterIds as [string, string, string] });
                      }}
                    >
                      {monster.prints.map((printId) => <option key={printId} value={printId}>{printId}</option>)}
                    </select>
                  </div>
                  <button aria-label={`Remove ${monster.name}`} onClick={() => toggleMonster(monster.logicalId)}>×</button>
                </article>
              );
            })}
          </div>
          <div className="monster-picker">
            {visibleMonsters.map((monster) => {
              const chosen = draft.monsterIds.some((id) => MONSTER_BY_ID[id]?.logicalId === monster.logicalId);
              return (
                <button key={monster.logicalId} data-selected={chosen} onClick={() => toggleMonster(monster.logicalId)}>
                  <img src={monster.image.replace('/detail/', '/scene/')} alt="" />
                  <span><strong>{monster.name}</strong><small>{monster.mainBreed}/{monster.subBreed} · {monster.life} Life</small></span>
                  {chosen && <Check />}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="deck-card-panel">
          <header><span>02</span><div><small>SKILL LIBRARY</small><strong>{visibleCards.length} matching cards</strong></div></header>
          <div className="deck-card-filters">
            <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rules text, name, breed, or ID" /></label>
            <select value={type} onChange={(event) => setType(event.target.value as 'all' | SkillType)}>
              <option value="all">All types</option>{['POW', 'INT', 'SPE', 'DGE', 'BLK', 'ENV'].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="all">All breeds</option>{owners.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={setFilter} onChange={(event) => setSetFilter(event.target.value as typeof setFilter)}>
              <option value="all">All sets</option>{[1, 2, 3, 4].map((item) => <option key={item} value={item}>Set {item}</option>)}
            </select>
            <select value={implementation} onChange={(event) => setImplementation(event.target.value as typeof implementation)}>
              <option value="all">All effects</option><option value="dsl">Rules DSL</option><option value="handler">Special handlers</option>
            </select>
            <label className="compatible-toggle"><input type="checkbox" checked={compatibilityOnly} onChange={(event) => setCompatibilityOnly(event.target.checked)} /> Team-compatible</label>
          </div>
          <div className="deck-card-library">
            {visibleCards.map((card) => {
              const count = counts.get(card.id) ?? 0;
              const compatible = compatibleMonsters(card, draft.monsterIds).length > 0;
              return (
                <article key={card.id} data-incompatible={!compatible}>
                  <img src={card.image.replace('/detail/', '/scene/')} alt="" loading="lazy" />
                  <div><small>#{card.id} · SET {card.set}</small><strong>{card.name}</strong><span>{card.owner} · {card.type} · {card.guts} Guts</span><p>{card.text || 'No additional rules text.'}</p>{!compatible && <em>Needs a compatible {card.type === 'DGE' || card.type === 'BLK' ? 'defense sub-breed' : 'main breed'}.</em>}</div>
                  <nav>
                    <button aria-label={`Remove ${card.name}`} disabled={!count} onClick={() => updateCount(card.id, -1)}><Minus /></button>
                    <b>{count}</b>
                    <button aria-label={`Add ${card.name}`} disabled={!compatible || count >= 3 || draft.skillIds.length >= 50} onClick={() => updateCount(card.id, 1)}><Plus /></button>
                  </nav>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="deck-tray-panel">
          <header><span>03</span><div><small>DECK TRAY</small><strong>{draft.skillIds.length}/50 cards</strong></div></header>
          <div className="deck-validation" data-valid={errors.length === 0}>
            {errors.length ? errors.map((error) => <p key={error}>{error}</p>) : <p><Check /> Legal and ready for battle.</p>}
          </div>
          <div className="deck-tray-list">
            {[...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, count]) => {
              const card = CARD_BY_ID[id];
              return <button key={id} onClick={() => updateCount(id, -1)}><img src={card.image.replace('/detail/', '/scene/')} alt="" /><span><strong>{card.name}</strong><small>#{id} · {card.type}</small></span><b>×{count}</b></button>;
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}
