// Shared helpers for the authoritative game Edge Functions.
// NOTE: The deployed functions (via the Supabase MCP) inline these helpers so each
// function is self-contained. This module documents the canonical implementation and
// may be used if the functions are redeployed from local source with an import map.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401, NOT_A_MEMBER: 403, NOT_HOST: 403, NOT_YOUR_TURN: 403,
  WRONG_ROLE: 403, WRONG_PHASE: 409, INVALID_CLUE: 400, INVALID_INPUT: 400,
  ROSTER_INCOMPLETE: 400, ROOM_NOT_FOUND: 404, GAME_NOT_FOUND: 404,
  CARD_NOT_FOUND: 404, ALREADY_REVEALED: 409, ALREADY_STARTED: 409, INTERNAL: 500,
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
