import { ExternalLink } from 'lucide-react';
import { AppNav } from '@/components/app-nav';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { buttonVariants } from '@/components/ui/button';

const sections = [
  ['1. Build and begin', 'Each deck has three uniquely named monsters and exactly 50 skill cards, with no more than three copies of a card. Draw five. Randomly choose the first player; the second player may place up to two cards as opening Guts.'],
  ['2. Draw to five', 'At the beginning of your turn, replenish your hand to exactly five. The first player skips this on turn one. If you already have five, move the top deck card to Guts. If you cannot complete the required draw, you lose.'],
  ['3. Attack', 'Each living monster may normally attack once. Pay Guts from the top of your stack, choose a legal target, and follow the card. Breeder cards are limited to one per turn.'],
  ['4. Defend in order', 'The target may play any number of legal Dodge and Block responses, one at a time. Resolve each response before choosing another. Cards that cannot be dodged still allow compatible Blocks.'],
  ['5. Resolve damage', 'Check targets and taunts, calculate base/additive/multiplier damage, apply Environment rules, pay Guts, distribute or expand area damage, resolve defenses, then apply reflected and self-damage. Rounding favors the player who did not play the effect.'],
  ['6. Bank Guts and end', 'After attacking, place any remaining hand cards onto your Guts stack in the order you choose, or keep them. Reset turn limits and pass play. The top of the stack is spent first.'],
  ['7. Winning and edge cases', 'KO all three opposing monsters or make the opponent fail a required draw. Statuses remain through KO and revival. If the final monsters are knocked out simultaneously, the attacking player wins.'],
];

export default function RulesPage() {
  return (
    <main className="rules-shell">
      <AppNav />
      <section className="page-hero">
        <p className="eyebrow">BREEDER FIELD MANUAL // v3.1</p><h1>Learn at the table.</h1>
        <p>A concise reference for the local implementation. The supplied translated rulebook remains the primary authority.</p>
        <a className={buttonVariants()} href="/docs/MFBC-Rule-Book-v3.1.pdf" target="_blank" rel="noreferrer">Open complete rulebook <ExternalLink /></a>
      </section>
      <section className="rules-grid">
        <div className="turn-loop"><span>DRAW</span><i>→</i><span>ATTACK</span><i>→</i><span>GUTS</span><i>→</i><span>PASS</span></div>
        <Accordion defaultValue={['item-0']}>{sections.map(([title, body], index) => <AccordionItem key={title} value={`item-${index}`}><AccordionTrigger>{title}</AccordionTrigger><AccordionContent>{body}</AccordionContent></AccordionItem>)}</Accordion>
        <aside className="rules-note"><strong>Implementation authority</strong><p>The local v3.1 PDF controls the base rules. Current card text controls individual effects. LegendCup’s documented addendum controls ambiguous interaction order.</p><small>This is a private, offline, noncommercial fan restoration. Card imagery and reference data are not packaged for public redistribution.</small></aside>
      </section>
    </main>
  );
}
