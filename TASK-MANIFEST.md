# Task Manifest — Decrypt

## Project Status
Phase: plan → build
Last Updated: 2026-05-31
Overall Progress: 0 of 20 tasks complete

## Parallel Execution Strategy
The forge engine runs each task in its own git worktree and merges verified branches back
to `main` under a serializing lock. **Parallel tasks touch strictly disjoint files** (no
two tasks below share a file). Dependencies serialize logically-dependent work so a worker
sees its dependencies' real interfaces in `main` when it starts.

Backend is already provisioned (Phase B): Postgres schema + RLS, realtime publication, the
`create_room`/`join_room` RPCs, the service-role-only authoritative `rpc_*` functions, and
six deployed Edge Functions (`start_game`, `submit_clue`, `reveal_card`, `end_turn`,
`expire_turn`, `rematch`). Generated types live in `src/lib/database.types.ts`. These tasks
build the **frontend, client library, and pure game engine** only.

Per-task test command: `npx vitest run` (Vitest v3, jsdom, `passWithNoTests`). The only
unit-test file is `src/test/engine.test.ts`, created together with `src/lib/engine.ts` in
TASK-002. Components are verified by Playwright in Phase E, not unit tests.

Conventions every task must follow: TypeScript strict; client components that use hooks/
state/realtime start with `"use client"`; Tailwind **v4** (tokens via `@theme` in
globals.css — NO `tailwind.config.js`); SVG icons only; respect `prefers-reduced-motion`;
never read `card_identities` except as a spymaster; never write game tables directly (call
the Edge Function wrappers in `src/lib/api.ts`). See @CLAUDE.md, @TECHNICAL-DESIGN.md,
@DESIGN-SYSTEM.md, @LIBRARIES.md.

---

## Tasks

### [TASK-001] Shared domain types
(Depends on: none)
(Component: lib)
(Files: src/lib/types.ts)
(Persona: code-writer)
Create the shared domain types. Re-use the generated DB row types from
`src/lib/database.types.ts` where possible. Define exactly (verbatim contract from
TECHNICAL-DESIGN §3):
```ts
export type TeamColor = 'cyan' | 'amber' | 'none';
export type GameTeam = 'cyan' | 'amber';
export type PlayerRole = 'spymaster' | 'operative' | 'none';
export type RoomStatus = 'lobby' | 'in_game' | 'finished';
export type GamePhase = 'clue' | 'guess' | 'finished';
export type CardIdentity = 'cyan' | 'amber' | 'neutral' | 'assassin';
export interface Room { id: string; code: string; host_player_id: string | null; status: RoomStatus; created_at: string }
export interface Player { id: string; room_id: string; auth_user_id: string; display_name: string; team: TeamColor; role: PlayerRole; is_host: boolean; last_seen_at: string; created_at: string }
export interface Game { id: string; room_id: string; starting_team: GameTeam; current_team: GameTeam; phase: GamePhase; winner: GameTeam | null; turn_deadline: string; cyan_remaining: number; amber_remaining: number; guesses_remaining: number; current_clue_id: string | null; created_at: string }
export interface Card { id: string; game_id: string; position: number; word: string; revealed: boolean; revealed_identity: CardIdentity | null; revealed_by_team: TeamColor | null; revealed_at: string | null }
export interface CardKey { card_id: string; game_id: string; identity: CardIdentity }
export interface Clue { id: string; game_id: string; team: GameTeam; word: string; number: number; created_at: string }
export type GameErrorCode = 'UNAUTHENTICATED' | 'NOT_A_MEMBER' | 'NOT_HOST' | 'NOT_YOUR_TURN' | 'WRONG_ROLE' | 'WRONG_PHASE' | 'INVALID_CLUE' | 'INVALID_INPUT' | 'ROSTER_INCOMPLETE' | 'ROOM_NOT_FOUND' | 'GAME_NOT_FOUND' | 'CARD_NOT_FOUND' | 'ALREADY_REVEALED' | 'ALREADY_STARTED' | 'INTERNAL';
export interface GameError { error: GameErrorCode; message: string }
```
Acceptance: file compiles under strict TS; exports exactly these names.

