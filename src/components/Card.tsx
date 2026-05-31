'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { Card as CardType, CardIdentity } from '@/lib/types';
import { AgentIcon, NeutralIcon, AssassinIcon } from '@/components/ui';

interface CardProps {
  card: CardType;
  spymasterIdentity?: CardIdentity;
  isSpymaster: boolean;
  canReveal: boolean;
  onReveal: (cardId: string) => void;
}

const IDENTITY_LABEL: Record<CardIdentity, string> = {
  cyan: 'Cyan agent',
  amber: 'Amber agent',
  neutral: 'Bystander',
  assassin: 'Assassin',
};

function identityIcon(identity: CardIdentity, className = 'h-5 w-5') {
  if (identity === 'assassin') return <AssassinIcon className={className} />;
  if (identity === 'neutral') return <NeutralIcon className={className} />;
  return <AgentIcon className={className} />;
}

function faceClasses(identity: CardIdentity): string {
  switch (identity) {
    case 'cyan':
      return 'bg-cyan text-cyan-fg';
    case 'amber':
      return 'bg-amber text-amber-fg';
    case 'neutral':
      return 'bg-neutral text-neutral-fg';
    case 'assassin':
      return 'bg-assassin text-assassin-fg';
  }
}

export function Card({ card, spymasterIdentity, isSpymaster, canReveal, onReveal }: CardProps) {
  const reduceMotion = useReducedMotion();
  const revealed = card.revealed && card.revealed_identity != null;
  const identity = card.revealed_identity ?? undefined;

  const interactive = canReveal && !card.revealed;

  const handleReveal = () => {
    if (interactive) onReveal(card.id);
  };

  // Spymaster sees an unrevealed-card tint + identity icon (never color alone).
  const showSpyHint = isSpymaster && !revealed && spymasterIdentity;

  const ariaLabel = revealed
    ? `${card.word} — ${identity ? IDENTITY_LABEL[identity] : 'revealed'}`
    : showSpyHint
      ? `${card.word} — secret ${IDENTITY_LABEL[spymasterIdentity!]}`
      : `${card.word}${interactive ? ', press to reveal' : ''}`;

  return (
    <motion.button
      type="button"
      onClick={handleReveal}
      disabled={!interactive}
      aria-label={ariaLabel}
      aria-pressed={revealed}
      className={
        'relative flex aspect-[5/3] min-h-16 w-full items-center justify-center rounded-2xl ' +
        'border border-border p-1 text-center transition-transform duration-200 ' +
        (interactive
          ? 'cursor-pointer hover:scale-[1.03] focus-visible:outline focus-visible:outline-3 focus-visible:outline-ring'
          : 'cursor-default') +
        ' ' +
        (revealed && identity
          ? faceClasses(identity)
          : showSpyHint
            ? spyTint(spymasterIdentity!)
            : 'bg-surface text-fg')
      }
      animate={reduceMotion ? undefined : { rotateY: revealed ? 360 : 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <span className="flex flex-col items-center gap-1">
        {(revealed && identity) && identityIcon(identity)}
        {showSpyHint && identityIcon(spymasterIdentity!, 'h-4 w-4 opacity-80')}
        <span className="px-1 text-xs font-semibold uppercase tracking-wide sm:text-sm">
          {card.word}
        </span>
      </span>
    </motion.button>
  );
}

function spyTint(identity: CardIdentity): string {
  switch (identity) {
    case 'cyan':
      return 'bg-cyan/15 text-fg ring-1 ring-cyan/40';
    case 'amber':
      return 'bg-amber/15 text-fg ring-1 ring-amber/40';
    case 'neutral':
      return 'bg-neutral/15 text-fg ring-1 ring-neutral/40';
    case 'assassin':
      return 'bg-assassin/20 text-fg ring-1 ring-assassin/50';
  }
}
