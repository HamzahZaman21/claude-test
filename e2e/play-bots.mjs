// Test harness: seats 3 bot players in an existing room (cyan operative, amber spymaster,
// amber operative) and, once the host starts the game, plays the bot-controlled turns —
// always revealing a correct own-team card (the harness reads the full key via the amber
// spymaster). Cyan clue is given by the human host in the browser. Run against PROD:
//   node e2e/play-bots.mjs <ROOM_CODE> [supabaseUrl] [anonKey]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const code = process.argv[2];
if (!code) { console.error('usage: node e2e/play-bots.mjs <ROOM_CODE>'); process.exit(1); }
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const get = (k) => env.match(new RegExp(`${k}=(.*)`))[1].trim();
const URL_ = process.argv[3] || get('NEXT_PUBLIC_SUPABASE_URL');
const ANON = process.argv[4] || get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function anon() {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInAnonymously();
  if (error) throw new Error('anon: ' + error.message);
  return c;
}
async function invoke(c, name, body) {
  const { data, error } = await c.functions.invoke(name, { body });
  if (error) { let p; try { p = await error.context.json(); } catch {} return { error: p?.error ?? 'INTERNAL', message: p?.message ?? error.message }; }
  return data;
}

const cyanOp = await anon();
const amberSm = await anon();
const amberOp = await anon();

const seat = async (c, name, team, role) => {
  const j = await c.rpc('join_room', { p_code: code, p_display_name: name });
  if (j.error) throw new Error('join: ' + j.error.message);
  await c.from('players').update({ team, role }).eq('id', j.data.player.id);
};
await seat(cyanOp, 'CyanOp', 'cyan', 'operative');
await seat(amberSm, 'AmberSm', 'amber', 'spymaster');
await seat(amberOp, 'AmberOp', 'amber', 'operative');
console.log('SEATED 3 bots in room', code, '— host can Start now.');

// Wait for the game to be created (host clicks Start).
let game = null;
for (let i = 0; i < 180; i++) {
  const { data } = await amberSm.from('games').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (data) { game = data; break; }
  await sleep(1000);
}
if (!game) { console.error('TIMEOUT waiting for game start'); process.exit(1); }
console.log('GAME STARTED — starting team:', game.starting_team);

// Read the full key (any spymaster sees all 25).
const keyRes = await amberSm.from('card_identities').select('card_id, identity').eq('game_id', game.id);
const key = {}; (keyRes.data ?? []).forEach((r) => (key[r.card_id] = r.identity));

const revealOwn = async (opClient, team) => {
  const cardsRes = await opClient.from('cards').select('id, revealed').eq('game_id', game.id);
  const target = (cardsRes.data ?? []).find((c) => !c.revealed && key[c.id] === team);
  if (!target) return null;
  return invoke(opClient, 'reveal_card', { game_id: game.id, card_id: target.id });
};

for (let i = 0; i < 60; i++) {
  const { data: g } = await amberSm.from('games').select('*').eq('id', game.id).maybeSingle();
  if (!g) break;
  if (g.phase === 'finished') { console.log('FINISHED — winner:', g.winner); break; }
  if (g.current_team === 'amber') {
    if (g.phase === 'clue') {
      const r = await invoke(amberSm, 'submit_clue', { game_id: g.id, word: 'agent', number: 2 });
      console.log('amber clue → phase', r.game?.phase ?? r.error);
    } else if (g.phase === 'guess') {
      const r = await revealOwn(amberOp, 'amber');
      if (r) console.log('amber reveal → amber_remaining', r.game?.amber_remaining ?? r.error);
    }
  } else {
    // cyan turn: host gives the clue in the browser; once in guess phase, bot reveals a cyan card.
    if (g.phase === 'guess') {
      const r = await revealOwn(cyanOp, 'cyan');
      if (r) console.log('cyan reveal → cyan_remaining', r.game?.cyan_remaining ?? r.error);
    }
  }
  await sleep(1500);
}
console.log('BOT DRIVER DONE');
