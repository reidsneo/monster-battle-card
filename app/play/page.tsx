import { Suspense } from 'react';
import { GameClient } from '@/components/game-client';

export default function PlayPage() {
  return <Suspense fallback={<main className="loading-screen"><p>Preparing match…</p></main>}><GameClient /></Suspense>;
}
