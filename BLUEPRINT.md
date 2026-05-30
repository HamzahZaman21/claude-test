# Blueprint: Decrypt — Real-Time Multiplayer Word-Deduction Game

```yaml
Meta:
  blueprint_version: "1.0"
  created: "2026-05-31"
  status: "approved"
  project_phase: "new"
  reuse_source: "none"
```

> **Why this blueprint exists:** It is intentionally designed to exercise the
> *entire* Forge workflow end to end — Supabase (Postgres + Auth + Realtime +
> Row Level Security + Edge Functions), Vercel deployment, a complex and
> genuinely beautiful animated UI, multi-client real-time synchronization, and
> Playwright multi-browser end-to-end tests. The single hardest requirement —
> and the primary thing under test — is **cross-client state consistency**:
> two or more browsers must always agree on the game state, in real time, with
> no desync, even across disconnects and reconnects.

---

## 1. Project Identity
* **Name**: Decrypt
* **One-Line Description**: A real-time, browser-based multiplayer party game where two teams race to identify their secret agents on a shared 5×5 word grid, guided by one-word clues from their team's Spymaster.
* **Problem Statement**: Most browser multiplayer games desync — one player's screen shows a different board, turn, or score than another's, breaking trust in the game. Decrypt is built around a single authoritative server state streamed to every client in real time, proving a multiplayer architecture where every browser is always in perfect agreement.

---

## 2. Target Users
* **Primary Users**: Friend groups (3–8 people) who want a quick, social word game playable in any browser with no install, by sharing a room code.
* **Secondary Users**: Remote teams using it as an icebreaker.
* **Technical Level**: Non-technical. Must work for anyone who can open a link and type a name. Zero setup for players.

---

## 3. Vision & Success
* **Product Vision**: A polished, fast, beautiful party game that feels instant and trustworthy — clue in, cards flip for everyone simultaneously, the turn passes cleanly, the winner is celebrated. It should feel like a premium native app running in the browser.
* **Success Criteria**:
  * Two teams (Cyan and Amber) can play a complete game from lobby to win/loss.
  * **A card revealed on one client appears on every other client in under 500 ms.** No client ever shows stale board state.
  * The turn indicator, remaining-card counts, current clue, and turn timer are **identical on every connected client at all times**.
  * A player who refreshes or briefly disconnects rejoins and sees the **exact current authoritative state** (board, turn, clue, scores), not a stale or reset view.
  * Operatives **cannot** learn unrevealed card identities by any means (UI, network inspection, or direct database query) — only their own team's Spymaster sees the key.
  * The UI is visually striking, responsive (desktop + mobile), animated, and accessible.
* **3–6 Month Direction**: Custom word packs, spectator mode, rematch/series scoring, emoji reactions, and voice-room integration.

---

## 4. Core Features (MVP)

* **Feature: Lobby & Room Management**
  * *Description*: Create a room (generates a 6-character join code), or join an existing room by code. Players set a display name, pick a team (Cyan/Amber) and a role (Spymaster/Operative). The host starts the game when each team has at least one Spymaster and one Operative.
  * *Why MVP*: Entry point for all multiplayer flows.
  * *Acceptance Criteria*: Room codes are unique and shareable via URL; joining shows the live roster updating in real time as others join/leave; role/team constraints are enforced (exactly one Spymaster per team to start); only the host can start; invalid/expired codes show a clear error.
  * *Data Requirements*: rooms, players, team/role assignments.
  * *Dependencies*: Auth (anonymous session per player).

* **Feature: Authoritative Game Engine (Server-Side)**
  * *Description*: All game-mutating actions (start game, submit clue, reveal a card, end turn) are processed by an authoritative server function that validates the action against the current state and the acting player's role/team, then writes the new state. Clients never compute authoritative state locally.
  * *Why MVP*: This is the core of the no-desync guarantee and anti-cheat.
  * *Acceptance Criteria*: An action that is illegal for the current turn/role is rejected server-side with a typed error; the board layout (which card belongs to which team, neutrals, and the single assassin) is generated server-side and stored such that only Spymasters can read unrevealed identities; revealing a card applies the correct rules (own-team card → continue; neutral → end turn; opponent card → end turn and credit opponent; assassin → immediate loss); win conditions are computed server-side.
  * *Data Requirements*: games, cards (with hidden identities), turns, clues, reveals.
  * *Dependencies*: Supabase Edge Functions / Postgres RPC, RLS.

