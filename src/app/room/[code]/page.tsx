'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getAnonSession } from '@/lib/supabaseClient';
import { joinRoom, heartbeat } from '@/lib/rooms';
import { useGameState } from '@/lib/useGameState';
import * as api from '@/lib/api';
import type { Player, Room } from '@/lib/types';
import { Board } from '@/components/Board';
import { Scoreboard } from '@/components/Scoreboard';
import { TurnTimer } from '@/components/TurnTimer';
import { CluePanel } from '@/components/CluePanel';
import { PresenceBar } from '@/components/PresenceBar';
import { GameSummary } from '@/components/GameSummary';
import { Lobby } from '@/components/Lobby';
import { Button, GlassPanel } from '@/components/ui';

const NAME_KEY = 'decrypt.displayName';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [needName, setNeedName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (displayName: string) => {
      setError(null);
      try {
        await getAnonSession();
        const { room: r, player: p } = await joinRoom(code, displayName);
        setRoom(r);
        setPlayer(p);
        setNeedName(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not join room');
        setNeedName(true);
      }
    },
    [code],
  );

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(NAME_KEY) : null;
    if (saved) void resolve(saved);
    else setNeedName(true);
  }, [resolve]);

  if (needName || !room || !player) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <GlassPanel className="flex w-full max-w-sm flex-col gap-4 p-6">
          <h1 className="text-center text-lg font-semibold">
            Join room <span className="font-mono tracking-widest text-cyan">{code}</span>
          </h1>
          <input
            type="text"
            value={nameInput}
            maxLength={24}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Display name"
            className="min-h-11 rounded-xl border border-border bg-surface px-3 text-fg"
          />
          <Button
            onClick={() => {
              if (!nameInput.trim()) return;
              if (typeof window !== 'undefined') localStorage.setItem(NAME_KEY, nameInput.trim());
              void resolve(nameInput.trim());
            }}
          >
            Join
          </Button>
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
        </GlassPanel>
      </main>
    );
  }

  return <GameRoom room={room} localPlayer={player} />;
}

function GameRoom({ room, localPlayer }: { room: Room; localPlayer: Player }) {
  const state = useGameState(room.id, localPlayer.id);
  const [actionError, setActionError] = useState<string | null>(null);
  const pending = useRef<Set<string>>(new Set());

  // Presence heartbeat so last_seen_at stays fresh.
  useEffect(() => {
    const id = setInterval(() => void heartbeat(localPlayer.id).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [localPlayer.id]);

  const game = state.game;
  const me = state.players.find((p) => p.id === localPlayer.id) ?? localPlayer;

  const flash = (e: unknown) =>
    setActionError(e instanceof Error ? e.message : 'Action failed');

  const onStart = useCallback(async () => {
    try {
      await api.startGame(room.id);
      // Safety net: pull the authoritative snapshot in case the realtime INSERT is missed.
      await state.refresh();
    } catch (e) {
      flash(e);
      throw e;
    }
  }, [room.id, state]);

  const onReveal = useCallback(
    async (cardId: string) => {
      if (!game || pending.current.has(cardId)) return;
      pending.current.add(cardId);
      setActionError(null);
      try {
        await api.revealCard(game.id, cardId);
      } catch (e) {
        flash(e);
      } finally {
        pending.current.delete(cardId);
      }
    },
    [game],
  );

  const onSubmitClue = useCallback(
    async (word: string, num: number) => {
      if (!game) return;
      await api.submitClue(game.id, word, num);
    },
    [game],
  );

  const onExpire = useCallback(() => {
    if (game) void api.expireTurn(game.id).catch(() => {});
  }, [game]);

  const onRematch = useCallback(async () => {
    try {
      await api.rematch(room.id);
      await state.refresh();
    } catch (e) {
      flash(e);
    }
  }, [room.id, state]);

  if (state.loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-fg-muted">Loading room…</p>
      </main>
    );
  }

  const liveRoom = state.room ?? room;

  // Lobby view until an authoritative game exists. The `games` table is realtime-published,
  // so the game INSERT from start_game/rematch flips every client into the board view —
  // we do NOT depend on room.status (which also updates now, but the game is the source of truth).
  if (!game) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <Lobby room={liveRoom} players={state.players} localPlayer={me} onStart={onStart} />
      </main>
    );
  }

  const isSpymaster = me.role === 'spymaster';
  const canReveal =
    game.phase === 'guess' && me.role === 'operative' && me.team === game.current_team;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 p-4">
      <a href="#board" className="sr-only focus:not-sr-only">Skip to board</a>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Scoreboard game={game} />
        <TurnTimer game={game} onExpire={onExpire} />
      </div>

      <CluePanel game={game} clue={state.clue} localPlayer={me} onSubmit={onSubmitClue} />

      <Board
        cards={state.cards}
        spymasterKey={state.spymasterKey}
        isSpymaster={isSpymaster}
        canReveal={canReveal}
        onReveal={onReveal}
      />

      <PresenceBar players={state.players} presence={state.presence} />

      {actionError && (
        <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error" role="alert">
          {actionError}
        </p>
      )}

      <GameSummary game={game} cards={state.cards} isHost={me.is_host} onRematch={onRematch} />
    </main>
  );
}
