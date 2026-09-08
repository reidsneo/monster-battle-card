'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STARTER_CARDS } from '@/lib/game/cards';

const archive = Array.from({ length: 366 }, (_, index) => String(index + 1).padStart(3, '0'));
const logicalMonsters = Array.from({ length: 65 }, (_, index) => `C-${String(index + 1).padStart(3, '0')}`);
const monsterImage = (id: string) => id === 'C-044' ? 'C-044V' : id;

export default function CardsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('playable');
  const cards = useMemo(() => {
    const lower = query.toLowerCase().trim();
    if (filter === 'archive') return archive.filter((id) => !lower || id.includes(lower) || STARTER_CARDS.find((card) => card.id === id)?.name.toLowerCase().includes(lower));
    if (filter === 'monsters') return logicalMonsters.filter((id) => !lower || id.toLowerCase().includes(lower));
    return STARTER_CARDS.filter((card) => !lower || card.id.includes(lower) || card.name.toLowerCase().includes(lower) || card.owner.toLowerCase().includes(lower)).map((card) => card.id);
  }, [filter, query]);
  return (
    <main className="archive-shell"><AppNav /><section className="page-hero"><p className="eyebrow">CARD DATABASE // LOCAL ARCHIVE</p><h1>Every card, preserved.</h1><p>The 66 starter skills are rules-enabled. All 366 skill faces remain available for close inspection while the complete ruleset is authored.</p></section>
      <section className="library-toolbar"><label htmlFor="card-search"><Search /><Input id="card-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, monster, or card number" /></label><Select value={filter} onValueChange={(value) => value && setFilter(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="playable">Playable starter pool</SelectItem><SelectItem value="archive">All 366 skill faces</SelectItem><SelectItem value="monsters">65 logical monsters</SelectItem></SelectContent></Select><Badge variant="outline">{cards.length} cards</Badge></section>
      <section className="card-library">{cards.map((id) => { const definition = STARTER_CARDS.find((card) => card.id === id); const isMonster = id.startsWith('C-'); const artId = isMonster ? monsterImage(id) : id; return <article key={id} className="library-card"><a href={`/card-art/detail/${artId}.webp`} target="_blank" rel="noreferrer"><img src={`/card-art/scene/${artId}.webp`} alt={definition ? `${definition.name} card` : isMonster ? `Monster ${id}` : `Card ${id}`} loading="lazy" /></a><div><span>#{id}</span>{definition ? <><strong>{definition.name}</strong><small>{definition.owner} · {definition.type} · {definition.guts} Guts</small></> : <><strong>{isMonster ? `Logical monster ${id}` : `Archive card ${id}`}</strong><small>{isMonster ? (id === 'C-044' ? 'Gray Wolf · C-044V default artwork' : 'Monster identity · cosmetic variants collapsed') : 'Visual reference · behavior pending validation'}</small></>}</div>{definition && <Badge>PLAYABLE</Badge>}</article>; })}</section>
    </main>
  );
}
