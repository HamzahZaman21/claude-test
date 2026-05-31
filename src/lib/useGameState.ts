'use client';

// Authoritative game-state hook: fetches the initial snapshot once, then applies realtime
// deltas. Re-fetches the full snapshot on (re)connect so a refreshed client renders the
// exact current state. spymasterKey is fetched from card_identities ONLY for spymasters
// (RLS returns rows only then). See TECHNICAL-DESIGN.md §5.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { fetchRoomState } from './rooms';
import { subscribeRoom, type PresenceMeta } from './realtime';
import type { Room, Game, Card, Clue, Player, CardIdentity } from './types';

export interface GameStateResult {
  room: Room | null;
  game: Game | null;
  cards: Card[];
  clue: Clue | null;
  players: Player[];
  presence: Record<string, PresenceMeta[]>;
  spymasterKey: Record<string, CardIdentity>;
  loading: boolean;
  error: string | null;
}

export function useGameState(roomId: string, localPlayer: Player | null): GameStateResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [clue, setClue] = useState<Clue | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceMeta[]>>({});
  const [spymasterKey, setSpymasterKey] = useState<Record<string, CardIdentity>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameIdRef = useRef<string | null>(null);
  const isSpymaster = localPlayer?.role === 'spymaster';

  const loadGameDetails = useCallback(async (g: Game | null) => {
    if (!g) {
      setCards([]);
      setClue(null);
      return;
    }
    const [cardsRes, clueRes] = await Promise.all([
      supabase.from('cards').select('*').eq('game_id', g.id).order('position', { ascending: true }),
      g.current_clue_id
        ? supabase.from('clues').select('*').eq('id', g.current_clue_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (cardsRes.data) setCards(cardsRes.data as Card[]);
    setClue((clueRes.data as Clue | null) ?? null);
  }, []);

  const loadSpymasterKey = useCallback(
    async (g: Game | null) => {
      if (!g || !isSpymaster) {
        setSpymasterKey({});
        return;
      }
      const { data } = await supabase
        .from('card_identities')
        .select('card_id, identity')
        .eq('game_id', g.id);
      const map: Record<string, CardIdentity> = {};
      (data ?? []).forEach((row) => {
        map[(row as { card_id: string }).card_id] = (row as { identity: CardIdentity }).identity;
      });
      setSpymasterKey(map);
    },
    [isSpymaster],
  );

  const snapshot = useCallback(async () => {
    try {
      const state = await fetchRoomState(roomId);
      setRoom(state.room);
      setPlayers(state.players);
      setGame(state.game);
      gameIdRef.current = state.game?.id ?? null;
      await Promise.all([loadGameDetails(state.game), loadSpymasterKey(state.game)]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load room');
    } finally {
      setLoading(false);
    }
  }, [roomId, loadGameDetails, loadSpymasterKey]);

  // Initial + reconnect snapshot.
  useEffect(() => {
    void snapshot();
  }, [snapshot]);

  // Realtime subscriptions. Re-subscribe when the active game id changes.
  useEffect(() => {
    if (!localPlayer) return;
    const presenceMeta: PresenceMeta = {
      player_id: localPlayer.id,
      display_name: localPlayer.display_name,
      team: localPlayer.team,
      role: localPlayer.role,
    };
    const unsub = subscribeRoom({
      roomId,
      gameId: gameIdRef.current,
      player: presenceMeta,
      handlers: {
        onGame: (g) => {
          const prevGameId = gameIdRef.current;
          setGame(g);
          if (g.id !== prevGameId) {
            // A new game started (or first load) — re-snapshot board + key.
            gameIdRef.current = g.id;
            void loadGameDetails(g);
            void loadSpymasterKey(g);
          } else {
            // Clue pointer may have changed; refresh the active clue cheaply.
            if (g.current_clue_id) {
              supabase
                .from('clues')
                .select('*')
                .eq('id', g.current_clue_id)
                .maybeSingle()
                .then(({ data }) => setClue((data as Clue | null) ?? null));
            } else {
              setClue(null);
            }
          }
        },
        onCard: (c) =>
          setCards((prev) => prev.map((card) => (card.id === c.id ? c : card))),
        onClue: (c) => setClue(c),
        onPlayers: () => {
          supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId)
            .then(({ data }) => {
              if (data) setPlayers(data as Player[]);
            });
        },
        onPresence: (state) => setPresence(state),
      },
    });
    return unsub;
    // Re-subscribe when the game id transitions from null → set (lobby → in_game).
  }, [roomId, localPlayer, loadGameDetails, loadSpymasterKey, game?.id]);

  return { room, game, cards, clue, players, presence, spymasterKey, loading, error };
}
