'use client';

import type { Game, GameTeam } from '@/lib/types';
import { AgentIcon } from '@/components/ui';

interface ScoreboardProps {
  game: Game;
}

function TeamChip({ team, remaining, active }: { team: GameTeam; remaining: number; active: boolean }) {
  const isCyan = team === 'cyan';
  return (
    <div
      className={
        'flex items-center gap-2 rounded-2xl border px-4 py-3 ' +
        (isCyan ? 'border-cyan/40 bg-cyan/10' : 'border-amber/40 bg-amber/10') +
        (active ? ' animate-turn-pulse ring-2 ' + (isCyan ? 'ring-cyan' : 'ring-amber') : '')
      }
    >
      <AgentIcon className={'h-5 w-5 ' + (isCyan ? 'text-cyan' : 'text-amber')} />
      <span className="font-semibold uppercase tracking-wide">{team}</span>
      <span className="font-mono text-2xl font-bold tabular-nums">{remaining}</span>
    </div>
  );
}

/** Team counters, whose-turn indicator, and remaining guesses — all from the streamed game row. */
export function Scoreboard({ game }: ScoreboardProps) {
  const phaseLabel =
    game.phase === 'finished'
      ? game.winner
        ? `${game.winner.toUpperCase()} wins`
        : 'Game over'
      : `${game.current_team.toUpperCase()} · ${game.phase === 'clue' ? 'clue phase' : 'guessing'}`;

  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <TeamChip team="cyan" remaining={game.cyan_remaining} active={game.phase !== 'finished' && game.current_team === 'cyan'} />
        <TeamChip team="amber" remaining={game.amber_remaining} active={game.phase !== 'finished' && game.current_team === 'amber'} />
      </div>
      <div className="flex items-center justify-between text-sm text-fg-muted">
        <span>{phaseLabel}</span>
        {game.phase === 'guess' && (
          <span className="font-mono">{game.guesses_remaining} guesses left</span>
        )}
      </div>
    </div>
  );
}
