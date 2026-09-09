'use client';

import Link from 'next/link';
import {
  BookOpen,
  Layers3 as Cards,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Map,
  Play,
  RotateCcw,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useGameTools } from '@/hooks/use-game-tools';
import { createCampaign, OUTFIT_PALETTES } from '@/lib/game/campaign';
import { loadCampaign, loadMatch, saveCampaign } from '@/lib/game/persistence';
import type { OutfitPalette } from '@/lib/game/types';

const starters = [
  {
    id: 'miracle',
    label: 'Miracle Team',
    monsters: 'Tiger · Gali · Suezo',
    cards: ['C-001.png', 'C-002.png', 'C-004.png'],
    color: '#f8c83d',
  },
  {
    id: 'speed',
    label: 'Speed Team',
    monsters: 'Dino · Hare · Mocchi',
    cards: ['C-006.png', 'C-008.png', 'C-009.png'],
    color: '#63b7ec',
  },
  {
    id: 'powerful',
    label: 'Powerful Team',
    monsters: 'Golem · Pixie · Naga',
    cards: ['C-003.png', 'C-005.png', 'C-007.png'],
    color: '#ea665c',
  },
] as const;
const difficulties = [
  ['easy', 'Easy'],
  ['normal', 'Normal'],
  ['hard', 'Hard'],
] as const;

export default function Home() {
  const [panel, setPanel] = useState<'menu' | 'journey' | 'quick'>('menu');
  const [starter, setStarter] = useState('miracle');
  const [difficulty, setDifficulty] = useState('normal');
  const [outfit, setOutfit] = useState<OutfitPalette>('azure');
  const [canResume, setCanResume] = useState(false);
  const [hasCampaign, setHasCampaign] = useState(false);
  useGameTools();
  useEffect(() => {
    void Promise.all([loadMatch(), loadCampaign()]).then(
      ([match, campaign]) => {
        setCanResume(Boolean(match.state));
        setHasCampaign(Boolean(campaign));
      },
    );
  }, []);
  const beginJourney = async () => {
    await saveCampaign(createCampaign(starter, outfit));
    window.location.assign('/world');
  };

  return (
    <main className="title-shell">
      <div className="title-scenery" aria-hidden="true">
        <div className="sun" />
        <div className="mountain mountain-a" />
        <div className="mountain mountain-b" />
        <div className="ranch-silhouette" />
        <div className="floating-cards">
          {starters[0].cards.map((card, index) => (
            <img
              key={card}
              src={`/card-art/full/${card}`}
              alt=""
              style={{ '--i': index } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
      <header className="title-logo">
        <span className="brand-mark">MR</span>
        <div>
          <small>FAN-MADE LOCAL EDITION</small>
          <h1>Monster Battle Card</h1>
          <p>Breeder Journey</p>
        </div>
      </header>

      {panel === 'menu' && (
        <section className="title-menu">
          <button onClick={() => setPanel('journey')}>
            <Map />
            <span>
              <strong>New Journey</strong>
              <small>Explore the ranch and challenge six breeders</small>
            </span>
            <ChevronRight />
          </button>
          {hasCampaign && (
            <Link href="/world">
              <RotateCcw />
              <span>
                <strong>Continue Journey</strong>
                <small>Return to your last saved position</small>
              </span>
              <ChevronRight />
            </Link>
          )}
          <button onClick={() => setPanel('quick')}>
            <Gamepad2 />
            <span>
              <strong>Quick Duel</strong>
              <small>Choose a starter and AI difficulty</small>
            </span>
            <ChevronRight />
          </button>
          {canResume && (
            <Link href="/play?resume=1">
              <Play />
              <span>
                <strong>Resume Battle</strong>
                <small>Continue the interrupted duel</small>
              </span>
              <ChevronRight />
            </Link>
          )}
          <Link href="/cards">
            <Cards />
            <span>
              <strong>Card Archive</strong>
              <small>Inspect the preserved card collection</small>
            </span>
            <ChevronRight />
          </Link>
          <Link href="/rules">
            <BookOpen />
            <span>
              <strong>Field Manual</strong>
              <small>Rules and complete v3.1 rulebook</small>
            </span>
            <ChevronRight />
          </Link>
          <Link href="/replays">
            <ScrollText />
            <span>
              <strong>Battle Records</strong>
              <small>Review saved match events</small>
            </span>
            <ChevronRight />
          </Link>
        </section>
      )}

      {panel !== 'menu' && (
        <section className="title-setup">
          <button className="back-menu" onClick={() => setPanel('menu')}>
            <ChevronLeft /> Main menu
          </button>
          <div className="title-setup-heading">
            <Sparkles />
            <div>
              <small>
                {panel === 'journey' ? 'NEW JOURNEY' : 'QUICK DUEL'}
              </small>
              <h2>Choose your team</h2>
            </div>
          </div>
          <RadioGroup
            value={starter}
            onValueChange={setStarter}
            className="title-decks"
          >
            {starters.map((deck) => (
              <label
                key={deck.id}
                htmlFor={`starter-${deck.id}`}
                data-selected={starter === deck.id}
                style={{ '--deck-color': deck.color } as React.CSSProperties}
              >
                <RadioGroupItem
                  id={`starter-${deck.id}`}
                  value={deck.id}
                  className="sr-only"
                />
                <div>
                  {deck.cards.map((card, index) => (
                    <img
                      key={card}
                      src={`/card-art/full/${card}`}
                      alt=""
                      style={{ '--i': index } as React.CSSProperties}
                    />
                  ))}
                </div>
                <strong>{deck.label}</strong>
                <span>{deck.monsters}</span>
              </label>
            ))}
          </RadioGroup>
          {panel === 'journey' ? (
            <>
              <div className="outfit-heading">
                <small>OUTFIT COLOR</small>
                <strong>Choose your breeder accent</strong>
              </div>
              <RadioGroup
                value={outfit}
                onValueChange={(value) => setOutfit(value as OutfitPalette)}
                className="outfit-options"
              >
                {Object.entries(OUTFIT_PALETTES).map(([id, palette]) => (
                  <label
                    key={id}
                    htmlFor={`outfit-${id}`}
                    data-selected={outfit === id}
                    style={{ '--swatch': palette.color } as React.CSSProperties}
                  >
                    <RadioGroupItem
                      id={`outfit-${id}`}
                      value={id}
                      className="sr-only"
                    />
                    <i />
                    <span>{palette.label}</span>
                  </label>
                ))}
              </RadioGroup>
              <Button size="lg" onClick={() => void beginJourney()}>
                <Map /> Enter Ranch Grounds
              </Button>
            </>
          ) : (
            <>
              <div className="outfit-heading">
                <small>RIVAL POLICY</small>
                <strong>Choose difficulty</strong>
              </div>
              <RadioGroup
                value={difficulty}
                onValueChange={setDifficulty}
                className="quick-difficulty"
              >
                {difficulties.map(([id, label]) => (
                  <label
                    key={id}
                    htmlFor={`difficulty-${id}`}
                    data-selected={difficulty === id}
                  >
                    <RadioGroupItem
                      id={`difficulty-${id}`}
                      value={id}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </RadioGroup>
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/play?deck=${starter}&difficulty=${difficulty}`}
                  />
                }
                size="lg"
              >
                <Play /> Enter Duel
              </Button>
            </>
          )}
        </section>
      )}
      <footer className="title-footer">
        <span>PRIVATE · OFFLINE · NONCOMMERCIAL</span>
        <span>Mouse · Keyboard · Touch</span>
      </footer>
    </main>
  );
}
