// Phase E backend integration + anti-cheat check (run with: node e2e/integration-check.mjs).
// Spins up 4 anonymous players, starts a real game through the authoritative Edge Functions,
// and asserts the RLS guarantee: an operative sees ZERO card_identities; a spymaster sees 25.
// Also exercises clue + reveal + an illegal action, then cleans up with the service role.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const get = (k) => env.match(new RegExp(`${k}=(.*)`))[1].trim();
const URL_ = get('NEXT_PUBLIC_SUPABASE_URL');
const ANON = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY');

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
  if (!cond) failures++;
};

function client() {
  return createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function anon() {
  const c = client();
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error('anon sign-in failed: ' + error.message);
  return c;
}

async function rpc(c, fn, args) {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(`${fn} error: ${error.message}`);
  return data;
}

async function invoke(c, name, body) {
  const { data, error } = await c.functions.invoke(name, { body });
  if (error) {
    let payload;
    try { payload = await error.context.json(); } catch { /* ignore */ }
    return { error: payload?.error ?? 'INTERNAL', message: payload?.message ?? error.message };
  }
  return data;
}

async function main() {
  const host = await anon();
  const op1 = await anon();
  const sm2 = await anon();
  const op2 = await anon();

  // Host creates the room.
  const created = await rpc(host, 'create_room', { p_display_name: 'Host' });
  const room = created.room;
  const hostPlayer = created.player;
  ok(!!room?.code && room.code.length === 6, `room created with 6-char code (${room?.code})`);

  // Host = cyan spymaster.
  await host.from('players').update({ team: 'cyan', role: 'spymaster' }).eq('id', hostPlayer.id);

  // Others join and take seats: cyan operative, amber spymaster, amber operative.
  const seats = [
    [op1, 'Op1', 'cyan', 'operative'],
    [sm2, 'Sm2', 'amber', 'spymaster'],
    [op2, 'Op2', 'amber', 'operative'],
  ];
  const players = { [hostPlayer.id]: hostPlayer };
  for (const [c, name, team, role] of seats) {
    const j = await rpc(c, 'join_room', { p_code: room.code, p_display_name: name });
    await c.from('players').update({ team, role }).eq('id', j.player.id);
    players[j.player.id] = { ...j.player, team, role, client: c };
  }

  // Illegal: an operative cannot start the game (NOT_HOST).
  const badStart = await invoke(op1, 'start_game', { room_id: room.id });
  ok(badStart.error === 'NOT_HOST', `operative start_game rejected with NOT_HOST (got ${badStart.error})`);

  // Host starts.
  const started = await invoke(host, 'start_game', { room_id: room.id });
  ok(!!started.game?.id, 'host started the game');
  const game = started.game;
  ok(game.cyan_remaining + game.amber_remaining === 17, `agent counts sum to 17 (9+8) (got ${game.cyan_remaining}+${game.amber_remaining})`);

  // ---- THE ANTI-CHEAT CHECK ----
  // Operative reads card_identities → must be ZERO rows (RLS denies).
  const opKey = await op1.from('card_identities').select('*').eq('game_id', game.id);
  ok((opKey.data?.length ?? 0) === 0, `operative reads 0 card_identities (got ${opKey.data?.length ?? 0})`);

  // Spymaster reads card_identities → must be all 25.
  const smKey = await host.from('card_identities').select('*').eq('game_id', game.id);
  ok((smKey.data?.length ?? 0) === 25, `cyan spymaster reads 25 card_identities (got ${smKey.data?.length ?? 0})`);

  // Operative-visible cards never expose an unrevealed identity.
  const cardsRes = await op1.from('cards').select('*').eq('game_id', game.id);
  const leaked = (cardsRes.data ?? []).filter((c) => !c.revealed && c.revealed_identity != null);
  ok(leaked.length === 0, `no unrevealed card leaks revealed_identity to an operative (leaks=${leaked.length})`);

  // Illegal: operative cannot submit a clue (WRONG_ROLE).
  const badClue = await invoke(op1, 'submit_clue', { game_id: game.id, word: 'hello', number: 2 });
  ok(badClue.error === 'WRONG_ROLE', `operative submit_clue rejected WRONG_ROLE (got ${badClue.error})`);

  // Determine whose turn it is, then run a real clue + reveal through the authoritative path.
  const starting = game.current_team; // 'cyan' or 'amber'
  const smClient = starting === 'cyan' ? host : sm2;
  const opClient = starting === 'cyan' ? op1 : op2;

  // Invalid clue (multi-word) → INVALID_CLUE.
  const invalidClue = await invoke(smClient, 'submit_clue', { game_id: game.id, word: 'two words', number: 1 });
  ok(invalidClue.error === 'INVALID_CLUE', `multi-word clue rejected INVALID_CLUE (got ${invalidClue.error})`);

  // Valid clue.
  const clueRes = await invoke(smClient, 'submit_clue', { game_id: game.id, word: 'signal', number: 2 });
  ok(clueRes.game?.phase === 'guess' && clueRes.game?.guesses_remaining === 3,
    `clue accepted → phase guess, guesses_remaining=3 (got ${clueRes.game?.phase}/${clueRes.game?.guesses_remaining})`);

  // Spymaster (who CAN see identities) picks one of the starting team's own cards to reveal.
  const ownCard = smKey.data.find((k) => k.identity === starting);
  const reveal = await invoke(opClient, 'reveal_card', { game_id: game.id, card_id: ownCard.card_id });
  ok(reveal.card?.revealed === true && reveal.card?.revealed_identity === starting,
    `reveal of own-team card succeeds and flips to ${starting} (got ${reveal.card?.revealed_identity})`);
  const remainingAfter = starting === 'cyan' ? reveal.game.cyan_remaining : reveal.game.amber_remaining;
  ok(remainingAfter === 8, `starting team remaining decremented to 8 (got ${remainingAfter})`);

  // Cleanup with the service role (clients have no delete policy on rooms).
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  await admin.from('rooms').delete().eq('id', room.id);
  console.log('cleanup: test room deleted');

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
