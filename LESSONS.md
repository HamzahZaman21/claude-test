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
