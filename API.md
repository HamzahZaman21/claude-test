# API Contracts — Decrypt

> The "API" is (1) a set of authoritative **Supabase Edge Functions** for all game
> mutations, (2) one **Postgres RPC** for joining a room, and (3) **realtime read
> channels**. Clients never write game tables directly. Full behavioral contracts
> live in TECHNICAL-DESIGN.md §4; this file is the wire-level reference.

## Authentication
- Every visitor gets an **anonymous Supabase Auth session** (`signInAnonymously()`).
- The browser client attaches the user's JWT automatically. `functions.invoke` forwards
  it in the `Authorization: Bearer <jwt>` header; Edge Functions verify it and read
  `auth.uid()`. `verify_jwt` is **enabled** on all functions.
- Authorization (role/team/turn/membership) is enforced inside each function and by RLS.

## Error envelope
On failure, functions return a non-2xx status with body `{ "error": <GameErrorCode>,
"message": string }`. Codes: `UNAUTHENTICATED, NOT_A_MEMBER, NOT_HOST, NOT_YOUR_TURN,
WRONG_ROLE, WRONG_PHASE, INVALID_CLUE, INVALID_INPUT, ROSTER_INCOMPLETE, ROOM_NOT_FOUND,
GAME_NOT_FOUND, CARD_NOT_FOUND, ALREADY_REVEALED, ALREADY_STARTED, INTERNAL`.

---

## Edge Functions

### POST `/functions/v1/start_game`
- Auth: room host. Body: `{ room_id }`.
- Success `200`: `{ game: Game }`. Side effects: creates game + 25 cards + 25 identities,
  sets room `in_game`.
- Errors: `NOT_HOST`, `ROSTER_INCOMPLETE`, `ALREADY_STARTED`, `ROOM_NOT_FOUND`.

### POST `/functions/v1/submit_clue`
- Auth: spymaster of current team. Body: `{ game_id, word, number }`.
- Validation: `word` single word, letters only, 1–24 chars; `number` integer 1–9.
- Success `200`: `{ game: Game, clue: Clue }`. Sets phase `guess`, `guesses_remaining =
  number+1`, new `turn_deadline`.
- Errors: `WRONG_ROLE`, `NOT_YOUR_TURN`, `WRONG_PHASE`, `INVALID_CLUE`.

### POST `/functions/v1/reveal_card`
- Auth: operative of current team. Body: `{ game_id, card_id }`.
- Success `200`: `{ game: Game, card: Card }` (card now has `revealed_identity`).
- Rules: own→continue/win; neutral→end turn; opponent→end turn+credit; assassin→instant
  loss. Idempotent on already-revealed.
- Errors: `WRONG_ROLE`, `NOT_YOUR_TURN`, `WRONG_PHASE`, `CARD_NOT_FOUND`, `ALREADY_REVEALED`.

### POST `/functions/v1/end_turn`
- Auth: member of current team. Body: `{ game_id }`. Success `200`: `{ game: Game }`.
- Errors: `NOT_YOUR_TURN`, `WRONG_PHASE`.

### POST `/functions/v1/expire_turn`
- Auth: any room member. Body: `{ game_id }`. Advances turn only if `now() > turn_deadline`;
  otherwise returns the unchanged game. Success `200`: `{ game: Game }`.
- Errors: `NOT_A_MEMBER`, `GAME_NOT_FOUND`.

### POST `/functions/v1/rematch`
- Auth: room host. Body: `{ room_id }`. Requires current game `finished`.
- Success `200`: `{ game: Game }`. Errors: `NOT_HOST`, `WRONG_PHASE`.

---

## Postgres RPC (client-callable, SECURITY DEFINER)

### `create_room(p_display_name text) returns { room: Room, player: Player }`
Creates a room with a unique 6-char code, inserts the host player row (`is_host=true`),
sets `rooms.host_player_id`. Caller becomes host.

### `join_room(p_code text, p_display_name text) returns { room: Room, player: Player }`
Resolves a room by code; inserts/returns the caller's player seat (unique per auth user).
- Errors (as Postgres exceptions surfaced to client): `ROOM_NOT_FOUND`, room not in `lobby`.

### Direct table writes the client MAY do (RLS-guarded, own row only)
- `update players set team=…, role=… where auth_user_id = auth.uid()` (lobby seat pick).
- `update players set last_seen_at=now() where auth_user_id = auth.uid()` (heartbeat).

---

## Realtime read channels (Supabase Postgres Changes + Presence)
- Channel `room:<room_id>`:
  - Postgres Changes on `players` (filter `room_id=eq.<id>`) → roster updates.
  - Postgres Changes on `games` (filter `room_id=eq.<id>`) → phase/turn/counters/timer.
  - Postgres Changes on `cards` (filter `game_id=eq.<game_id>`) → reveals.
  - Postgres Changes on `clues` (filter `game_id=eq.<game_id>`) → new clues.
  - Presence: each client tracks `{ player_id, display_name, team, role }`; presence
    sync drives the online indicator and ~5 s leave detection.
- `card_identities` is **never** subscribed or broadcast. Spymasters fetch it once via an
  authenticated `select * from card_identities where game_id = …` (RLS returns rows only
  for spymasters); operatives get zero rows.

## Versioning
MVP v1. Function contracts are additive-only; breaking changes get a new function name.
