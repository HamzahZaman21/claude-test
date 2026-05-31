# Data Schema — Decrypt

> Postgres (Supabase). Every table has **Row Level Security enabled**. All
> game-mutating writes are performed exclusively by Edge Functions using the
> service role; clients may only read (and, for a few lobby actions, insert/update
> their own player row). The single hardest invariant is enforced here, not in the
> UI: **unrevealed card identities are readable only by a same-game Spymaster.**

---

## Enums

```sql
create type team_color   as enum ('cyan', 'amber', 'none');
create type player_role  as enum ('spymaster', 'operative', 'none');
create type room_status  as enum ('lobby', 'in_game', 'finished');
create type game_phase   as enum ('clue', 'guess', 'finished');
create type card_identity as enum ('cyan', 'amber', 'neutral', 'assassin');
```

> Note: `team_color` includes `none` for unassigned players. Games/cards/clues use
> only `cyan`/`amber` (and `neutral`/`assassin` for card identity).

---

## Entities

### rooms
A lobby/session container identified by a shareable 6-character code.

Attributes:
- `id`: uuid — pk, default `gen_random_uuid()`
- `code`: text — unique, exactly 6 uppercase alphanumeric chars (no ambiguous 0/O/1/I)
- `host_player_id`: uuid — nullable fk → players.id (set after host player row exists)
- `status`: room_status — default `lobby`
- `created_at`: timestamptz — default `now()`

Relationships: has many players; has many games (one active at a time).
Sensitivity: none. Volume: dozens concurrent.

### players
A participant seat in a room, bound to an anonymous Supabase Auth user.

Attributes:
- `id`: uuid — pk, default `gen_random_uuid()`
- `room_id`: uuid — fk → rooms.id, on delete cascade
- `auth_user_id`: uuid — fk → auth.users.id (the anonymous session)
- `display_name`: text — 1–24 chars, required
- `team`: team_color — default `none`
- `role`: player_role — default `none`
- `is_host`: boolean — default false
- `last_seen_at`: timestamptz — default `now()` (updated by presence heartbeat)
- `created_at`: timestamptz — default `now()`

Constraints:
- unique `(room_id, auth_user_id)` — one seat per auth user per room.
Relationships: belongs to room; references auth.users.
Sensitivity: display_name is user-chosen, non-PII. Volume: ≤ 8 per room.

### games
The authoritative game state for a room. One row per game instance (rematches
create new rows). The current game is the most recent row for the room.

Attributes:
- `id`: uuid — pk, default `gen_random_uuid()`
- `room_id`: uuid — fk → rooms.id, on delete cascade
- `starting_team`: team_color — `cyan` or `amber` (gets 9 agents)
- `current_team`: team_color — whose turn it is (`cyan`/`amber`)
- `phase`: game_phase — `clue` | `guess` | `finished`
- `winner`: team_color — null until finished, then `cyan`/`amber`
- `turn_deadline`: timestamptz — **server-anchored** deadline for the current phase
- `cyan_remaining`: int — agents the cyan team still must reveal (starts 9 or 8)
- `amber_remaining`: int — agents the amber team still must reveal (starts 8 or 9)
- `guesses_remaining`: int — guesses left in the current clue (set to clue.number + 1)
- `current_clue_id`: uuid — nullable fk → clues.id (the active clue during `guess`)
- `created_at`: timestamptz — default `now()`

> **Why `*_remaining` are stored:** Operatives cannot read card identities (RLS),
> so they cannot compute remaining counts client-side. The server maintains these
> counters so every client renders identical counts from the streamed `games` row.

Relationships: belongs to room; has 25 cards; has many clues.
Sensitivity: none (the secret lives in card_identities). Volume: a few per room.

### cards
The 25 board cards. **Public columns only** — safe for every room member to read.
The secret identity lives in a separate table.

Attributes:
- `id`: uuid — pk, default `gen_random_uuid()`
- `game_id`: uuid — fk → games.id, on delete cascade
- `position`: int — 0–24, unique within a game
- `word`: text — the displayed word
- `revealed`: boolean — default false
- `revealed_identity`: card_identity — **null while unrevealed**; set to the true
  identity only when the card is revealed (so all clients see the flipped color)
- `revealed_by_team`: team_color — null until revealed; which team triggered the reveal
- `revealed_at`: timestamptz — null until revealed

Constraints: unique `(game_id, position)`.
Relationships: belongs to game; has exactly one card_identities row.
Sensitivity: none on these columns (identity is null until reveal). Volume: 25/game.

