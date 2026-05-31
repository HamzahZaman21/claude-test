# Lessons Learned

> Append an entry whenever something goes wrong during the build and how it was fixed.
> Format:
>
> ## [Date]: [Short description]
> What happened: …
> Root cause: …
> Fix: …
> Prevention: …
> Affected files: …

## 2026-05-31: Vitest 4 fails under the forge-engine test runner
What happened: The scaffolded project installed Vitest 4.1.7. The dummy test passed when
run directly via the shell (`npx vitest run`) but failed deterministically when run through
the forge-engine MCP `forge_run_tests` with `TypeError: Cannot read properties of undefined
(reading 'config')` and "0 test" collected.
Root cause: Vitest 4's new rolldown/oxc-based worker pool misbehaves in the engine's
non-TTY Python subprocess environment (the same environment every Phase D task uses to run
its frozen tests). Direct shell runs have a different process/TTY context and worked.
Fix: Pinned Vitest to stable v3 (`vitest@^3` → 3.2.4, esbuild-based). `forge_run_tests`
then passed cleanly. Recorded as ADR-009.
Prevention: The per-task test command must be verified through `forge_run_tests` (not just
the shell) before Phase D. Keep Vitest on v3 until v4's runner is confirmed compatible.
Affected files: package.json, vitest.config.ts

## 2026-05-31: Supabase anonymous sign-ins disabled by default
What happened: The app uses Supabase anonymous auth for every player, but
`signInAnonymously()` failed with "Anonymous sign-ins are disabled" (HTTP 422).
Root cause: New Supabase projects ship with anonymous sign-in turned OFF, and the
Supabase MCP exposes no auth-config tool to toggle it.
Fix: Enabled it via the Management API with the existing access token:
`PATCH https://api.supabase.com/v1/projects/<ref>/config/auth` body
`{"external_anonymous_users_enabled": true}` → 200. Re-verified `signInAnonymously()`
returns an anonymous user.
Prevention: Verify runtime auth dependencies early in Phase B. Documented in DEPLOYMENT.md
as a required project setting for any new environment.
Affected files: (Supabase project auth config — no repo file)

## 2026-06-01: Forge engine unusable here — file-format parser + node_modules corruption
What happened: Phase D `forge_start_build` (3 DeepSeek workers) blocked 4 of the first 5
no-dependency tasks; only TASK-004 merged. Two independent engine problems:
(1) **File-output parse failure.** The engine's `write_files_from_response` extracts files
    with the regex `=== FILE: path ===\n…\n=== END FILE ===`. The DeepSeek workers emitted
    the opening `=== FILE: ===` header but OMITTED the closing `=== END FILE ===`, so the
    regex matched nothing and the engine dumped the RAW response (header line included) into
    the file → invalid TS (`esbuild: Unexpected "==="`). Workers also renamed files
    (`types.ts`→`domain.ts`). `forge_apply_feedback` with explicit format+path guidance did
    NOT fix it — the model kept dropping the closing delimiter.
(2) **node_modules destroyed.** The engine links deps into each worktree via a Windows
    junction (`mklink /J node_modules`). Its worktree teardown then deleted *through* the
    junction, removing packages from the MAIN project `node_modules` (vitest vanished), and
    poisoned the `npx` cache so even `npx vitest` in the main repo failed with
    "Cannot find module 'vitest/config'".
Root cause: worker output-format drift the engine can't tolerate, plus a junction-deletion
hazard in worktree cleanup on Windows.
Fix: Cleared the poisoned `_npx` cache and ran `npm ci` to restore node_modules. Abandoned
the engine for the remaining tasks and completed Phase D via **orchestrator handoff**
(escalation ladder step 3): implemented the frontend/lib/engine directly against the
TASK-MANIFEST contracts, verifying with `npx vitest run` + `npm run build`. Did NOT re-run
`forge_start_build`/`resume`/`apply_feedback` (each re-corrupts node_modules).
Prevention: For this engine on Windows, run with workers=1 and/or disable
`worktree_link_dirs` and `npm ci` per worktree; or fix the engine's response parser to be
delimiter-tolerant and its teardown to not follow junctions. Tracked for the workflow team.
Affected files: node_modules (restored), src/lib/* (built by handoff)

## 2026-06-01: Three backend bugs caught by the Phase E integration script
What happened: A 4-player backend integration script (e2e/integration-check.mjs) surfaced
three issues no unit test could:
1. `gen_room_code()` — local variable named `code` collided with `rooms.code` in the
   uniqueness `EXISTS` check → "column reference code is ambiguous"; room creation failed.
   Fix: renamed the variable to `v_code` (migration 0009).
2. **Missing table GRANTs.** Tables created via raw-SQL `apply_migration` did NOT receive
   the default `authenticated`/`anon` privileges the Supabase dashboard would add, so every
   client query failed with "permission denied for table players" BEFORE RLS even ran. RLS
   policies are necessary but not sufficient — the table-level GRANT is a prerequisite.
   Fix: granted SELECT (and players INSERT/UPDATE/DELETE) to `authenticated`; RLS still
   scopes rows (migration 0010).
3. `rpc_reveal_card` compared `card_identity = team_color` (two different enum types — no
   operator) → "operator does not exist". Fix: compare via `::text` (migration 0011).
Prevention: Always run a real end-to-end backend integration pass (anonymous client →
RPC/Edge Function → RLS) before declaring the data layer done; unit tests on pure logic
cannot catch SQL/enum/grant issues. After raw-SQL table creation, explicitly GRANT to
`authenticated`.
Affected files: migrations 0009–0011 (Supabase), e2e/integration-check.mjs

## 2026-06-01: Two UI bugs found by actually playing the deployed game (not just unit/backend tests)
What happened: After deploy, clicking "Start game" hung on "Starting…" and never showed the
board; and the Spymaster saw no secret-key overlay.
Root causes: (1) The room page decided lobby-vs-board from `room.status`, but the `rooms`
table was NOT in the realtime publication and was never subscribed, so the client's
`room.status` never flipped to `in_game`. (2) `useGameState` received the `localPlayer`
object captured at join time (role `none`), so after the player picked Spymaster in the
lobby the hook still thought they weren't one and never fetched `card_identities`.
Fix: (1) added `rooms` to the realtime publication (mig 0012) + subscribed to it, and
gated the board on the realtime-published `games` row (`if (!game) show Lobby`), plus a
`refresh()` snapshot safety net after start/rematch. (2) `useGameState` now takes
`localPlayerId` and derives the live role from the `players` list, re-fetching the
spymaster key when role/ game changes. Verified end-to-end in the deployed app (Start →
board, live clue/reveal sync, spymaster key overlay with assassin/neutral/agent icons).
Prevention: **Always play the actual deployed UI** (start → clue → reveal), not just unit
and direct-API tests — these were client-state/realtime bugs invisible to both. When a view
depends on a table's column, that table must be in the realtime publication. Derive live
role/team from the roster, never from a snapshot captured at join.
Affected files: migration 0012, src/lib/realtime.ts, src/lib/useGameState.ts,
src/app/room/[code]/page.tsx