### [TASK-002] Pure game engine + frozen unit tests
(Depends on: TASK-001)
(Component: lib)
(Files: src/lib/engine.ts, src/test/engine.test.ts)
(Persona: code-writer)
Implement the pure, dependency-free rule functions in `src/lib/engine.ts` and a thorough
Vitest suite in `src/test/engine.test.ts`. Verbatim contract (TECHNICAL-DESIGN §6):
```ts
import type { GameTeam, CardIdentity, GamePhase } from './types';
export function generateBoard(words: string[], startingTeam: GameTeam, rng: () => number): { position: number; word: string; identity: CardIdentity }[];
export function initialRemaining(startingTeam: GameTeam): { cyan: number; amber: number };
export function validateClue(word: string, number: number): { ok: true } | { ok: false; code: 'INVALID_CLUE'; message: string };
export interface RevealOutcome { nextPhase: GamePhase; nextTeam: GameTeam; winner: GameTeam | null; cyanRemaining: number; amberRemaining: number; guessesRemaining: number; turnEnded: boolean }
export function applyReveal(state: { currentTeam: GameTeam; cyanRemaining: number; amberRemaining: number; guessesRemaining: number; revealedIdentity: CardIdentity }): RevealOutcome;
```
Rules (must match the server RPCs exactly):
- `generateBoard`: 25 cards from the given words (assume ≥25 unique provided); starting team
  gets 9 agents, other team 8, plus 7 neutral and 1 assassin; positions 0–24, shuffled using
  the injected `rng` (deterministic for a seeded rng); each returned word unique.
- `initialRemaining`: starting team 9, other team 8.
- `validateClue`: ok only if `word` matches `/^[\p{L}]+$/u` (single word, letters only) with
  length 1–24 AND `number` is an integer 1–9; otherwise `{ ok:false, code:'INVALID_CLUE', message }`.
- `applyReveal` (decrement guessesRemaining by 1 first):
  - revealed == currentTeam: decrement that team's remaining; if it hits 0 → nextPhase
    'finished', winner = currentTeam, turnEnded true; else if guessesRemaining (after
    decrement) <= 0 → END TURN; else continue (phase 'guess', same team, turnEnded false).
  - revealed == other team: decrement other team's remaining; if 0 → finished, winner=other;
    else END TURN.
  - revealed == 'neutral': END TURN.
  - revealed == 'assassin': finished, winner = other team, turnEnded true.
  - END TURN := nextPhase 'clue', nextTeam = other team, guessesRemaining 0, turnEnded true.
Tests must cover the full rule table (own-continue, own-win, own-limit-end, neutral-end,
opponent-end, opponent-win, assassin-loss), validateClue accept/reject cases, board
distribution (9/8/7/1) and determinism with a seeded rng. `npx vitest run` MUST pass.

### [TASK-003] Original word list
(Depends on: none)
(Component: lib)
(Files: src/lib/words.ts)
(Persona: code-writer)
Export `export const WORDS: string[]` — an original, curated list of ≥120 distinct, single,
uppercase English words suitable for a word-deduction game (no trademarked/copyrighted
lists). Also export `export function sampleWords(n: number, rng?: () => number): string[]`
returning `n` distinct words. Used for any client-side preview; the server uses its own
`word_pool`. No external fetches.

### [TASK-004] Supabase browser client + anonymous session
(Depends on: none)
(Component: lib)
(Files: src/lib/supabaseClient.ts)
(Persona: code-writer)
Verbatim usage from LIBRARIES.md. Create the typed browser client and session helper:
```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } });
export async function getAnonSession(): Promise<{ userId: string }>; // signs in anonymously if no session, returns the user id
```
Acceptance: `getAnonSession()` calls `supabase.auth.getSession()` and, if absent,
`supabase.auth.signInAnonymously()`, returning the user id. Must be a client-safe module
(no service-role key).