### card_identities
The **secret key**. One row per card holding its true identity. This is the only
table whose read access is restricted to Spymasters.

Attributes:
- `card_id`: uuid — pk, fk → cards.id, on delete cascade
- `game_id`: uuid — fk → games.id (denormalized for RLS join performance)
- `identity`: card_identity — `cyan` | `amber` | `neutral` | `assassin`

Relationships: belongs to a card and a game.
Sensitivity: **CONFIDENTIAL — this is the game secret.** Volume: 25/game.

### clues
History of clues given. The active clue is referenced by `games.current_clue_id`.

Attributes:
- `id`: uuid — pk, default `gen_random_uuid()`
- `game_id`: uuid — fk → games.id, on delete cascade
- `team`: team_color — `cyan`/`amber` (the team that gave it)
- `word`: text — single word, no spaces, 1–24 chars
- `number`: int — positive integer (1–9)
- `created_at`: timestamptz — default `now()`

Relationships: belongs to game.
Sensitivity: none. Volume: dozens per game.

---

## Board generation (server-side, in start_game Edge Function)

- 25 distinct words sampled from the bundled original word list (see LIBRARIES.md / `src/lib/words.ts`).
- Identity split: starting team **9**, other team **8**, **7** neutral, **1** assassin (total 25).
- Positions 0–24 shuffled; identities assigned to shuffled positions.
- `cards` rows inserted with `revealed=false`, `revealed_identity=null`.
- `card_identities` rows inserted with the true identity.
- `games.cyan_remaining` / `amber_remaining` initialized to the team agent counts.

---

## Indexes

- `rooms (code)` — unique; primary lookup for join-by-code.
- `players (room_id)` — roster queries and realtime filters.
- `players (room_id, auth_user_id)` — unique; seat resolution.
- `games (room_id, created_at desc)` — fetch current game for a room.
- `cards (game_id, position)` — unique; board rendering.
- `card_identities (game_id)` — spymaster key fetch + RLS join.
- `clues (game_id, created_at desc)` — clue history.

---

## Row Level Security (policies)

> Helper: a player is a "member" of a room if a `players` row exists with that
> `room_id` and `auth_user_id = auth.uid()`. A player is a "spymaster of a game"
> if such a row exists with `role='spymaster'` for the game's room.

Implemented via `SECURITY DEFINER` helper functions to avoid recursive policy
evaluation (see migration `0002_rls`):
- `public.is_room_member(room uuid) returns boolean`
- `public.is_game_spymaster(game uuid) returns boolean`

Policies (read = `select`; all writes below are additionally gated so only the
service role can mutate game state):

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| rooms | member, or anyone may select by exact `code` for join (see note) | authenticated (create room) | host only (status via service role) | none |
| players | room members | self (auth_user_id = auth.uid()) | self row only (name/team/role/last_seen) | self row only |
| games | room members | service role only | service role only | none |
| cards | room members | service role only | service role only | none |
| **card_identities** | **`is_game_spymaster(game_id)` only** | service role only | service role only | none |
| clues | room members | service role only | service role only | none |

Notes:
- **Join-by-code:** a player who is not yet a member must be able to resolve a room
  by its code to join. This is handled by a `SECURITY DEFINER` RPC
  `join_room(code, display_name)` rather than a broad public select policy, so the
  rooms table itself is not world-readable by id.
- **Authoritative writes:** `games`, `cards`, `card_identities`, `clues` have **no
  client-writable policy** — only the Edge Functions (service role, which bypasses
  RLS) write them. This is the anti-cheat guarantee.
- `card_identities` has **no** policy permitting operatives to read it. A non-spymaster
  `select * from card_identities` returns **zero rows**. Verified in Phase E.

---

## Realtime publication

Add to the `supabase_realtime` publication so clients receive change streams:
`games`, `cards`, `clues`, `players`. (`card_identities` is **not** published —
it is fetched once by spymasters via an authenticated read; never broadcast.)

Replica identity set to `full` on `games`, `cards`, `clues`, `players` so updates
carry complete row payloads.

---

## Cross-entity constraints (business rules — enforced in Edge Functions)

- A game can be started only when the room has, per team, ≥1 spymaster and ≥1 operative.
- Exactly one game is "current" per room (most recent by `created_at`).
- `guesses_remaining` is set to `clue.number + 1` when a clue is submitted.
- Revealing the assassin sets `phase='finished'` and `winner` = the **other** team.
- A team reaching `*_remaining = 0` sets `phase='finished'` and `winner` = that team.
- `turn_deadline` is always a server-computed `now() + interval` (see .env.config timers).
