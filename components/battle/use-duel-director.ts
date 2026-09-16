'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleAudio } from '@/lib/game/battle-audio';
import {
  buildDuelCues,
  cueDuration,
  type DuelCue,
} from '@/lib/game/battle-director';
import type { GameState, PresentationSettings } from '@/lib/game/types';

export function useDuelDirector(
  state: GameState | null,
  settings: PresentationSettings,
  paused: boolean,
) {
  const previous = useRef<GameState | null>(null);
  const [queue, setQueue] = useState<DuelCue[]>([]);
  const audio = useRef<BattleAudio | null>(null);
  const started = useRef(0);
  const sounded = useRef('');
  const cue = queue[0] ?? null;
  useEffect(() => {
    const sound = new BattleAudio();
    audio.current = sound;
    const unlock = () => void sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      sound.dispose();
    };
  }, []);
  useEffect(() => {
    audio.current?.setMuted(settings.effectsMuted || paused);
  }, [settings.effectsMuted, paused]);
  useEffect(() => {
    if (!state || previous.current === state) return;
    const next = buildDuelCues(previous.current, state);
    previous.current = state;
    setQueue((current) => [...current, ...next]);
  }, [state]);
  useEffect(() => {
    if (!cue || paused) return;
    started.current = performance.now();
    if (sounded.current !== cue.id) {
      audio.current?.play(cue);
      sounded.current = cue.id;
    }
    const timer = window.setTimeout(
      () => setQueue((current) => current.slice(1)),
      cueDuration(cue, settings),
    );
    return () => window.clearTimeout(timer);
  }, [cue, paused, settings]);
  const skip = useCallback(() => {
    if (!paused && performance.now() - started.current >= 300)
      setQueue((current) => current.slice(1));
  }, [paused]);
  return {
    cue,
    announcement: cue?.announcement ?? null,
    inputLocked: !state || previous.current !== state || Boolean(cue),
    skip,
  };
}
