'use client';

import { useState } from 'react';
import type { Room, Player, TeamColor, PlayerRole } from '@/lib/types';
import { updateSeat, canStart } from '@/lib/rooms';
import { Button, GlassPanel, CopyIcon, CheckIcon, SpymasterIcon, AgentIcon } from '@/components/ui';
import { PresenceBar } from './PresenceBar';

interface LobbyProps {
  room: Room;
  players: Player[];
  localPlayer: Player;
  onStart: () => Promise<void>;
}

const TEAMS: TeamColor[] = ['cyan', 'amber'];
const ROLES: PlayerRole[] = ['spymaster', 'operative'];

export function Lobby({ room, players, localPlayer, onStart }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = players.find((p) => p.id === localPlayer.id) ?? localPlayer;
  const ready = canStart(players);
  const isHost = me.is_host;

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/room/${room.code}` : `/room/${room.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const pick = async (patch: { team?: TeamColor; role?: PlayerRole }) => {
    setError(null);
    try {
      await updateSeat(me.id, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update seat');
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      await onStart();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
      setStarting(false);
    }
  };

  return (
    <GlassPanel className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm uppercase tracking-widest text-fg-muted">Room code</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-4xl font-bold tracking-[0.3em]">{room.code}</span>
          <Button variant="ghost" size="md" onClick={copy} aria-label="Copy invite link">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
        <p className="break-all text-center text-xs text-fg-muted">{shareUrl}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">Players</h3>
        <PresenceBar players={players} presence={{}} />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-fg-muted">Team</p>
          <div className="flex gap-2">
            {TEAMS.map((t) => (
              <Button
                key={t}
                variant={me.team === t ? (t === 'cyan' ? 'primary' : 'secondary') : 'ghost'}
                onClick={() => pick({ team: t })}
              >
                {t.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-fg-muted">Role</p>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <Button
                key={r}
                variant={me.role === r ? 'primary' : 'ghost'}
                onClick={() => pick({ role: r })}
              >
                {r === 'spymaster' ? <SpymasterIcon /> : <AgentIcon />}
                {r}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button onClick={handleStart} disabled={!ready || starting} size="lg">
            {starting ? 'Starting…' : 'Start game'}
          </Button>
          {!ready && (
            <p className="text-center text-xs text-fg-muted">
              Each team needs at least one spymaster and one operative.
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-fg-muted">Waiting for the host to start…</p>
      )}
    </GlassPanel>
  );
}