### [TASK-005] Typed Edge Function API wrappers
(Depends on: TASK-001, TASK-004)
(Component: lib)
(Files: src/lib/api.ts)
(Persona: code-writer)
Wrap each Edge Function via `supabase.functions.invoke`, normalizing the `GameError`
envelope into a thrown typed `GameApiError` (carrying `code: GameErrorCode`, `message`).
Verbatim error handling from LIBRARIES.md (read `error.context.json()` for the typed body).
Export:
```ts
export class GameApiError extends Error { code: GameErrorCode; constructor(code: GameErrorCode, message: string) }
export function startGame(roomId: string): Promise<{ game: Game }>;
export function submitClue(gameId: string, word: string, number: number): Promise<{ game: Game; clue: Clue }>;
export function revealCard(gameId: string, cardId: string): Promise<{ game: Game; card: Card }>;
export function endTurn(gameId: string): Promise<{ game: Game }>;
export function expireTurn(gameId: string): Promise<{ game: Game }>;
export function rematch(roomId: string): Promise<{ game: Game }>;
```
Bodies match API.md (e.g. `invoke('reveal_card', { body: { game_id, card_id } })`).

### [TASK-006] Room / seat helpers
(Depends on: TASK-001, TASK-004)
(Component: lib)
(Files: src/lib/rooms.ts)
(Persona: code-writer)
Implement (calling the SECURITY DEFINER RPCs and own-row updates per API.md):
```ts
export function createRoom(displayName: string): Promise<{ room: Room; player: Player }>;   // supabase.rpc('create_room', { p_display_name })
export function joinRoom(code: string, displayName: string): Promise<{ room: Room; player: Player }>; // rpc('join_room', { p_code, p_display_name })
export function updateSeat(playerId: string, patch: { team?: TeamColor; role?: PlayerRole }): Promise<void>; // update own players row
export function heartbeat(playerId: string): Promise<void>;   // update last_seen_at = now()
export function canStart(players: Player[]): boolean;          // each team has >=1 spymaster AND >=1 operative
export function fetchRoomState(roomId: string): Promise<{ room: Room; players: Player[]; game: Game | null }>; // initial snapshot; game = most recent for room or null
```
The RPCs return `Json`; if it has an `error` key, throw a `GameApiError` (import from
`./api`). Note: updateSeat/heartbeat write only the caller's own `players` row (RLS-allowed).

### [TASK-007] Realtime subscriptions + presence
(Depends on: TASK-001, TASK-004)
(Component: lib)
(Files: src/lib/realtime.ts)
(Persona: code-writer)
Verbatim channel setup from LIBRARIES.md. Export:
```ts
export interface GameHandlers { onGame?: (g: Game) => void; onCard?: (c: Card) => void; onClue?: (c: Clue) => void; onPlayers?: () => void; onPresence?: (state: Record<string, { player_id: string; display_name: string; team: TeamColor; role: PlayerRole }[]>) => void }
export function subscribeRoom(opts: { roomId: string; gameId: string | null; player: { id: string; display_name: string; team: TeamColor; role: PlayerRole }; handlers: GameHandlers }): () => void; // returns unsubscribe
```
Subscribe Postgres Changes on `games`/`players` (filter `room_id`) and `cards`/`clues`
(filter `game_id` when gameId present), plus a presence channel `presence:<roomId>` that
tracks the player and reports sync state. Clean up all channels on unsubscribe.

### [TASK-008] useGameState hook
(Depends on: TASK-004, TASK-005, TASK-006, TASK-007)
(Component: lib)
(Files: src/lib/useGameState.ts)
(Persona: code-writer)
`"use client"`. Verbatim contract (TECHNICAL-DESIGN §5):
```ts
export function useGameState(roomId: string, localPlayer: Player | null): {
  room: Room | null; game: Game | null; cards: Card[]; clue: Clue | null;
  players: Player[]; presence: Record<string, unknown>; spymasterKey: Record<string, CardIdentity>;
  loading: boolean; error: string | null;
};
```
Fetch the authoritative snapshot once (via `fetchRoomState` + initial cards/clue), then
apply realtime deltas from `subscribeRoom`. Re-fetch the full snapshot on reconnect
(discard optimistic state). `spymasterKey` is fetched from `card_identities`
(`select card_id, identity where game_id=…`) ONLY when `localPlayer.role === 'spymaster'`
(RLS returns rows only then); maps card_id → identity. Sort cards by `position`.

