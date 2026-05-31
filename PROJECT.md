# Decrypt

## What This Is
A real-time, browser-based multiplayer party game where two teams race to identify their
secret agents on a shared 5×5 word grid, guided by one-word clues from their team's
Spymaster.

## The Problem
Most browser multiplayer games desync — one player's screen shows a different board, turn,
or score than another's, which breaks trust in the game. Decrypt is built around a single
authoritative server state streamed to every client in real time, proving a multiplayer
architecture where every browser is always in perfect agreement.

## Who Uses This
- **Primary:** friend groups of 3–8 people who want a quick, social word game playable in
  any browser with no install, by sharing a room code. Non-technical — it must work for
  anyone who can open a link and type a name. Zero setup.
- **Secondary:** remote teams using it as an icebreaker.

## What Success Looks Like
A polished, fast, beautiful party game that feels instant and trustworthy: a clue goes in,
cards flip for everyone simultaneously, the turn passes cleanly, the winner is celebrated.
It should feel like a premium native app running in the browser.

## Success Criteria
- Two teams (Cyan and Amber) can play a complete game from lobby to win/loss.
- A card revealed on one client appears on every other client in **under 500 ms**; no
  client ever shows stale board state.
- Turn indicator, remaining-card counts, current clue, and turn timer are **identical on
  every connected client at all times**.
- A player who refreshes or briefly disconnects rejoins and sees the **exact current
  authoritative state**, not a stale or reset view.
- Operatives **cannot** learn unrevealed card identities by any means (UI, network, or
  direct DB query) — only their own team's Spymaster sees the key (enforced by RLS).
- The UI is visually striking, responsive (desktop + mobile portrait), animated, and
  accessible (WCAG AA).

## Product Direction (3–6 months)
Custom word packs, spectator mode, rematch/series scoring, emoji reactions, and voice-room
integration. Build for clean extension, but optimize the MVP for correctness and polish of
the core loop — not premature generality.

## Design Intent
Premium real-time multiplayer party game. Visual style: **"neon spy console"** — deep
near-black background, glassmorphic blurred panels, two strong team identities (Cyan and
Amber), neutral warm grey, assassin danger crimson. Inter for UI with a monospace accent
for room codes and the timer. Generous spacing, rounded cards, soft glows, tactile depth.
Motion: 3D card flips on reveal, team-colored glow on the active turn, a smooth countdown
ring, confetti/scanline win celebration — all respecting `prefers-reduced-motion`.
Interaction must feel instant, tactile, and trustworthy: optimistic flips that reconcile
to server truth, a clear "whose turn" affordance, no spinners longer than a beat. The UI
must look like a shipped, designed product — verified in the Phase E visual review against
DESIGN-SYSTEM.md.

## Domain Context
Original Codenames-style word-deduction game (no trademarked assets; original curated word
list). 25 cards: starting team has 9 agents, other team 8, plus 7 neutrals and 1 assassin.
A Spymaster gives a one-word clue + number N; their operatives may guess up to N+1 times.
Reveal outcomes: own agent → may continue; neutral → turn ends; opponent agent → turn ends
and credits the opponent; assassin → the guessing team loses immediately. A team wins by
revealing all of its agents. The core domain challenge is **real-time correctness**: a
single server source of truth, server-anchored timers, idempotent validated mutations, and
reconnection that rehydrates full state. See SCHEMA.md and TECHNICAL-DESIGN.md.

## Localization
English only for MVP. UI copy centralized to allow future localization; no i18n framework
required now.
