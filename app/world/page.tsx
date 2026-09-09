import { Suspense } from 'react';
import { WorldClient } from '@/components/world-client';

export default function WorldPage() {
  return <Suspense fallback={<main className="loading-screen"><p>Opening the ranch gate…</p></main>}><WorldClient /></Suspense>;
}
