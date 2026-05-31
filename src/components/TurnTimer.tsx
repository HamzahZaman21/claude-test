'use client';

import { useEffect, useRef, useState } from 'react';
import type { Game } from '@/lib/types';

interface TurnTimerProps {
  game: Game;
  onExpire: () => void;
}

const RADIUS = 26;
const CIRC = 2 * Math.PI * RADIUS;
// Phase windows (mirrors .env.config / server intervals) used only to scale the ring.
const PHASE_SECONDS = { clue: 90, guess: 60 } as const;

function secondsLeft(deadlineIso: string): number {
  return Math.max(0, (new Date(deadlineIso).getTime() - Date.now()) / 1000);
}

/** Server-anchored countdown ring derived from game.turn_deadline. Calls onExpire once at 0. */
export function TurnTimer({ game, onExpire }: TurnTimerProps) {
  const [remaining, setRemaining] = useState(() => secondsLeft(game.turn_deadline));
  const firedFor = useRef<string>('');

  useEffect(() => {
    // Reset the expiry guard whenever the deadline changes (new turn/phase).
    firedFor.current = '';
  }, [game.turn_deadline]);

  useEffect(() => {
    if (game.phase === 'finished') return;
    const tick = () => {
      const left = secondsLeft(game.turn_deadline);
      setRemaining(left);
      if (left <= 0 && firedFor.current !== game.turn_deadline) {
        firedFor.current = game.turn_deadline;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game.turn_deadline, game.phase, onExpire]);

  if (game.phase === 'finished') return null;

  const total = game.phase === 'clue' ? PHASE_SECONDS.clue : PHASE_SECONDS.guess;
  const frac = Math.min(1, Math.max(0, remaining / total));
  const isCyan = game.current_team === 'cyan';
  const color = isCyan ? 'var(--color-cyan)' : 'var(--color-amber)';
  const mm = Math.floor(remaining / 60);
  const ss = Math.floor(remaining % 60);
  const label = `${mm}:${ss.toString().padStart(2, '0')}`;

  return (
    <div className="relative flex h-16 w-16 items-center justify-center" role="timer" aria-label={`${label} remaining`}>
      <svg className="absolute -rotate-90" width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 250ms linear' }}
        />
      </svg>
      <span className="font-mono text-sm font-semibold tabular-nums">{label}</span>
    </div>
  );
}
