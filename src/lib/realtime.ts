// Realtime subscriptions + presence. Opens Postgres Changes channels on games/players
// (filtered by room) and cards/clues (filtered by game), plus a presence channel per room.
// Returns an unsubscribe function. See LIBRARIES.md for the exact call shapes.

import { supabase } from './supabaseClient';
import type { Game, Card, Clue, TeamColor, PlayerRole } from './types';

export type PresenceMeta = {
  player_id: string;
  display_name: string;
  team: TeamColor;
  role: PlayerRole;
};

export interface GameHandlers {
  onGame?: (g: Game) => void;
  onCard?: (c: Card) => void;
  onClue?: (c: Clue) => void;
  onPlayers?: () => void;
  onPresence?: (state: Record<string, PresenceMeta[]>) => void;
}

export function subscribeRoom(opts: {
  roomId: string;
  gameId: string | null;
  player: PresenceMeta;
  handlers: GameHandlers;
}): () => void {
  const { roomId, gameId, player, handlers } = opts;

  const dataChannel = supabase.channel(`room:${roomId}`);

  dataChannel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` },
    (payload) => handlers.onGame?.(payload.new as Game),
  );
  dataChannel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
    () => handlers.onPlayers?.(),
  );
  if (gameId) {
    dataChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cards', filter: `game_id=eq.${gameId}` },
      (payload) => handlers.onCard?.(payload.new as Card),
    );
    dataChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'clues', filter: `game_id=eq.${gameId}` },
      (payload) => handlers.onClue?.(payload.new as Clue),
    );
  }
  dataChannel.subscribe();

  // Presence channel keyed by player id.
  const presenceChannel = supabase.channel(`presence:${roomId}`, {
    config: { presence: { key: player.player_id } },
  });
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState() as unknown as Record<string, PresenceMeta[]>;
      handlers.onPresence?.(state);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track(player);
      }
    });

  return () => {
    supabase.removeChannel(dataChannel);
    supabase.removeChannel(presenceChannel);
  };
}
