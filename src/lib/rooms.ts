// Room / seat helpers. Lobby creation & joining go through SECURITY DEFINER RPCs; seat and
// heartbeat updates write only the caller's own players row (RLS-allowed). See API.md.

import { supabase } from './supabaseClient';
import { GameApiError } from './api';
import type { Room, Player, Game, TeamColor, PlayerRole, GameErrorCode } from './types';

interface RpcEnvelope {
  error?: GameErrorCode;
  message?: string;
  room?: Room;
  player?: Player;
}

function unwrap(data: unknown): { room: Room; player: Player } {
  const env = data as RpcEnvelope | null;
  if (!env || env.error) {
    throw new GameApiError(env?.error ?? 'INTERNAL', env?.message ?? 'Request failed');
  }
  if (!env.room || !env.player) {
    throw new GameApiError('INTERNAL', 'Malformed response');
  }
  return { room: env.room, player: env.player };
}

export async function createRoom(displayName: string): Promise<{ room: Room; player: Player }> {
  const { data, error } = await supabase.rpc('create_room', { p_display_name: displayName });
  if (error) throw new GameApiError('INTERNAL', error.message);
  return unwrap(data);
}

export async function joinRoom(
  code: string,
  displayName: string,
): Promise<{ room: Room; player: Player }> {
  const { data, error } = await supabase.rpc('join_room', {
    p_code: code.trim().toUpperCase(),
    p_display_name: displayName,
  });
  if (error) throw new GameApiError('INTERNAL', error.message);
  return unwrap(data);
}

export async function updateSeat(
  playerId: string,
  patch: { team?: TeamColor; role?: PlayerRole },
): Promise<void> {
  const { error } = await supabase.from('players').update(patch).eq('id', playerId);
  if (error) throw new GameApiError('INTERNAL', error.message);
}

export async function heartbeat(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', playerId);
  if (error) throw new GameApiError('INTERNAL', error.message);
}

/** Start is allowed only when each team has at least one spymaster AND one operative. */
export function canStart(players: Player[]): boolean {
  const has = (team: TeamColor, role: PlayerRole) =>
    players.some((p) => p.team === team && p.role === role);
  return (
    has('cyan', 'spymaster') &&
    has('cyan', 'operative') &&
    has('amber', 'spymaster') &&
    has('amber', 'operative')
  );
}

/** Initial authoritative snapshot for a room: room row, roster, and the current game. */
export async function fetchRoomState(
  roomId: string,
): Promise<{ room: Room; players: Player[]; game: Game | null }> {
  const [roomRes, playersRes, gameRes] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('players').select('*').eq('room_id', roomId),
    supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (roomRes.error) throw new GameApiError('ROOM_NOT_FOUND', roomRes.error.message);
  if (playersRes.error) throw new GameApiError('INTERNAL', playersRes.error.message);
  return {
    room: roomRes.data as Room,
    players: (playersRes.data ?? []) as Player[],
    game: (gameRes.data as Game | null) ?? null,
  };
}
