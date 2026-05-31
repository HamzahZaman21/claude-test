# Deployment Guide — Decrypt

## Environments
| Environment | URL | Purpose |
|-------------|-----|---------|
| Production  | https://decrypt-flax.vercel.app | Live app (Vercel, `main` branch) |
| Preview     | per-PR `*.vercel.app` URLs | Auto-built for each push/PR |
| Backend     | Supabase project `xjtggteqeahlzxrrwdgq` | Postgres + Auth + Realtime + Edge Functions |

Frontend hosts on **Vercel** (project `hamzah-zamans-projects/decrypt`, connected to the
GitHub repo `HamzahZaman21/claude-test`). Backend is **Supabase** (managed).

## Prerequisites
- Node.js LTS, `git`.
- Vercel CLI (`npx vercel`) and a `VERCEL_TOKEN` (stored in `.env.mcp`, gitignored).
- Supabase access token (`.env.mcp`) for migrations / Edge Function deploys via MCP or CLI.

## Environment variables (Vercel project, all environments)
Set in the Vercel dashboard or via `vercel env add`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (inlined into the client at build).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/publishable key.
- `NEXT_PUBLIC_APP_URL` — production base URL (share links also fall back to
  `window.location.origin`).

> The **service-role key is never** set on Vercel or exposed to the client. Edge Functions
> receive `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` automatically
> from the Supabase runtime.

## Required Supabase project settings
- **Anonymous sign-ins ENABLED** (Auth → Providers, or Management API
  `external_anonymous_users_enabled: true`). The app gives every visitor an anonymous
  session; without this, nothing works.
- `rate_limit_anonymous_users` raised from the default 30 (set to 200) so multiple players
  behind one IP can join.

## Deployment process
### Frontend (Vercel)
The repo is connected to Vercel, so **pushing to `main` auto-deploys to production** and
pushes/PRs create preview deployments. Manual deploy from a local checkout:
```bash
VT=<VERCEL_TOKEN>
npx vercel@latest --prod --yes --scope hamzah-zamans-projects --token "$VT"
```

### Backend (Supabase)
Schema/RLS/RPCs are applied as migrations; Edge Functions are deployed via the Supabase
MCP (`deploy_edge_function`) or CLI (`supabase functions deploy <name>`). The six functions
are `start_game`, `submit_clue`, `reveal_card`, `end_turn`, `expire_turn`, `rematch`
(all `verify_jwt = true`). Migrations 0001–0011 define enums, tables, RLS, the realtime
publication, the word pool, and all RPCs.

## Verification after deploy
```bash
node e2e/integration-check.mjs   # 4-player game + RLS anti-cheat (against the live DB)
```
Then load the production URL, create a room, and confirm it routes to `/room/<code>`.

## Rollback
- **Frontend:** in the Vercel dashboard (or `vercel rollback <url>`), promote the previous
  READY production deployment. Deploys are immutable and instantly revertible.
- **Backend:** migrations are forward-only; to revert a schema change, apply a new
  corrective migration. Edge Functions: redeploy the previous source.
