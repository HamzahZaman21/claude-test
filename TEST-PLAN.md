# Test Plan — Decrypt

## Testing Strategy
Two layers:
1. **Unit (Vitest)** — the frozen contract for the DeepSeek build. Runs via `npx vitest run`,
   headless, no DB/browser. Targets the pure game-rule engine (`src/lib/engine.ts`) and input
   validation. This is the per-task test command every worker must pass.
2. **End-to-end (Playwright)** — Phase E only, run by the orchestrator. Boots the dev server
   and opens **two browser contexts** to assert real-time cross-client convergence, plus the
   RLS security check at the DB layer.

Coverage target: ≥ 80% meaningful coverage of `src/lib/engine.ts` (the rule logic), 100% of
the reveal-outcome rule table.

## Test Types by Feature

### Authoritative Game Engine (rule logic)
Type: unit. Framework: Vitest. Priority: critical.
Test cases (against `src/lib/engine.ts`):
- `generateBoard`: returns 25 cards; identity split is exactly 9/8/7/1 with starting team = 9;
  positions 0–24 unique; words unique; deterministic given a seeded rng.
- `initialRemaining`: starting team 9, other 8.
- `validateClue`: accepts single-word letters-only 1–24 chars + integer 1–9; rejects multi-word,
  empty, numbers in word, number ≤ 0, number > 9, non-integer.
- `applyReveal` rule table (100%):
  - own-team card with guesses left → continue, decrement own remaining + guesses, turnEnded=false.
  - own-team card that empties own remaining → phase finished, winner = own team.
  - own-team card with guesses_remaining reaching 0 → turn ends.
  - neutral → turn ends, no winner.
  - opponent card → turn ends, decrement opponent remaining; if it empties → opponent wins.
  - assassin → phase finished, winner = other team (instant loss).

### Lobby & Room Management
Type: unit (helpers) + e2e. Priority: critical.
- Room code generator: 6 chars, allowed alphabet (no ambiguous 0/O/1/I), uniqueness handling.
- Start-gating helper: enabled only when each team has ≥1 spymaster AND ≥1 operative.
- e2e: create room → code + shareable URL; second context joins by code; roster updates live.

### Real-Time Board Synchronization (HEADLINE)
Type: e2e (multi-context). Priority: critical.
- Two contexts in the same game: a reveal in A appears in B within **500 ms**.
- Turn indicator, remaining counts, current clue, guesses-remaining, and timer are identical in
  both contexts after each action.
- Optimistic flip in the acting client reconciles to server truth (rejected action reverts).

### Spymaster Clue Flow & Turn Timer
Type: unit (validation) + e2e. Priority: critical.
- Clue validation enforced server-side (mirrors `validateClue`).
- e2e: clue appears identically on all clients; guesses-remaining = number+1; timer derived from
  `turn_deadline`; expiry ends the turn for everyone simultaneously.

### Presence & Connection Status
Type: e2e. Priority: standard.
- Closing a tab removes the player from the roster within ~5 s for everyone.
- Refresh/reconnect restores the seat and the exact authoritative state (board/turn/clue/counts).

### Win / Loss & Game Summary
Type: unit (engine win/loss) + e2e. Priority: critical.
- e2e: end state shows simultaneously on all clients; summary reveals the full board; rematch
  resets to a fresh board while keeping the roster.

### Security / RLS (anti-cheat)
Type: integration (DB layer, Phase E). Priority: critical.
- As a non-Spymaster session, `select * from card_identities` returns **zero rows**.
- As a same-game Spymaster session, it returns all 25 identities.
- Unrevealed `cards.revealed_identity` is null in all client-visible reads.

## End-to-End Test Scenarios (Phase E, Playwright)
- **Host a game:** create → join (2nd context) → pick teams/roles → host starts → both see the
  5×5 grid; spymaster sees the key overlay, operative does not.
- **Play a turn:** spymaster clue → operative reveals → both boards/counters/turn update < 500 ms.
- **Disconnect & reconnect:** refresh mid-game → state rehydrates exactly.
- **Illegal action:** operative attempts a clue / acts out of turn → typed error, no state change,
  boards stay consistent.

## Performance Tests
- Client-to-client reveal propagation < 500 ms (asserted in the sync e2e).
- Edge Function authoritative round-trip < 300 ms typical.
- Initial interactive load < 2.5 s.

## Test Data Strategy
- Unit tests use a seeded RNG and in-memory inputs — no DB.
- e2e tests create throwaway rooms via the live app; anonymous sessions per browser context;
  rooms are ephemeral (no cleanup required for MVP, but prefer unique codes per run).
