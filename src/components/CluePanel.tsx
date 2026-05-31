'use client';

import { useState } from 'react';
import type { Game, Clue, Player } from '@/lib/types';
import { validateClue } from '@/lib/engine';
import { Button, GlassPanel, SpymasterIcon } from '@/components/ui';

interface CluePanelProps {
  game: Game;
  clue: Clue | null;
  localPlayer: Player;
  onSubmit: (word: string, num: number) => Promise<void>;
}

/** Spymaster clue input (own clue phase) or current-clue display for everyone else. */
export function CluePanel({ game, clue, localPlayer, onSubmit }: CluePanelProps) {
  const [word, setWord] = useState('');
  const [num, setNum] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const myTurn = game.current_team === localPlayer.team;
  const canGiveClue =
    game.phase === 'clue' && myTurn && localPlayer.role === 'spymaster';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateClue(word, num);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(word.trim(), num);
      setWord('');
      setNum(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit clue');
    } finally {
      setSubmitting(false);
    }
  };

  if (canGiveClue) {
    return (
      <GlassPanel className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
            <SpymasterIcon className="h-4 w-4" /> Your clue
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="One word"
              aria-label="Clue word"
              className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3 font-mono uppercase tracking-wide text-fg focus-visible:outline focus-visible:outline-3 focus-visible:outline-ring"
            />
            <select
              value={num}
              onChange={(e) => setNum(Number(e.target.value))}
              aria-label="Number of cards"
              className="min-h-11 rounded-xl border border-border bg-surface px-3 font-mono text-fg focus-visible:outline focus-visible:outline-3 focus-visible:outline-ring"
            >
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Give clue'}
          </Button>
        </form>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="flex items-center justify-between p-4">
      {clue ? (
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-2xl font-bold uppercase tracking-widest">{clue.word}</span>
          <span className="font-mono text-xl text-fg-muted">{clue.number}</span>
        </div>
      ) : (
        <span className="text-fg-muted">
          {game.phase === 'clue'
            ? `Waiting for ${game.current_team.toUpperCase()} spymaster…`
            : 'No active clue'}
        </span>
      )}
      {game.phase === 'guess' && (
        <span className="font-mono text-sm text-fg-muted">{game.guesses_remaining} left</span>
      )}
    </GlassPanel>
  );
}
