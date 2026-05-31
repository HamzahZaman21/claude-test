'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Game, Card } from '@/lib/types';
import { Button, GlassPanel } from '@/components/ui';

interface GameSummaryProps {
  game: Game;
  cards: Card[];
  isHost: boolean;
  onRematch: () => void;
}

/** Full-screen win/loss overlay with the fully revealed board and a host Rematch CTA. */
export function GameSummary({ game, cards, isHost, onRematch }: GameSummaryProps) {
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  if (game.phase !== 'finished') return null;

  const winner = game.winner;
  const winColor = winner === 'cyan' ? 'text-cyan' : 'text-amber';
  const ordered = [...cards].sort((a, b) => a.position - b.position);

  const handleRematch = async () => {
    setBusy(true);
    try {
      await onRematch();
    } finally {
      setBusy(false);
    }
  };

  const faceClass = (c: Card) => {
    switch (c.revealed_identity) {
      case 'cyan':
        return 'bg-cyan text-cyan-fg';
      case 'amber':
        return 'bg-amber text-amber-fg';
      case 'assassin':
        return 'bg-assassin text-assassin-fg';
      default:
        return 'bg-neutral text-neutral-fg';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Game over"
    >
      <motion.div
        initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-2xl"
      >
        <GlassPanel className="flex flex-col items-center gap-5 p-6">
          <h2 className="text-center text-3xl font-bold" aria-live="assertive">
            <span className={winColor}>{winner?.toUpperCase()}</span> wins
          </h2>
          {/* Full board reveal */}
          <div className="grid w-full grid-cols-5 gap-1.5">
            {ordered.map((c) => (
              <div
                key={c.id}
                className={'flex aspect-[5/3] items-center justify-center rounded-lg px-1 text-center text-[10px] font-semibold uppercase sm:text-xs ' + faceClass(c)}
              >
                {c.word}
              </div>
            ))}
          </div>
          {isHost ? (
            <Button onClick={handleRematch} disabled={busy}>
              {busy ? 'Starting…' : 'Rematch'}
            </Button>
          ) : (
            <p className="text-sm text-fg-muted">Waiting for the host to start a rematch…</p>
          )}
        </GlassPanel>
      </motion.div>
    </div>
  );
}
