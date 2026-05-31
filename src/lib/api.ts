// Typed wrappers around the authoritative Edge Functions. Clients mutate game state ONLY
// through these — never by writing game tables directly. Each normalizes the GameError
// envelope into a thrown GameApiError. See API.md / TECHNICAL-DESIGN.md §4.

import { supabase } from './supabaseClient';
import type { Game, Clue, Card, GameErrorCode } from './types';

export class GameApiError extends Error {
  code: GameErrorCode;
  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameApiError';
    this.code = code;
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // FunctionsHttpError carries the typed body on error.context (a Response).
    let payload: { error?: GameErrorCode; message?: string } | undefined;
    try {
      const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (ctx?.json) payload = (await ctx.json()) as typeof payload;
    } catch {
      // ignore — fall back to the generic error below
    }
    throw new GameApiError(payload?.error ?? 'INTERNAL', payload?.message ?? error.message);
  }
  // A 2xx response could still theoretically carry an error envelope; guard for safety.
  const maybe = data as { error?: GameErrorCode; message?: string } | null;
  if (maybe && maybe.error) {
    throw new GameApiError(maybe.error, maybe.message ?? 'Request failed');
  }
  return data as T;
}

export function startGame(roomId: string): Promise<{ game: Game }> {
  return invoke('start_game', { room_id: roomId });
}

export function submitClue(
  gameId: string,
  word: string,
  num: number,
): Promise<{ game: Game; clue: Clue }> {
  return invoke('submit_clue', { game_id: gameId, word, number: num });
}

export function revealCard(gameId: string, cardId: string): Promise<{ game: Game; card: Card }> {
  return invoke('reveal_card', { game_id: gameId, card_id: cardId });
}

export function endTurn(gameId: string): Promise<{ game: Game }> {
  return invoke('end_turn', { game_id: gameId });
}

export function expireTurn(gameId: string): Promise<{ game: Game }> {
  return invoke('expire_turn', { game_id: gameId });
}

export function rematch(roomId: string): Promise<{ game: Game }> {
  return invoke('rematch', { room_id: roomId });
}
