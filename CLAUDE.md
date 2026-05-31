# Decrypt

Real-time multiplayer word-deduction party game. Two teams race to identify their agents
on a shared 5×5 grid from one-word Spymaster clues. Headline requirement: perfect
cross-client state consistency (< 500 ms) with a server-authoritative, anti-cheat design.

## Critical Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Test: `npx vitest run`
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`

> The Test command is the **unit** runner (Vitest). It must stay fast and headless — no
> dev server, no browser. Playwright e2e runs only in Phase E via the orchestrator.

## Architecture
- Business/game-rule logic: pure functions in `src/lib/engine.ts` (unit-tested).
- Authoritative mutations: Supabase **Edge Functions** in `supabase/functions/` (service
  role) delegating to `SECURITY DEFINER` Postgres RPCs. Clients NEVER write game tables.
- UI components: `src/components/` (presentational); pages in `src/app/`.
- Data access / realtime: `src/lib/` (`supabaseClient`, `api`, `rooms`, `realtime`,
  `useGameState`).
- Auth: Supabase **anonymous** sessions; each player is RLS-scoped by `auth.uid()`.
- Schema + RLS: `supabase/migrations/`. See @SCHEMA.md.

## Coding Standards
- TypeScript strict everywhere (including Edge Functions). No `any` in public signatures.
- React function components; client components that use hooks/realtime begin `"use client"`.
- All Edge Function results use the typed `GameError` envelope on failure; never leak
  internal errors to the client.
- Game-rule math lives ONLY in `src/lib/engine.ts` as pure functions — do not duplicate
  rules in components.
- Centralize user-facing copy for future localization. SVG icons only (no emoji).
- Match existing file conventions; keep components presentational and data in `src/lib/`.

## Security Defaults
- Validate and sanitize ALL inputs server-side (clue word/number, ids).
- Use parameterized queries / RPC args — never string-concatenate SQL.
- Every Edge Function verifies the JWT and the caller's role/team/turn before mutating.
- **Unrevealed card identities live in `card_identities`; RLS permits SELECT only to a
  same-game Spymaster.** Hiding in the UI is NOT security.
- All game tables have RLS enabled with NO client write policy — only the service role
  (Edge Functions) writes them.
- The turn timer is server-anchored (`turn_deadline`); never trust client clocks for
  authority.
- Never log secrets/tokens. Service-role key never appears in client code or `NEXT_PUBLIC_*`.

## Do Not Touch (Safety Locks)
- `.env`, `.env.*` (`.env.local`, `.env.mcp`, `.env.secrets`) — NEVER modify env files.
- `supabase/migrations/**` — never hand-edit applied migration history.
- `.github/workflows/**`, `Dockerfile`, lock files — only with explicit approval.
- `.claude/protected-paths.txt` and the hook scripts.
- See `.claude/protected-paths.txt` for the enforced list (PreToolUse hook blocks edits).

## Reference Documents
- @PROJECT.md — product context and success criteria
- @ARCHITECTURE.md — system structure and data flow
- @SCHEMA.md — database schema, RLS, realtime publication
- @API.md — Edge Function / RPC / realtime contracts
- @TECHNICAL-DESIGN.md — full module contracts (source of truth for tasks)
- @DESIGN-SYSTEM.md — color, type, motion, accessibility tokens
- @LIBRARIES.md — exact Supabase/Next.js/Edge API usage
- @DECISIONS.md — architectural decisions (consult before changing direction)
- @TEST-PLAN.md — test strategy and coverage targets
- @STABLE.md — modules verified stable (consult before modifying)