* **Feature: Real-Time Board Synchronization**
  * *Description*: Every client subscribes to the room's game state and re-renders from the authoritative server state. Card reveals, clue submission, turn changes, score/counter changes, and the turn timer all propagate live to every client.
  * *Why MVP*: The headline requirement — perfect cross-browser consistency.
  * *Acceptance Criteria*: With two browsers open in the same room, an action in one is reflected in the other within 500 ms; no client can be coaxed into a divergent state; optimistic UI updates (e.g., a card flip) are reconciled against the authoritative broadcast and corrected if the server rejected the action.
  * *Data Requirements*: Realtime subscription to game state changes.
  * *Dependencies*: Supabase Realtime (Postgres Changes + Broadcast).

* **Feature: Presence & Connection Status**
  * *Description*: Live presence showing who is online, which team/role they hold, whose turn it is, and a per-player connection indicator. Reconnection rehydrates full state.
  * *Why MVP*: Players must trust that everyone sees the same live game.
  * *Acceptance Criteria*: A player closing their tab disappears from the roster within ~5 s for everyone; rejoining restores their seat and the current game state exactly; the "current turn" highlight is consistent for all.
  * *Data Requirements*: Presence channel per room.
  * *Dependencies*: Supabase Realtime Presence.

* **Feature: Spymaster Clue Flow & Turn Timer**
  * *Description*: The active team's Spymaster submits a one-word clue and a number; operatives then guess by clicking cards until they end their turn, guess wrong, or hit the number+1 limit. A visible countdown timer bounds each phase.
  * *Why MVP*: Core gameplay loop.
  * *Acceptance Criteria*: Clue validation (single word, positive integer) enforced server-side; the clue and remaining guesses display identically on all clients; the timer is server-anchored so all clients agree on time remaining; timer expiry ends the turn for everyone simultaneously.
  * *Data Requirements*: clues, guess counters, server-anchored turn deadlines.
  * *Dependencies*: Game engine, Realtime.

* **Feature: Win / Loss & Game Summary**
  * *Description*: When a team reveals all its agents (win) or an operative hits the assassin (instant loss), the game ends with a celebratory, animated summary screen and an option to rematch.
  * *Why MVP*: Closes the gameplay loop.
  * *Acceptance Criteria*: End state shows simultaneously on all clients; the full board is revealed in the summary; rematch resets to a fresh board while keeping the roster.
  * *Data Requirements*: game result, final board reveal.
  * *Dependencies*: Game engine.

---

## 5. User Flows

### Primary Flow: Host a Game
1. User opens the app and is given an anonymous session automatically.
2. User clicks "Create Room", enters a display name → receives a room with a 6-char code and a shareable URL.
3. Host picks team (Cyan) and role (Spymaster). Others join via the URL/code and pick teams/roles; the roster updates live for everyone.
4. Host clicks "Start Game" once each team has a Spymaster and at least one Operative.
5. The 5×5 grid appears for everyone simultaneously. Spymasters additionally see the secret color key overlaid on the cards; Operatives see only the words.

### Primary Flow: Play a Turn
1. The active team's Spymaster types a one-word clue + a number and submits.
2. The clue appears on every client. Operatives on that team click cards to guess.
3. Each reveal animates and updates the board, counters, and turn state on **all** clients in real time.
4. Turn ends on a wrong guess, the guess limit, the timer expiring, or "End Turn". Control passes to the other team for everyone at once.

### Secondary Flow: Disconnect & Reconnect
1. A player refreshes the page mid-game.
2. On reload, their anonymous session is restored and the client fetches the authoritative game state.
3. The board, turn, clue, counters, and timer render exactly as they are for everyone else — no desync, no reset.

### Edge Flow: Illegal Action Attempt
1. An Operative tries to submit a clue, or a player acts out of turn (e.g., via a crafted request).
2. The server rejects it with a typed error; no state changes; the client shows a non-blocking error and the board stays consistent everywhere.

---

