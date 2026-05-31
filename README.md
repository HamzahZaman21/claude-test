# Decrypt

A real-time, browser-based multiplayer word-deduction party game. Two teams (Cyan and
Amber) race to identify their secret agents on a shared 5×5 word grid, guided by one-word
clues from their team's Spymaster. Built around a single **authoritative server state**
streamed to every client so all browsers always agree — no desync, with RLS-enforced
anti-cheat (operatives can never learn unrevealed card identities).

## Stack
- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · Framer Motion
- **Backend:** Supabase — Postgres + RLS, anonymous Auth, Realtime (Postgres Changes + Presence),
  and Edge Functions (Deno) for all authoritative game mutations
- **Hosting:** Vercel (frontend) · Supabase (managed backend)
- **Tests:** Vitest (pure game-engine unit tests) · Playwright (Phase E e2e/visual)

## Architecture (short version)
- Pure game rules live in `src/lib/engine.ts` (unit-tested, 100% of the reveal rule table).
- Clients **never** write game tables. Every mutation goes through an Edge Function
  (`start_game`, `submit_clue`, `reveal_card`, `end_turn`, `expire_turn`, `rematch`) which
  verifies the JWT and calls a `SECURITY DEFINER` Postgres RPC (atomic, row-locked).
- Unrevealed card identities live in `card_identities`, readable by a same-game Spymaster
  only (RLS). The turn timer is server-anchored (`games.turn_deadline`).
- Clients fetch an initial snapshot then render from realtime deltas (`src/lib/useGameState.ts`).

See `ARCHITECTURE.md`, `SCHEMA.md`, `API.md`, and `TECHNICAL-DESIGN.md` for the full design.

## Local development
```bash
npm install
npm run dev        # http://localhost:3000
```
Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(and `NEXT_PUBLIC_APP_URL`). The Supabase project must have **anonymous sign-ins enabled**.

## Commands
| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` / `npx vitest run` | Unit tests (game engine) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run e2e` | Playwright e2e (needs the dev server) |
| `node e2e/integration-check.mjs` | Backend RLS / anti-cheat integration check |

## How to play
1. Open the app, enter a display name, **Create room** (or **Join** with a 6-char code).
2. Share the room code/URL. Each player picks a team (Cyan/Amber) and a role
   (Spymaster/Operative). Each team needs ≥1 Spymaster and ≥1 Operative.
3. The host starts the game. Spymasters see the secret key; operatives see only words.
4. The active Spymaster gives a one-word clue + a number N; their operatives guess up to
   N+1 cards. Own agent → keep going; neutral → turn ends; opponent → turn ends; assassin →
   instant loss. First team to reveal all its agents wins.
