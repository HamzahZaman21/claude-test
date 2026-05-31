'use client';

import type { Player, TeamColor } from '@/lib/types';
import { SpymasterIcon, AgentIcon } from '@/components/ui';

interface PresenceBarProps {
  players: Player[];
  presence: Record<string, unknown>;
}

function teamColor(team: TeamColor): string {
  if (team === 'cyan') return 'text-cyan';
  if (team === 'amber') return 'text-amber';
  return 'text-fg-muted';
}

/** Online roster grouped visually; each player shows a presence dot + role icon + name. */
export function PresenceBar({ players, presence }: PresenceBarProps) {
  const online = (playerId: string) => Boolean(presence && playerId in presence);

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Players">
      {players.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-1.5 text-sm"
        >
          <span
            className={
              'inline-block h-2 w-2 rounded-full ' +
              (online(p.id) ? 'bg-success' : 'bg-fg-muted/40')
            }
            aria-label={online(p.id) ? 'online' : 'offline'}
            title={online(p.id) ? 'online' : 'offline'}
          />
          {p.role === 'spymaster' ? (
            <SpymasterIcon className={'h-4 w-4 ' + teamColor(p.team)} />
          ) : (
            <AgentIcon className={'h-4 w-4 ' + teamColor(p.team)} />
          )}
          <span className="font-medium">{p.display_name}</span>
          {p.is_host && <span className="text-xs text-fg-muted">(host)</span>}
        </li>
      ))}
    </ul>
  );
}