## 6. Design & Experience
* **Project Archetype**: Premium real-time multiplayer party game (web).
* **Visual Style**: Modern "neon spy console" — deep near-black background (`#0A0E1A`), glassmorphic panels with subtle blur, and two strong team identities: **Cyan** (`#22D3EE`) and **Amber** (`#F59E0B`). Neutral cards in warm grey (`#9CA3AF`), the assassin in danger crimson (`#EF4444`). Crisp modern sans-serif for UI (e.g., Inter), with a slightly technical/monospace accent for codes and the timer. Generous spacing, rounded cards, soft glows, and tactile depth.
* **Motion**: Card flips on reveal (3D flip), team-colored glow pulses on the active turn, a smooth countdown ring for the timer, confetti/scanline celebration on win, and gentle entrance animations. All motion respects `prefers-reduced-motion`.
* **Platform**: Responsive web — must be excellent on desktop and fully usable on mobile portrait.
* **Accessibility**: WCAG AA contrast for all text and card states; full keyboard navigation (tab to cards, enter to reveal); visible focus rings; color is never the *only* signal (icons/labels distinguish team ownership for color-blind users); screen-reader labels announce reveals and turn changes.
* **Interaction Feel**: Instant, tactile, trustworthy. Optimistic flips that reconcile to server truth. Clear "whose turn" affordance. No spinners longer than a beat.
* **Quality Bar**: The UI must look like a shipped, designed product — not a prototype. This is explicitly verified in the Phase E visual review against DESIGN-SYSTEM.md.

---

## 7. Technical Preferences
* **Frontend**: Next.js (App Router, latest stable) + React + TypeScript.
* **Styling**: Tailwind CSS with a token-driven design system; Framer Motion for animation.
* **Backend / Data**: Supabase — Postgres (data), Auth (anonymous sign-in), Realtime (Postgres Changes, Broadcast, Presence), Row Level Security (authorization), and Edge Functions (Deno) for authoritative game mutations.
* **Hosting**: Vercel (frontend + serverless), Supabase (managed backend).
* **Language**: TypeScript everywhere (including Edge Functions).
* **Testing**: Vitest (unit/logic), Playwright (end-to-end, including **multi-browser-context sync tests** that open two clients and assert state convergence).
* **Hard Constraints**:
  * Clients are **never** the source of truth for game state. All mutations go through server-side authoritative logic (Edge Function or Postgres RPC) guarded by RLS.
  * The turn timer is **server-anchored** (store a deadline timestamp; clients render from it) so all clients agree on time remaining.
  * Unrevealed card identities are protected by RLS such that only the requesting player's own-team Spymaster can read them.
  * Real-time propagation target: <500 ms client-to-client on a normal connection.

---

## 8. Data Model
> Final field-level schema is produced in SCHEMA.md; this is the intended model.

* **rooms**: id (uuid, pk), code (text, unique, 6 chars), host_player_id (uuid), status (enum: `lobby` | `in_game` | `finished`), created_at.
* **players**: id (uuid, pk), room_id (fk → rooms), auth_user_id (uuid, from Supabase Auth), display_name (text), team (enum: `cyan` | `amber` | `none`), role (enum: `spymaster` | `operative` | `none`), is_host (bool), last_seen_at (timestamptz).
* **games**: id (uuid, pk), room_id (fk), starting_team (enum), current_team (enum), phase (enum: `clue` | `guess` | `finished`), winner (enum: `cyan` | `amber` | null), turn_deadline (timestamptz, server-anchored), created_at.
* **cards**: id (uuid, pk), game_id (fk), position (int 0–24), word (text), identity (enum: `cyan` | `amber` | `neutral` | `assassin`), revealed (bool, default false), revealed_by_team (enum, null). **RLS: `identity` of unrevealed cards is readable only by a Spymaster on the same game; `word`, `position`, `revealed`, `revealed_by_team` are readable by all players in the room.**
* **clues**: id (uuid, pk), game_id (fk), team (enum), word (text), number (int), created_at.
* **Relationships**: a room has many players and (over time) games; a game has 25 cards and many clues. RLS policies scope every row to members of the room.
* **Data Sensitivity**: Card identities are the secret; protect via RLS + server-only reveal logic. No PII beyond a chosen display name.

---

## 9. Integrations & Third-Party Services
* **Supabase** — database, auth, realtime, edge functions. Configured via the Supabase MCP and project env vars.
* **Vercel** — hosting/deploy. Configured via the Vercel MCP and/or Git integration.
* **GitHub** — source repository (optional, via GitHub MCP).
* **A static word list** — bundled in-repo (no external API needed for MVP).

---

## 10. Security & Access Control
* **Authentication**: Supabase **anonymous sign-in** — every visitor gets a session automatically; display name is chosen per room. (Optional later: link to email.)
* **Authorization (RLS)**: Every table has Row Level Security enabled.
  * A player may read/write only rows belonging to a room they are a member of.
  * **Card identities for unrevealed cards are readable only by a Spymaster of the same game** — enforced at the database layer, not just the UI.
  * Game-mutating writes are performed only by the authoritative Edge Function (service role), never directly by clients.
* **Anti-cheat**: All reveal/clue/turn logic is server-validated; a malicious client cannot reveal cards, peek at identities, or act out of turn.

