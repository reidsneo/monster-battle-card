'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL_CARDS, CATALOG_SOURCE_REVISION, MONSTERS } from '@/lib/game/cards';

export default function CardsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('skills');
  const cards = useMemo(() => {
    const lower = query.toLowerCase().trim();
    if (filter === 'monsters')
      return MONSTERS.filter((monster) =>
        !lower ||
        [monster.id, monster.name, monster.mainBreed, monster.subBreed, monster.attribute]
          .join(' ')
          .toLowerCase()
          .includes(lower),
      ).map((monster) => ({ kind: 'monster' as const, monster }));
    return ALL_CARDS.filter((card) => {
      if (filter !== 'skills' && card.type !== filter) return false;
      return (
        !lower ||
        [card.id, card.name, card.owner, card.type, card.text, `set ${card.set}`]
          .join(' ')
          .toLowerCase()
          .includes(lower)
      );
    }).map((card) => ({ kind: 'skill' as const, card }));
  }, [filter, query]);

  return (
    <main className="archive-shell">
      <AppNav />
      <section className="page-hero">
        <p className="eyebrow">CARD DATABASE // FULL-POOL V1</p>
        <h1>Every card is battle-ready.</h1>
        <p>
          366 skills and 65 logical monsters are available offline, with all 89
          supplied monster prints preserved. Source snapshot: {CATALOG_SOURCE_REVISION}.
        </p>
      </section>
      <section className="library-toolbar">
        <label htmlFor="card-search">
          <Search />
          <Input
            id="card-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, breed, text, type, set, or number"
          />
        </label>
        <Select value={filter} onValueChange={(value) => value && setFilter(value)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="skills">All 366 skills</SelectItem>
            <SelectItem value="POW">Power moves</SelectItem>
            <SelectItem value="INT">Intelligence moves</SelectItem>
            <SelectItem value="SPE">Special moves</SelectItem>
            <SelectItem value="DGE">Dodge cards</SelectItem>
            <SelectItem value="BLK">Block cards</SelectItem>
            <SelectItem value="ENV">Environment cards</SelectItem>
            <SelectItem value="monsters">65 logical monsters</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline">{cards.length} cards</Badge>
      </section>
      <section className="card-library">
        {cards.map((entry) => {
          if (entry.kind === 'monster') {
            const { monster } = entry;
            return (
              <article key={monster.id} className="library-card">
                <a href={monster.image} target="_blank" rel="noreferrer">
                  <img
                    src={monster.image.replace('/detail/', '/scene/')}
                    alt={`${monster.name} monster card`}
                    loading="lazy"
                  />
                </a>
                <div>
                  <span>#{monster.id} · {monster.life} LIFE</span>
                  <strong>{monster.name}</strong>
                  <small>
                    {monster.breedType.toUpperCase()} · {monster.mainBreed}/{monster.subBreed} · {monster.attribute}
                  </small>
                  <small>{monster.prints.length} local print{monster.prints.length === 1 ? '' : 's'} · default {monster.selectedPrintId}</small>
                </div>
                <Badge>PLAYABLE</Badge>
              </article>
            );
          }
          const { card } = entry;
          return (
            <article key={card.id} className="library-card">
              <a href={card.image} target="_blank" rel="noreferrer">
                <img
                  src={card.image.replace('/detail/', '/scene/')}
                  alt={`${card.name} card`}
                  loading="lazy"
                />
              </a>
              <div>
                <span>#{card.id} · SET {card.set}</span>
                <strong>{card.name}</strong>
                <small>{card.owner} · {card.type} · {card.guts} Guts{card.damage === null ? '' : ` · ${card.damage} DMG`}</small>
                <small>{card.text || 'No additional rules text.'}</small>
                {card.id === '318' && <a className="misprint-link" href="/card-art/detail/318-misprint.webp" target="_blank" rel="noreferrer">Inspect gallery-only misprint</a>}
              </div>
              <Badge>PLAYABLE</Badge>
            </article>
          );
        })}
      </section>
    </main>
  );
}
