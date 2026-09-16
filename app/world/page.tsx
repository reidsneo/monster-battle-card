import { Suspense } from 'react';
import { WorldClient } from '@/components/world-client';

export default function WorldPage() {
  return (
    <Suspense
      fallback={
        <main className="loading-screen">
          <p>Opening the town gates…</p>
        </main>
      }
    >
      <WorldClient />
    </Suspense>
  );
}
