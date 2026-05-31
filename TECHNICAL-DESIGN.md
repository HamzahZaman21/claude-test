# Technical Design — Decrypt

> **This is the source of truth for Phase C (task decomposition) and Phase D
> (the DeepSeek build).** Every module's public contract is copied verbatim into
> the tasks that implement it. The authoritative-server pattern is non-negotiable:
> all game mutations happen in Supabase Edge Functions (service role); clients only
> read streamed state and call those functions.

---

## 1. System shape

```
Browser (Next.js App Router, client components)
  │  reads via @supabase/supabase-js v2:
  │    • initial fetch (REST) of room/game/board/clue/counters
  │    • realtime subscriptions (Postgres Changes) on games, cards, clues, players
  │    • presence channel per room
  │  writes ONLY by invoking Edge Functions (functions.invoke) — never table writes
  │            (except own players row: name/team/role/last_seen, and join_room RPC)
  ▼
Supabase Edge Functions (Deno, service role)  ← AUTHORITATIVE
  start_game · submit_clue · reveal_card · end_turn · expire_turn · rematch
  │  validate caller identity + role + turn + phase, mutate Postgres atomically
  ▼
Postgres (RLS) + Realtime publication → streams every change back to all clients
```

Clients **render from streamed authoritative state**. Optimistic UI (a card flip)
is allowed but is always reconciled against the next authoritative broadcast and
corrected if the server rejected the action.

---

## 2. The authoritative-server pattern (rules)

1. The only code that writes `games`, `cards`, `card_identities`, `clues` is an Edge
   Function running with the service role. There is no client table-write policy.
2. Every Edge Function: (a) authenticates the caller from the JWT (`Authorization`
   header forwarded by `functions.invoke`), (b) resolves the caller's `players` row in
   the target room, (c) validates role/team/phase/turn, (d) performs the mutation in a
   single transaction (a `SECURITY DEFINER` Postgres RPC), (e) returns the new state or
   a **typed error**.
3. **Server-anchored timer:** the function sets `games.turn_deadline = now() + <interval>`.
   Clients compute remaining time from `turn_deadline` only; they never run an
   authoritative countdown. When the deadline passes, any client may call `expire_turn`,
   which is idempotent and only advances if `now() > turn_deadline`.
4. **Idempotency / out-of-order safety:** `reveal_card` is a no-op if the card is already
   revealed or the phase/turn no longer matches; `expire_turn` re-checks the deadline;
   duplicate or stale events cannot corrupt state because every mutation re-reads and
   re-validates current state inside the transaction.

---

## 3. Shared types (`src/lib/types.ts`)

```ts
export type TeamColor = 'cyan' | 'amber' | 'none';
export type GameTeam = 'cyan' | 'amber';
export type PlayerRole = 'spymaster' | 'operative' | 'none';
export type RoomStatus = 'lobby' | 'in_game' | 'finished';
export type GamePhase = 'clue' | 'guess' | 'finished';
export type CardIdentity = 'cyan' | 'amber' | 'neutral' | 'assassin';

export interface Room {
  id: string; code: string; host_player_id: string | null;
  status: RoomStatus; created_at: string;
}
export interface Player {
  id: string; room_id: string; auth_user_id: string; display_name: string;
  team: TeamColor; role: PlayerRole; is_host: boolean;
  last_seen_at: string; created_at: string;
}
export interface Game {
  id: string; room_id: string; starting_team: GameTeam; current_team: GameTeam;
  phase: GamePhase; winner: GameTeam | null; turn_deadline: string;
  cyan_remaining: number; amber_remaining: number; guesses_remaining: number;
  current_clue_id: string | null; created_at: string;
}
export interface Card {
  id: string; game_id: string; position: number; word: string;
  revealed: boolean; revealed_identity: CardIdentity | null;
  revealed_by_team: TeamColor | null; revealed_at: string | null;
}
export interface CardKey { card_id: string; game_id: string; identity: CardIdentity }
export interface Clue {
  id: string; game_id: string; team: GameTeam; word: string;
  number: number; created_at: string;
}

// Typed error envelope returned by every Edge Function on failure.
export type GameErrorCode =
  | 'UNAUTHENTICATED' | 'NOT_A_MEMBER' | 'NOT_HOST' | 'NOT_YOUR_TURN'
  | 'WRONG_ROLE' | 'WRONG_PHASE' | 'INVALID_CLUE' | 'INVALID_INPUT'
  | 'ROSTER_INCOMPLETE' | 'ROOM_NOT_FOUND' | 'GAME_NOT_FOUND'
  | 'CARD_NOT_FOUND' | 'ALREADY_REVEALED' | 'ALREADY_STARTED' | 'INTERNAL';

export interface GameError { error: GameErrorCode; message: string }
```

