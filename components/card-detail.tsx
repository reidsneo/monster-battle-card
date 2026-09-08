'use client';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CARD_BY_ID, MONSTER_BY_ID } from '@/lib/game/cards';

export function CardDetail({ id, open, onOpenChange }: { id: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!id) return null;
  const card = CARD_BY_ID[id];
  const monster = MONSTER_BY_ID[id];
  const title = card?.name ?? monster?.name ?? `Card ${id}`;
  const image = card?.image ?? monster?.image ?? `/card-art/detail/${id}.webp`;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="card-dialog"><img src={image} alt={`${title} card`} /><div><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{card ? `${card.owner} ${card.type} skill` : monster ? `${monster.attribute} monster · ${monster.life} Life` : 'Archive card'}</DialogDescription></DialogHeader>{card && <><div className="detail-badges"><Badge>{card.guts} GUTS</Badge>{card.damage !== null && <Badge variant="secondary">{card.damage} DAMAGE</Badge>}<Badge variant="outline">#{card.id}</Badge></div><p>{card.text || 'A straightforward move with no additional effect.'}</p></>}{monster && <><div className="detail-badges"><Badge>{monster.life} LIFE</Badge><Badge variant="secondary">{monster.attribute.toUpperCase()}</Badge></div><p>{monster.mainBreed} main breed · {monster.subBreed} sub breed</p></>}</div></DialogContent></Dialog>;
}