### [TASK-009] Landing page (create / join)
(Depends on: TASK-004, TASK-006, TASK-011)
(Component: app)
(Files: src/app/page.tsx)
(Persona: ui-component-writer)
`"use client"`. The entry screen styled per DESIGN-SYSTEM.md (neon spy console, glass
panel). On mount call `getAnonSession()`. Two actions: Create Room (name input → `createRoom`
→ route to `/room/<code>`) and Join (name + 6-char code → `joinRoom` → route to
`/room/<code>`). Use `next/navigation` `useRouter`. Show clear inline errors (invalid code →
ROOM_NOT_FOUND). Monospace styling for the code input. Accessible labels, visible focus.

### [TASK-010] Design tokens + root layout / fonts
(Depends on: none)
(Component: app)
(Files: src/app/globals.css, src/app/layout.tsx)
(Persona: ui-component-writer)
Rewrite `globals.css` for Tailwind v4: `@import "tailwindcss";` then a `@theme` block
declaring all DESIGN-SYSTEM.md tokens as `--color-*` / spacing / radius custom properties
(bg #0A0E1A, surface, cyan #22D3EE, amber #F59E0B, neutral #9CA3AF, assassin #EF4444, fg,
etc.), dark base, and a `prefers-reduced-motion` block. In `layout.tsx` load Inter (sans)
and JetBrains Mono (mono) via `next/font/google`, set `<html>`/`<body>` classes, app
metadata (title "Decrypt"), and the dark background. NO tailwind.config.js.

### [TASK-011] UI primitives (GlassPanel, Button, icons)
(Depends on: none)
(Component: components/ui)
(Files: src/components/ui/GlassPanel.tsx, src/components/ui/Button.tsx, src/components/ui/icons.tsx, src/components/ui/index.ts)
(Persona: ui-component-writer)
Token-driven primitives per DESIGN-SYSTEM.md. `GlassPanel` (glass surface + blur + border +
radius), `Button` (primary/secondary/ghost variants, sizes, disabled, focus ring,
cursor-pointer, hover transition), and `icons.tsx` exporting small inline **SVG** icons
(team agent glyph, neutral, assassin/skull, spymaster eye, check, copy) — never emoji.
`index.ts` re-exports. All accessible (aria where relevant), ≥44px touch targets for buttons.

### [TASK-012] Card cell (3D flip)
(Depends on: TASK-001, TASK-010, TASK-011)
(Component: components)
(Files: src/components/Card.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ card: Card; spymasterIdentity?: CardIdentity; isSpymaster: boolean; canReveal: boolean; onReveal: (cardId: string) => void }`. Renders the word; unrevealed
face is neutral dark; if `isSpymaster` && unrevealed, tint faintly with the identity color +
a small identity icon (color is never the only signal). On reveal, Framer Motion **3D flip**
(rotateY ~300ms) to the `revealed_identity` color with `*-fg` text + identity icon; assassin
shows skull, neutral a dash, agents the team glyph. Keyboard focusable (button role), Enter/
Space triggers `onReveal` only when `canReveal`. Respect `prefers-reduced-motion` (fade, no
flip). aria-label announces word + state.

### [TASK-013] Board grid
(Depends on: TASK-012)
(Component: components)
(Files: src/components/Board.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ cards: Card[]; spymasterKey: Record<string, CardIdentity>; isSpymaster: boolean; canReveal: boolean; onReveal: (cardId: string) => void }`. Renders a
responsive 5×5 grid of `Card` (sorted by position), passing `spymasterIdentity` from
`spymasterKey[card.id]`. Responsive: comfortable on desktop and mobile portrait. Skip-link
target / logical tab order.