---

## 4. Edge Function contracts (authoritative)

All functions are invoked as `supabase.functions.invoke('<name>', { body })` with the
caller's anon JWT forwarded automatically. Each returns `{ data }` on success or HTTP
4xx/5xx with a `GameError` body. Each reads `auth.uid()` from the verified JWT.

### `start_game`
```
body: { room_id: string }
auth: caller must be the room host (players.is_host && room.host_player_id)
preconditions: room.status='lobby'; each team has ≥1 spymaster AND ≥1 operative
effect: pick starting_team at random; sample 25 words; assign 9/8/7/1 identities
        to shuffled positions; insert game (phase='clue', current_team=starting_team,
        turn_deadline=now()+CLUE_SECONDS, cyan_remaining/amber_remaining set,
        guesses_remaining=0, current_clue_id=null); insert 25 cards + 25 card_identities;
        set room.status='in_game'
returns: { game: Game }
errors: UNAUTHENTICATED, NOT_HOST, ROSTER_INCOMPLETE, ALREADY_STARTED, ROOM_NOT_FOUND
```

### `submit_clue`
```
body: { game_id: string, word: string, number: number }
auth: caller is spymaster of game.current_team in this room
preconditions: game.phase='clue'; word matches /^[\p{L}]+$/u (single word, letters
               only, 1–24 chars); number is integer 1–9
effect: insert clue(team=current_team, word, number); set game.phase='guess',
        guesses_remaining=number+1, current_clue_id=<new>, turn_deadline=now()+GUESS_SECONDS
returns: { game: Game, clue: Clue }
errors: UNAUTHENTICATED, NOT_A_MEMBER, WRONG_ROLE, NOT_YOUR_TURN, WRONG_PHASE, INVALID_CLUE
```

### `reveal_card`
```
body: { game_id: string, card_id: string }
auth: caller is an operative of game.current_team in this room
preconditions: game.phase='guess'; card belongs to game; card.revealed=false;
               now() <= game.turn_deadline (else treat as expire_turn)
effect (atomic, reads identity from card_identities via service role):
  • set card.revealed=true, revealed_identity=identity, revealed_by_team=current_team,
    revealed_at=now()
  • decrement game.guesses_remaining by 1
  • apply rules:
      identity == current_team  → decrement current_team remaining;
                                   if remaining==0 → phase='finished', winner=current_team
                                   else if guesses_remaining==0 → END TURN
                                   else → continue (stay phase='guess')
      identity == other_team    → decrement other_team remaining;
                                   if other remaining==0 → phase='finished', winner=other
                                   else → END TURN
      identity == 'neutral'     → END TURN
      identity == 'assassin'    → phase='finished', winner=other_team (instant loss)
  • END TURN := current_team=other_team, phase='clue', guesses_remaining=0,
                current_clue_id=null, turn_deadline=now()+CLUE_SECONDS
returns: { game: Game, card: Card }
idempotent: if card already revealed OR phase!='guess' OR not caller's turn → ALREADY_REVEALED / WRONG_PHASE / NOT_YOUR_TURN (no state change)
errors: UNAUTHENTICATED, NOT_A_MEMBER, WRONG_ROLE, NOT_YOUR_TURN, WRONG_PHASE, CARD_NOT_FOUND, ALREADY_REVEALED
```

### `end_turn`
```
body: { game_id: string }
auth: caller is on game.current_team (operative or spymaster) in this room
preconditions: game.phase='guess'
effect: END TURN (as above)
returns: { game: Game }
errors: UNAUTHENTICATED, NOT_A_MEMBER, NOT_YOUR_TURN, WRONG_PHASE
```

### `expire_turn`
```
body: { game_id: string }
auth: any room member (clients call this when they observe deadline passed)
preconditions: game.phase in ('clue','guess'); now() > game.turn_deadline
effect: END TURN (clue phase expiry also just passes turn to other team)
returns: { game: Game }
idempotent: if now() <= turn_deadline → returns current game unchanged (no error)
errors: UNAUTHENTICATED, NOT_A_MEMBER, GAME_NOT_FOUND
```

### `rematch`
```
body: { room_id: string }
auth: caller is the room host
preconditions: current game.phase='finished'
effect: create a fresh game (new board, swapped or random starting team) keeping the
        roster; set room.status='in_game'
returns: { game: Game }
errors: UNAUTHENTICATED, NOT_HOST, WRONG_PHASE
```

