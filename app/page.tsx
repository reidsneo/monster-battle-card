'use client';

import Link from 'next/link';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useGameTools } from '@/hooks/use-game-tools';
import { loadMatch } from '@/lib/game/persistence';

const starters = [
  { id: 'miracle', label: 'Miracle Team', monsters: 'Tiger · Gali · Suezo', tone: 'Measured combos and clever counters', cards: ['C-001.png', 'C-002.png', 'C-004.png'], color: '#f8c83d' },
  { id: 'speed', label: 'Speed Team', monsters: 'Dino · Hare · Mocchi', tone: 'Fast pressure and efficient attacks', cards: ['C-006.png', 'C-008.png', 'C-009.png'], color: '#63b7ec' },
  { id: 'powerful', label: 'Powerful Team', monsters: 'Golem · Pixie · Naga', tone: 'Heavy hits and resilient defense', cards: ['C-003.png', 'C-005.png', 'C-007.png'], color: '#ea665c' },
] as const;

const difficulties = [
  ['easy', 'Easy', 'Forgiving choices'],
  ['normal', 'Normal', 'Balanced breeder'],
  ['hard', 'Hard', 'Plans ahead'],
] as const;

export default function Home() {
  const [starter, setStarter] = useState('miracle');
  const [difficulty, setDifficulty] = useState('normal');
  const [canResume, setCanResume] = useState(false);
  useGameTools();
  useEffect(() => { void loadMatch().then((saved) => setCanResume(Boolean(saved.state))); }, []);

  return (
    <main className="launcher-shell">
      <div className="launcher-grid" aria-hidden="true" />
      <AppNav />

      <section className="launch-stage">
        <div className="launch-intro">
          <Badge className="status-badge"><Sparkles /> Fan-made local edition</Badge>
          <p className="eyebrow">BREEDER TERMINAL // 1999</p>
          <h1>Choose your team.<br />Enter the arena.</h1>
          <p className="lede">The original three starter decks, restored as a tactile solo card battle.</p>
          <div className="archive-stats" aria-label="Archive statistics">
            <span><strong>3</strong> starter decks</span><span><strong>66</strong> playable skills</span><span><strong>9</strong> monsters</span>
          </div>
        </div>

        <section className="setup-panel" aria-labelledby="setup-heading">
          <div className="panel-heading"><div><span>01</span><h2 id="setup-heading">Select a starter</h2></div><small>50 skills · 3 monsters</small></div>
          <RadioGroup value={starter} onValueChange={setStarter} className="starter-grid">
            {starters.map((deck) => (
              <label key={deck.id} htmlFor={`starter-${deck.id}`} className="starter-card" data-selected={starter === deck.id} style={{ '--deck-color': deck.color } as React.CSSProperties}>
                <RadioGroupItem id={`starter-${deck.id}`} value={deck.id} className="sr-only" />
                <div className="card-fan" aria-hidden="true">
                  {deck.cards.map((card, index) => <img key={card} src={`/card-art/full/${card}`} alt="" style={{ '--card-index': index } as React.CSSProperties} />)}
                </div>
                <strong>{deck.label}</strong><span>{deck.monsters}</span><small>{deck.tone}</small>
              </label>
            ))}
          </RadioGroup>

          <div className="difficulty-block">
            <div className="panel-heading compact"><div><span>02</span><h2>Choose your rival</h2></div></div>
            <RadioGroup value={difficulty} onValueChange={setDifficulty} className="difficulty-grid">
              {difficulties.map(([id, label, hint]) => (
                <label key={id} htmlFor={`difficulty-${id}`} className="difficulty-option" data-selected={difficulty === id}>
                  <RadioGroupItem id={`difficulty-${id}`} value={id} /><span><strong>{label}</strong><small>{hint}</small></span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="launch-actions">
            <Button nativeButton={false} render={<Link href={`/play?deck=${starter}&difficulty=${difficulty}`} />} size="lg" className="start-button"><Play fill="currentColor" /> Start battle</Button>
            {canResume ? <Button nativeButton={false} render={<Link href="/play?resume=1" />} variant="outline" size="lg"><RotateCcw /> Resume</Button> : <Button variant="outline" size="lg" disabled><RotateCcw /> Resume</Button>}
          </div>
        </section>
      </section>

      <footer className="launcher-footer"><span>PRIVATE · OFFLINE · NONCOMMERCIAL</span><span>Rules reference: fan-translated MFBC Rule Book v3.1</span></footer>
    </main>
  );
}
