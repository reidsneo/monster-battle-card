import Link from 'next/link';
import { BookOpen, Layers3, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppNav({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`topbar ${compact ? 'topbar-compact' : ''}`}>
      <Link href="/" className="brand" aria-label="Monster Battle Card home">
        <span className="brand-mark">MR</span><span><strong>Battle Card</strong><small>Local restoration</small></span>
      </Link>
      <nav aria-label="Game navigation">
        <Button nativeButton={false} render={<Link href="/cards" />} variant="ghost" size="sm"><Layers3 /> Cards</Button>
        <Button nativeButton={false} render={<Link href="/rules" />} variant="ghost" size="sm"><BookOpen /> Rules</Button>
        <Button nativeButton={false} render={<Link href="/replays" />} variant="ghost" size="sm"><RotateCcw /> Replays</Button>
      </nav>
    </header>
  );
}
