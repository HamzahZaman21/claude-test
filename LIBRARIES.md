# Libraries & Exact APIs — Decrypt

> context7 MCP is **not** configured in this project, so these API references are
> pinned here from known-current usage. The DeepSeek workers cannot fetch docs —
> they must rely on this file. Use these exact call shapes.

## Versions (as installed in this project)
- `next` **16.2.6** (App Router) + `react`/`react-dom` **19.2.x**
- `@supabase/supabase-js` **v2**
- `framer-motion` **v12**
- `tailwindcss` **v4** (CSS-first config — see note below; NO `tailwind.config.js`)
- Dev/test: `vitest` **v3** (pinned — v4's rolldown runner fails under the forge engine,
  see LESSONS.md / ADR-009), `@testing-library/react`, `@testing-library/jest-dom`,
  `jsdom`, `@playwright/test`

## Tailwind v4 (IMPORTANT — different from v3)
- No `tailwind.config.js`. Config lives in CSS: `@import "tailwindcss";` then a
  `@theme { --color-...: ...; }` block in `src/app/globals.css`. Design tokens from
  DESIGN-SYSTEM.md are declared as `@theme` custom properties and used as normal Tailwind
  utility classes (e.g. `bg-bg`, `text-cyan`) or via `var(--color-...)`.
- PostCSS uses `@tailwindcss/postcss` (already configured in `postcss.config.mjs`).
- Do NOT create a `tailwind.config.js`; do NOT use `@tailwind base/components/utilities`
  (that's v3). Use the single `@import "tailwindcss";`.

## Next.js 16 App Router notes
- `app/room/[code]/page.tsx`: in Next 16 `params` is a Promise in server components
  (`const { code } = await params;`). The room page is a client container — read the code
  via `useParams()` from `next/navigation` (client) or pass it down from a server wrapper.
- Client components using hooks/realtime/state begin with `"use client"`.

## Vitest v3 config (the per-task engine test command — `npx vitest run`)
- `vitest.config.ts` uses `environment: 'jsdom'`, `globals: true`, `setupFiles:
  ['./src/test/setup.ts']` (imports `@testing-library/jest-dom`), and `include:
  ['src/**/*.{test,spec}.{ts,tsx}']` with `e2e/**` excluded. Engine tests are pure and
  need no DB/browser.

---

## @supabase/supabase-js v2 — client + auth

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

// Anonymous sign-in (must be enabled in Supabase Auth settings)
const { data, error } = await supabase.auth.signInAnonymously();
const { data: { session } } = await supabase.auth.getSession();
const { data: { user } } = await supabase.auth.getUser();
```

## Invoking Edge Functions (the only way clients mutate game state)
```ts
const { data, error } = await supabase.functions.invoke('reveal_card', {
  body: { game_id, card_id },
});
// error is a FunctionsHttpError; read the typed body:
if (error) {
  const payload = await (error as any).context?.json?.(); // { error: GameErrorCode, message }
  throw new GameApiError(payload?.error ?? 'INTERNAL', payload?.message ?? error.message);
}
```
The JWT from the current session is attached automatically.

## Postgres RPC
```ts
const { data, error } = await supabase.rpc('join_room', {
  p_code: code, p_display_name: name,
});
```

## Realtime — Postgres Changes
```ts
const channel = supabase
  .channel(`room:${roomId}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` },
    (payload) => onGame(payload.new as Game))
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'cards', filter: `game_id=eq.${gameId}` },
    (payload) => onCard(payload.new as Card))
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'clues', filter: `game_id=eq.${gameId}` },
    (payload) => onClue(payload.new as Clue))
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
    (payload) => onPlayers())
  .subscribe();

// cleanup
supabase.removeChannel(channel);
```
Requires the tables to be in the `supabase_realtime` publication and `replica identity
full` (set in migrations).

## Realtime — Presence
```ts
const presence = supabase.channel(`presence:${roomId}`, {
  config: { presence: { key: playerId } },
});
presence
  .on('presence', { event: 'sync' }, () => {
    const state = presence.presenceState(); // { [key]: meta[] }
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presence.track({ player_id: playerId, display_name, team, role });
    }
  });
```

---

## Supabase Edge Functions (Deno, TypeScript)

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role client for authoritative writes (bypasses RLS):
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Identify the caller from the forwarded JWT:
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "UNAUTHENTICATED", message: "Sign in required" }, 401);

  const body = await req.json();
  // ... validate, then call a SECURITY DEFINER rpc via `admin.rpc(...)` ...
  const { data, error } = await admin.rpc("rpc_reveal_card", {
    p_game: body.game_id, p_card: body.card_id, p_uid: user.id,
  });
  if (error) return json({ error: "INTERNAL", message: error.message }, 500);
  // rpc returns either the new state or a typed error code in its JSON result.
  return json(data, 200);
});
```
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected into the
  Edge runtime automatically.
- Always include CORS headers (`Access-Control-Allow-Origin`, `...-Headers`,
  `...-Methods`) and handle `OPTIONS`.
- Keep validation/mutation atomic by delegating to a `SECURITY DEFINER` Postgres function;
  the function returns a JSON object that includes either the new rows or `{ error, message }`.

---

## Next.js App Router notes
- Client components that use hooks/realtime start with `"use client"`.
- Read public env via `process.env.NEXT_PUBLIC_*` (inlined at build).
- Route `app/room/[code]/page.tsx`: `params` is async in latest Next — `const { code } =
  await params;` in server components; for the client container, pass code down or read via
  `useParams()`.
- Do not put the service-role key in any client component or `NEXT_PUBLIC_*` var.

## Vitest config (already written — do not add the react plugin)
The committed `vitest.config.ts` (Vitest v3) is:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
  },
});
```
Do NOT add `@vitejs/plugin-react` — it breaks the runner under the forge engine. Engine
tests (`src/test/engine.test.ts`) import pure functions from `src/lib/engine.ts` and need
no DB or browser.
