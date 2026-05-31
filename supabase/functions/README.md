# Supabase Edge Functions — Decrypt

These six **authoritative** functions are the only public entry points for game
mutations. Each verifies the caller's JWT (`verify_jwt: true`), then calls the matching
`SECURITY DEFINER` Postgres RPC with the service role and the verified `user.id`. The RPCs
(in the migrations) do the atomic, validated mutation and return either the new state or a
typed `{ error, message }` envelope.

They were deployed via the Supabase MCP (`deploy_edge_function`) and are ACTIVE on project
`xjtggteqeahlzxrrwdgq`. To redeploy from local source, use the Supabase CLI
(`supabase functions deploy <name>`) — each `index.ts` is self-contained (it inlines the
helpers documented in `_shared/respond.ts`: `corsHeaders`, `STATUS`, `json`).

## Canonical template (every function follows this shape)
```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// corsHeaders, STATUS, json inlined (see _shared/respond.ts)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "UNAUTHENTICATED", message: "Sign in required" }, 401);

    const body = await req.json().catch(() => ({}));
    /* validate required fields for this function → INVALID_INPUT (400) */

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin.rpc("<rpc_name>", { /* args incl. p_uid: user.id */ });
    if (error) return json({ error: "INTERNAL", message: error.message }, 500);
    if (data?.error) return json(data, STATUS[data.error] ?? 400);
    return json(data, 200);
  } catch (e) {
    return json({ error: "INTERNAL", message: String(e) }, 500);
  }
});
```

## Per-function specifics
| Function | Required body | RPC called | RPC args |
|----------|---------------|------------|----------|
| `start_game`  | `room_id` | `rpc_start_game`  | `p_room, p_uid` |
| `submit_clue` | `game_id, word:string, number:number` | `rpc_submit_clue` | `p_game, p_word, p_number, p_uid` |
| `reveal_card` | `game_id, card_id` | `rpc_reveal_card` | `p_game, p_card, p_uid` |
| `end_turn`    | `game_id` | `rpc_end_turn`    | `p_game, p_uid` |
| `expire_turn` | `game_id` | `rpc_expire_turn` | `p_game, p_uid` |
| `rematch`     | `room_id` | `rpc_rematch`     | `p_room, p_uid` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected by the Edge
runtime automatically. The `rpc_*` functions are granted to `service_role` only, so clients
cannot bypass these gateways. See API.md and TECHNICAL-DESIGN.md §4.
