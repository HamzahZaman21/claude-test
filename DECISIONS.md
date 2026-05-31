# Architecture Decision Records — Decrypt

## ADR-001: Authoritative server-side game logic via Edge Functions + RLS (2026-05-31)
Decision: All game-mutating actions (start, clue, reveal, end-turn, expire, rematch) run in
Supabase Edge Functions with the service role, delegating to SECURITY DEFINER Postgres RPCs.
Clients never compute or write authoritative state.
Reason: The only reliable way to guarantee every browser agrees and to prevent cheating/peeking.
Directly solves the "browsers out of sync" problem and is the anti-cheat foundation.
Rejected: Client-side state with optimistic sync (desyncs, trivially cheatable); a custom
WebSocket server (more infra, no RLS integration).
Status: Active. Reversibility: Major rewrite.

## ADR-002: Supabase Realtime (Postgres Changes + Presence) for live updates (2026-05-31)
Decision: Clients subscribe to Postgres Changes on `games`/`cards`/`clues`/`players` and a
presence channel per room; they render from streamed authoritative rows.
Reason: Managed, low-latency, integrates with Postgres + RLS; no custom socket server.
Rejected: Supabase Broadcast-only (would re-implement state diffing); polling (latency, load).
Status: Active. Reversibility: Moderate.

## ADR-003: Card identities in a separate RLS-restricted table (2026-05-31)
Decision: Split cards into public `cards` (word/position/revealed/revealed_identity) and secret
`card_identities` (true identity), the latter readable only by a same-game Spymaster. On reveal,
the Edge Function copies the identity into `cards.revealed_identity` so all clients see the flip.
Reason: Postgres RLS is row-level, not column-level; a separate table cleanly enforces "only
Spymasters read unrevealed identities" at the data layer. Hiding in the UI is not security —
operatives could read the network/DB.
Rejected: Single cards table with a nullable identity column (cannot column-restrict via RLS);
encrypting identities client-side (key distribution problem).
Status: Active. Reversibility: Moderate.

## ADR-004: Server-anchored turn timer (2026-05-31)
Decision: Store `games.turn_deadline` (timestamp); clients render remaining time from it. A
client observing expiry calls the idempotent `expire_turn` function to advance the turn.
Reason: All clients must agree on time remaining; client countdowns drift and disagree.
Rejected: Per-client countdowns (drift, disagreement); a server cron ticking every game (extra
infra for MVP). Reversibility: Easy.

## ADR-005: Counters stored on the games row (2026-05-31)
Decision: `games.cyan_remaining`/`amber_remaining`/`guesses_remaining` are maintained by the
server and streamed to clients.
Reason: Operatives cannot read card identities (RLS), so they cannot derive remaining agent
counts client-side. Storing them on the streamed games row keeps every client's counts identical
without leaking the key. Rejected: Computing counts client-side (impossible without identities;
would require leaking the secret). Reversibility: Easy.

## ADR-006: Next.js (App Router) on Vercel + Supabase (2026-05-31)
Decision: Next.js App Router + React + TypeScript on Vercel; Supabase managed backend.
Reason: Fast path to a production, shareable, deployed multiplayer app; strong exercise of the
full Supabase + Vercel toolchain. Rejected: SPA + separate API (more glue); other hosts (weaker
Next integration). Reversibility: Major rewrite.

## ADR-007: Anonymous authentication (2026-05-31)
Decision: Supabase anonymous sign-in; display name chosen per room.
Reason: Zero-friction for players (just open a link) while still giving each player a real,
RLS-scoped identity (`auth.uid()`). Rejected: Email/password (friction for a party game);
no-auth (no RLS identity, can't scope rows). Reversibility: Easy (can link to email later).

## ADR-008: Pure game-rule engine extracted for unit testing (2026-05-31)
Decision: Board generation, clue validation, and reveal-outcome math live as pure functions in
`src/lib/engine.ts`; the per-task DeepSeek test command is `npx vitest run` against them.
Reason: The engine workers run in isolated worktrees with no DB/browser; rule correctness must
be verifiable headlessly and fast. The Edge Function RPCs mirror the same semantics.
Rejected: Testing rules only through the live DB (slow, not available to workers).
Status: Active. Reversibility: Easy.