---

## 11. Localization
* English only for MVP. Copy centralized to allow future localization.

---

## 12. Scale & Performance
* Target: rooms of up to 8 players; dozens of concurrent rooms.
* Real-time updates client-to-client < 500 ms.
* Initial interactive load < 2.5 s on a typical connection.
* Edge Function authoritative action round-trip < 300 ms typical.

---

## 13. Environment Manifest
> Drives `.env.secrets.template` (no values) and `.env.config` (safe defaults).

* **Public (client) config**:
  * `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
  * `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/publishable key.
  * `NEXT_PUBLIC_APP_URL` — deployed app base URL (for share links).
* **Secrets (server only)**:
  * `SUPABASE_SERVICE_ROLE_KEY` — used by Edge Functions for authoritative writes.
  * `SUPABASE_PROJECT_REF` — project ref (for Supabase MCP/CLI).
  * `SUPABASE_ACCESS_TOKEN` — Supabase personal access token (for MCP/CLI).
  * `VERCEL_TOKEN` — for Vercel MCP/deploy.
* **Engine config** (already set in the workflow system): `LLM_API_KEY`.
* **Config defaults**: turn timer length (e.g., 60s guess / 90s clue), board size (5×5 = 25 cards), team colors.

---

## 14. Existing Project Context
* N/A — greenfield project.

---

## 15. Reuse References
* None. (If a prior project produced a reusable Supabase-Realtime auth/presence module, the orchestrator may reference PORTFOLIO.md.)

---

## 16. Domain-Specific Requirements
* **Word-deduction game rules** (Codenames-style, original implementation — do not use any trademarked assets or copyrighted word lists; generate/curate an original word list):
  * 25 cards. The starting team has 9 agents, the other team 8, plus 7 neutral bystanders and 1 assassin.
  * Spymaster gives a one-word clue + a number N; their operatives may make up to N+1 guesses.
  * Reveal outcomes: own agent → may continue; neutral → turn ends; opponent agent → turn ends and counts for the opponent; assassin → guessing team loses immediately.
  * A team wins by revealing all of its agents.
* **Real-time correctness (the core domain challenge)**:
  * Single source of truth on the server; clients render from streamed authoritative state.
  * Server-anchored timers (deadline timestamps), not client countdowns.
  * Idempotent, validated mutations; out-of-order or duplicate events must not corrupt state.
  * Reconnection rehydrates full state; presence reflects real connection status.

---

## 17. Plain Language Decision Log
* **Decision**: Authoritative server-side game logic via Supabase Edge Functions + RLS, not client-side state.
  * *Reasoning*: This is the only reliable way to guarantee every browser agrees and to prevent cheating/peeking. Directly solves the "browsers out of sync" problem.
* **Decision**: Supabase Realtime (Postgres Changes + Broadcast + Presence) for live updates.
  * *Reasoning*: Managed, low-latency, integrates with Postgres + RLS, and removes the need to run a custom websocket server.
* **Decision**: Card identities protected by RLS, not just hidden in the UI.
  * *Reasoning*: Hiding in the UI is not security; operatives could read the network/db. RLS enforces the secret at the data layer — a genuine authorization test.
* **Decision**: Next.js on Vercel + Supabase.
  * *Reasoning*: Fast path to a production, shareable, deployed multiplayer app and a strong exercise of the full Supabase + Vercel toolchain.
* **Decision**: Anonymous auth.
  * *Reasoning*: Zero-friction for players (just open a link) while still giving each player a real, RLS-scoped identity.

---

## 18. Post-Approval Handoff Checklist
- [ ] Save this document as `BLUEPRINT.md` in the project root (done — this file).
- [ ] Node.js LTS installed; `git` available.
- [ ] **Supabase**: create a project; record the Project URL, anon key, and service role key; create a Personal Access Token; note the Project Ref.
- [ ] **Vercel**: create an account/project; create a token (`VERCEL_TOKEN`).
- [ ] **GitHub**: create an empty repo and add it as the `origin` remote (the forge prompt expects a git remote).
- [ ] Configure MCP servers in the fresh Claude Code window: `forge-engine`, `supabase` (with `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN`), `playwright`, and optionally `vercel` and `context7`. See `workflow-system-v2/config/mcp-servers.example.json`.
- [ ] Put the public/secret values into `.env.secrets` (from the generated template) and `.env.config`.
- [ ] Ensure `LLM_API_KEY` is set for the Forge Engine (already configured in the workflow system).
- [ ] Paste the Forge prompt into the fresh Claude Code window with this folder open, and let it run.
