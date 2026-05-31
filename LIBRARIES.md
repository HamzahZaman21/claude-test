# Libraries & Exact APIs — Decrypt

> context7 MCP is **not** configured in this project, so these API references are
> pinned here from known-current usage. The DeepSeek workers cannot fetch docs —
> they must rely on this file. Use these exact call shapes.

## Versions (install latest stable in these major lines)
- `next` (App Router, React 19) — `create-next-app@latest`
- `react`, `react-dom`
- `@supabase/supabase-js` v2
- `framer-motion`
- `tailwindcss` (configured by create-next-app)
- Dev/test: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`,
  `@playwright/test`

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

## Vitest config (the per-task engine test command — `npx vitest run`)
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] },
});
```
Engine tests (`src/test/engine.test.ts`) import pure functions from `src/lib/engine.ts`
and need no DB or browser.