### [TASK-014] Scoreboard
(Depends on: TASK-001, TASK-011)
(Component: components)
(Files: src/components/Scoreboard.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ game: Game }`. Two team chips showing `cyan_remaining` /
`amber_remaining`; highlight `current_team` with a glow pulse; show `guesses_remaining`
during guess phase and a "whose turn / phase" label. Tokens + icons; reduced-motion safe.

### [TASK-015] Turn timer (server-anchored countdown ring)
(Depends on: TASK-001, TASK-005, TASK-011)
(Component: components)
(Files: src/components/TurnTimer.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ game: Game; onExpire: () => void }`. Compute remaining seconds
from `game.turn_deadline` (server-anchored) on a 250ms interval; render an SVG countdown
ring + monospace MM:SS, team-colored. When it reaches 0 and phase is clue/guess, call
`onExpire` once (debounced) — the container wires this to `expireTurn(game.id)`. Never run an
authoritative countdown; always derive from the deadline. Reduced-motion: show numeric only.

### [TASK-016] Clue panel
(Depends on: TASK-001, TASK-002, TASK-005, TASK-011)
(Component: components)
(Files: src/components/CluePanel.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ game: Game; clue: Clue | null; localPlayer: Player; onSubmit: (word: string, number: number) => Promise<void> }`. When it is the local spymaster's clue phase,
show a word input + number (1–9) select and a Submit button; pre-validate with
`validateClue` from `src/lib/engine` and show inline errors before calling `onSubmit`.
Otherwise display the current clue (word + number) and remaining guesses. Accessible, mono
accent for the clue.

### [TASK-017] Presence bar
(Depends on: TASK-001, TASK-007, TASK-011)
(Component: components)
(Files: src/components/PresenceBar.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ players: Player[]; presence: Record<string, unknown> }`. Show the
roster grouped by team/role with a per-player online dot derived from the presence state
(offline if not present). Color + icon + label (never color alone). Compact, responsive.

### [TASK-018] Game summary overlay
(Depends on: TASK-001, TASK-005, TASK-011, TASK-013)
(Component: components)
(Files: src/components/GameSummary.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ game: Game; cards: Card[]; isHost: boolean; onRematch: () => void }`.
Shown when `game.phase === 'finished'`. Full-screen glass overlay announcing the winner with
a confetti/scanline celebration (Framer Motion; reduced-motion → static), the fully revealed
board (all `revealed_identity` shown), and a Rematch button (host only → `onRematch`).
Screen-reader announcement of the result.

### [TASK-019] Lobby
(Depends on: TASK-001, TASK-005, TASK-006, TASK-011)
(Component: components)
(Files: src/components/Lobby.tsx)
(Persona: ui-component-writer)
`"use client"`. Props: `{ room: Room; players: Player[]; localPlayer: Player; onStart: () => Promise<void> }`. Shows the shareable code + URL (copy button, monospace), live roster, and
team (Cyan/Amber) + role (Spymaster/Operative) pickers that call `updateSeat`. The host sees
a Start button enabled only when `canStart(players)` (from `src/lib/rooms`). Clear, accessible.

### [TASK-020] Room container page
(Depends on: TASK-008, TASK-013, TASK-014, TASK-015, TASK-016, TASK-017, TASK-018, TASK-019)
(Component: app)
(Files: src/app/room/[code]/page.tsx)
(Persona: ui-component-writer)
`"use client"`. The game container at `/room/[code]`. Read `code` via `useParams()`. On
mount: `getAnonSession()`, then resolve the room/seat (`joinRoom(code, name)` if no seat —
prompt for a name if needed, or reuse a stored name) and drive `useGameState(roomId,
localPlayer)`. Render `<Lobby>` when `room.status==='lobby'`, otherwise the game view:
`<Scoreboard>`, `<TurnTimer>` (onExpire → `expireTurn`), `<CluePanel>` (onSubmit →
`submitClue`), `<Board>` (onReveal → `revealCard`, with optimistic flip reconciled to the
next authoritative broadcast), `<PresenceBar>`, and `<GameSummary>` when finished (onRematch
→ `rematch`). Wire all mutations through `src/lib/api`. Layout responsive per DESIGN-SYSTEM.md
(scoreboard/timer above board on mobile portrait). Handle `GameApiError` with a non-blocking
toast/inline message; the board always re-renders from authoritative state.
