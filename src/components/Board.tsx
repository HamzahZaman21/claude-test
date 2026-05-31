'use client';

import type { Card as CardType, CardIdentity } from '@/lib/types';
import { Card } from './Card';

interface BoardProps {
  cards: CardType[];
  spymasterKey: Record<string, CardIdentity>;
  isSpymaster: boolean;
  canReveal: boolean;
  onReveal: (cardId: string) => void;
}

/** Responsive 5×5 grid of cards, rendered from authoritative state (sorted by position). */
export function Board({ cards, spymasterKey, isSpymaster, canReveal, onReveal }: BoardProps) {
  const ordered = [...cards].sort((a, b) => a.position - b.position);
  return (
    <div
      id="board"
      role="grid"
      aria-label="Decrypt board, 5 by 5"
      className="grid w-full grid-cols-5 gap-2 sm:gap-3"
    >
      {ordered.map((card) => (
        <Card
          key={card.id}
          card={card}
          spymasterIdentity={spymasterKey[card.id]}
          isSpymaster={isSpymaster}
          canReveal={canReveal}
          onReveal={onReveal}
        />
      ))}
    </div>
  );
}
