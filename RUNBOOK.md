# Operational Runbook — Decrypt

## Monitoring
- **Vercel dashboard** → Deployments (build status, function logs, analytics) for the
  `decrypt` project.
- **Supabase dashboard** → Logs (Postgres, Auth, Edge Functions), Realtime inspector,
  and Database → Advisors (run after any schema change).
- Quick health check: `GET https://decrypt-flax.vercel.app` returns 200 and the app
  shell; `node e2e/integration-check.mjs` exercises the full authoritative path + RLS.

## Common issues
| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| "Anonymous sign-ins are disabled" / cannot start a session | Supabase anonymous auth turned off | Enable it (Auth → Providers, or Management API `external_anonymous_users_enabled: true`) |
| "Request rate limit reached" on join | `rate_limit_anonymous_users` too low for many players on one IP | Raise it in Auth rate-limit settings (currently 200) |
| "permission denied for table …" | Missing table GRANT to `authenticated` after a new raw-SQL table | `grant select … to authenticated;` (RLS still scopes rows) — see migration 0010 |
| Board/clue/turn not updating across clients | Table missing from `supabase_realtime` publication or `replica identity` not `full` | Re-add to publication; `alter table … replica identity full` |
| Spymaster sees no key / operative sees identities | `card_identities` RLS policy wrong | Policy must be `is_game_spymaster(game_id)`; verify with the integration check |
| Clients can write game tables | A client-write policy was added | Remove it — only the service role (Edge Functions) may write `games/cards/card_identities/clues` |
| Build fails on Vercel | Missing `NEXT_PUBLIC_*` env vars | Add them to the Vercel project (all environments) and redeploy |

## Anti-cheat invariant (must always hold)
A non-spymaster session running `select * from card_identities` returns **zero rows**, and
unrevealed `cards.revealed_identity` is null in every client-visible read. This is enforced
by RLS, not the UI. `e2e/integration-check.mjs` asserts it; re-run after any RLS/schema
change. If it ever fails, treat as a security incident: revoke the offending policy/grant
immediately.

## Emergency procedures
- **Bad frontend deploy:** roll back to the previous READY deployment in Vercel
  (instant, immutable deploys).
- **Bad migration:** apply a corrective forward migration (migrations are forward-only).
  Validate with `get_advisors` (security + performance) afterward.
- **Suspected secret leak:** rotate the Supabase service-role key and `VERCEL_TOKEN`; they
  live only in `.env.local` / `.env.mcp` (gitignored) and the Supabase/Vercel runtimes —
  never in client code or `NEXT_PUBLIC_*`.
- **Realtime outage:** clients still fetch the authoritative snapshot on load and on
  reconnect (`useGameState` re-snapshots), so a refresh recovers correct state.

## Contact points
- Frontend/hosting: Vercel project `hamzah-zamans-projects/decrypt`.
- Backend/data: Supabase project `xjtggteqeahlzxrrwdgq`.
- Source: GitHub `HamzahZaman21/claude-test` (push to `main` → auto-deploy).
