# Architecture Overview — Decrypt

## Tech Stack
- **Frontend:** Next.js (App Router, latest stable) + React + TypeScript (strict).
- **Styling:** Tailwind CSS with a token-driven design system (see DESIGN-SYSTEM.md);
  Framer Motion for animation.
- **Backend / Data:** Supabase — Postgres (data), Auth (anonymous sign-in), Realtime
  (Postgres Changes + Presence), Row Level Security (authorization), Edge Functions
  (Deno, TypeScript) for authoritative game mutations.
- **Hosting:** Vercel (Next.js frontend + serverless), Supabase (managed backend).
- **Testing:** Vitest (unit/logic — the per-task engine test command), Playwright
  (Phase E end-to-end, including multi-browser-context sync tests).

## Folder Structure
```
src/
  app/
    page.tsx                  Landing: create / join room
    room/[code]/page.tsx      Lobby + game container (client component)
    layout.tsx, globals.css   Root layout, Tailwind + design tokens
  components/
    Lobby.tsx, Board.tsx, Card.tsx, CluePanel.tsx, TurnTimer.tsx,
    Scoreboard.tsx, PresenceBar.tsx, GameSummary.tsx
    ui/                       Token-driven primitives (GlassPanel, Button, …)
  lib/
    types.ts                  Shared TS types (mirror of generated DB types)
    database.types.ts         Supabase-generated types
    supabaseClient.ts         Browser client + anonymous session
    engine.ts                 PURE game-rule functions (unit-tested)
    api.ts                    Typed Edge Function wrappers
    rooms.ts                  create/join/seat helpers (RPC + own-row writes)
    realtime.ts               Subscriptions + presence
    useGameState.ts           Snapshot + realtime delta hook
    words.ts                  Bundled original word list
  test/                       Vitest unit specs (engine, validation)
supabase/
  migrations/                 SQL migrations (schema, RLS, publication, RPC)
  functions/                  Edge Functions: start_game, submit_clue, reveal_card,
                              end_turn, expire_turn, rematch (+ _shared/)
e2e/                          Playwright multi-context sync specs (Phase E)
```

## Data Flow
```
User action (button/card click)
  → client calls Edge Function via functions.invoke (JWT forwarded)
  → Edge Function verifies JWT, resolves player, validates role/team/phase/turn
  → SECURITY DEFINER RPC mutates Postgres atomically (service role)
  → Postgres Realtime streams the changed rows to ALL subscribed clients
  → every client re-renders from the streamed authoritative state
```
Reads: clients fetch an initial authoritative snapshot, then apply realtime deltas.
Optimistic UI is reconciled against the next broadcast.

## External Services
- **Supabase** → Postgres + Auth + Realtime + RLS + Edge Functions. Configured via the
  Supabase MCP and `NEXT_PUBLIC_*` / service-role env vars. Project ref `xjtggteqeahlzxrrwdgq`.
- **Vercel** → hosting/deploy. `VERCEL_TOKEN` for CLI deploys; project env vars set in
  Phase F.
- **GitHub** → source repository (`origin` remote already configured).

## Key Constraints
- **Clients are never the source of truth.** All game mutations go through Edge Functions
  (service role) guarded by validation + RLS. No client-writable policy exists on `games`,
  `cards`, `card_identities`, or `clues`.
- **The turn timer is server-anchored** (a `turn_deadline` timestamp); clients render
  remaining time from it and never run an authoritative countdown.
- **Unrevealed card identities** live in a separate `card_identities` table whose RLS
  permits SELECT only to a same-game Spymaster. Hiding in the UI is not security.
- **Idempotent mutations:** reveal/expire re-validate state in-transaction; duplicate or
  out-of-order events cannot corrupt state.
- All async operations have error handling with typed errors; internal errors are never
  leaked to the client.
- Components are presentational where possible; data access flows through `src/lib/`.