> Each Edge Function delegates the transactional mutation to a `SECURITY DEFINER`
> Postgres RPC of the same intent (e.g. `rpc_reveal_card(p_game, p_card, p_uid)`),
> so validation + mutation are one atomic statement and the pure rule logic is unit-
> testable in `src/lib/engine.ts` (see §6).

---

## 5. Client data flow (`src/lib/`)

- `supabaseClient.ts` — browser client from `NEXT_PUBLIC_*`; `getAnonSession()` calls
  `signInAnonymously()` if no session, returns the user.
- `api.ts` — typed wrappers: `startGame`, `submitClue`, `revealCard`, `endTurn`,
  `expireTurn`, `rematch`, each calling `functions.invoke` and normalizing the
  `GameError` envelope into a thrown typed error.
- `rooms.ts` — `createRoom(displayName)`, `joinRoom(code, displayName)` (RPC),
  `updateSeat({team, role})`, `setHostStart` gating helpers.
- `realtime.ts` — `subscribeGame(roomId, handlers)`: opens Postgres Changes
  subscriptions on `games`, `cards`, `clues`, `players` filtered by room/game and a
  presence channel; returns an unsubscribe fn. Handlers receive typed rows.
- `useGameState.ts` (hook) — fetches the authoritative snapshot once, then applies
  realtime deltas; exposes `{ game, cards, clue, players, presence, spymasterKey }`.
  `spymasterKey` is fetched from `card_identities` only when the local player is a
  spymaster (RLS returns rows only then).

### Realtime contract (the headline requirement)
- A reveal in client A must appear in client B in **< 500 ms**. Achieved by Postgres
  Changes on `cards`/`games` with `replica identity full`.
- Counters, current clue, turn, and timer all derive from the streamed `games` row, so
  every client shows identical values.
- On reconnect, the hook re-runs the initial snapshot fetch, discarding any optimistic
  state, so a refreshed client renders the exact authoritative state.

---

## 6. Pure, unit-testable game logic (`src/lib/engine.ts`)

The rule math is extracted into **pure functions** so the DeepSeek per-task test command
(`npx vitest run`) can verify them headlessly with no DB/browser:

```ts
export function generateBoard(words: string[], startingTeam: GameTeam, rng: () => number):
  { position: number; word: string; identity: CardIdentity }[];   // 9/8/7/1 split, 25 cards

export function initialRemaining(startingTeam: GameTeam): { cyan: number; amber: number };

export function validateClue(word: string, number: number):
  { ok: true } | { ok: false; code: 'INVALID_CLUE'; message: string };

export interface RevealOutcome {
  nextPhase: GamePhase; nextTeam: GameTeam; winner: GameTeam | null;
  cyanRemaining: number; amberRemaining: number; guessesRemaining: number;
  turnEnded: boolean;
}
export function applyReveal(state: {
  currentTeam: GameTeam; cyanRemaining: number; amberRemaining: number;
  guessesRemaining: number; revealedIdentity: CardIdentity;
}): RevealOutcome;   // implements own→continue / neutral→end / opponent→end+credit / assassin→loss
```

These functions are the **frozen contract** for the build: tests assert the full rule
table (assassin loss, win on last agent, end-turn on neutral/opponent/limit, continue on
own with guesses left). The Edge Functions/RPCs call the same logic semantics.

---

## 7. Component map (`src/components/`, `src/app/`)

- `app/page.tsx` — landing: Create Room / Join by code.
- `app/room/[code]/page.tsx` — lobby + game container (client); resolves session,
  subscribes, renders Lobby or Board by `room.status`.
- `components/Lobby.tsx` — roster, team/role pickers, host Start button (enabled only
  when each team has ≥1 spymaster + ≥1 operative), shareable code/URL.
- `components/Board.tsx` — 5×5 grid; renders `Card` cells from streamed state.
- `components/Card.tsx` — 3D flip on reveal; shows word; color via `revealed_identity`
  (revealed) or spymaster key overlay (unrevealed, spymaster only); keyboard-focusable.
- `components/CluePanel.tsx` — spymaster clue input (active turn) / clue display.
- `components/TurnTimer.tsx` — countdown ring derived from `turn_deadline`; calls
  `expireTurn` when it hits zero.
- `components/Scoreboard.tsx` — team counters from `games.{cyan,amber}_remaining`,
  whose-turn indicator, guesses remaining.
- `components/PresenceBar.tsx` — online roster + connection dots from presence channel.
- `components/GameSummary.tsx` — animated win/loss overlay, full board reveal, Rematch.
- `components/ui/` — tokens-driven primitives (GlassPanel, Button, etc.).

Color is never the only signal: each team card carries an icon/label; assassin and
neutral have distinct iconography for color-blind accessibility (see DESIGN-SYSTEM.md).
