// Pure, dependency-free game-rule logic for Decrypt. These functions are the unit-tested
// frozen contract (see src/test/engine.test.ts) and mirror the authoritative server RPCs
// exactly (see TECHNICAL-DESIGN.md §6 and the rpc_* functions in the migrations).

import type { GameTeam, CardIdentity, GamePhase } from './types';

const STARTING_AGENTS = 9;
const OTHER_AGENTS = 8;
const NEUTRALS = 7;
const ASSASSINS = 1;
export const BOARD_SIZE = 25;

/**
 * Build the 25-card board. The starting team gets 9 agents, the other team 8, plus 7
 * neutral and 1 assassin. Positions 0–24 are assigned to a shuffled set of identities
 * using the injected `rng` (deterministic for a seeded rng). Assumes `words` has at
 * least 25 entries; the first 25 (post-shuffle) distinct words are used.
 */
export function generateBoard(
  words: string[],
  startingTeam: GameTeam,
  rng: () => number,
): { position: number; word: string; identity: CardIdentity }[] {
  const otherTeam: GameTeam = startingTeam === 'cyan' ? 'amber' : 'cyan';

  // Build the identity multiset.
  const identities: CardIdentity[] = [
    ...Array<CardIdentity>(STARTING_AGENTS).fill(startingTeam),
    ...Array<CardIdentity>(OTHER_AGENTS).fill(otherTeam),
    ...Array<CardIdentity>(NEUTRALS).fill('neutral'),
    ...Array<CardIdentity>(ASSASSINS).fill('assassin'),
  ];

  // Distinct words, then take 25 after a shuffle for word variety.
  const uniqueWords = Array.from(new Set(words));
  const shuffledWords = shuffle(uniqueWords, rng).slice(0, BOARD_SIZE);
  const shuffledIdentities = shuffle(identities, rng);

  return shuffledIdentities.map((identity, position) => ({
    position,
    word: shuffledWords[position],
    identity,
  }));
}

/** Initial agent counts: starting team 9, other team 8. */
export function initialRemaining(startingTeam: GameTeam): { cyan: number; amber: number } {
  return startingTeam === 'cyan'
    ? { cyan: STARTING_AGENTS, amber: OTHER_AGENTS }
    : { cyan: OTHER_AGENTS, amber: STARTING_AGENTS };
}

/**
 * Validate a clue: single word, letters only (Unicode), 1–24 chars, and an integer
 * number 1–9. Mirrors the server-side validation in rpc_submit_clue.
 */
export function validateClue(
  word: string,
  num: number,
): { ok: true } | { ok: false; code: 'INVALID_CLUE'; message: string } {
  const trimmed = (word ?? '').trim();
  if (!/^\p{L}+$/u.test(trimmed) || trimmed.length < 1 || trimmed.length > 24) {
    return {
      ok: false,
      code: 'INVALID_CLUE',
      message: 'Clue must be a single word (letters only, 1–24 characters).',
    };
  }
  if (!Number.isInteger(num) || num < 1 || num > 9) {
    return { ok: false, code: 'INVALID_CLUE', message: 'Number must be an integer from 1 to 9.' };
  }
  return { ok: true };
}

export interface RevealOutcome {
  nextPhase: GamePhase;
  nextTeam: GameTeam;
  winner: GameTeam | null;
  cyanRemaining: number;
  amberRemaining: number;
  guessesRemaining: number;
  turnEnded: boolean;
}

/**
 * Apply a single card reveal to the current state and return the resulting outcome.
 * Implements: own → continue (or win / limit-end), neutral → end, opponent → end (or
 * opponent win), assassin → instant loss. Mirrors rpc_reveal_card exactly.
 */
export function applyReveal(state: {
  currentTeam: GameTeam;
  cyanRemaining: number;
  amberRemaining: number;
  guessesRemaining: number;
  revealedIdentity: CardIdentity;
}): RevealOutcome {
  const otherTeam: GameTeam = state.currentTeam === 'cyan' ? 'amber' : 'cyan';

  let cyanRemaining = state.cyanRemaining;
  let amberRemaining = state.amberRemaining;
  const guessesRemaining = state.guessesRemaining - 1;

  const remainingOf = (team: GameTeam) => (team === 'cyan' ? cyanRemaining : amberRemaining);
  const decrement = (team: GameTeam) => {
    if (team === 'cyan') cyanRemaining -= 1;
    else amberRemaining -= 1;
  };

  const endTurn = (): RevealOutcome => ({
    nextPhase: 'clue',
    nextTeam: otherTeam,
    winner: null,
    cyanRemaining,
    amberRemaining,
    guessesRemaining: 0,
    turnEnded: true,
  });

  const { revealedIdentity, currentTeam } = state;

  if (revealedIdentity === currentTeam) {
    decrement(currentTeam);
    if (remainingOf(currentTeam) === 0) {
      return {
        nextPhase: 'finished',
        nextTeam: currentTeam,
        winner: currentTeam,
        cyanRemaining,
        amberRemaining,
        guessesRemaining,
        turnEnded: true,
      };
    }
    if (guessesRemaining <= 0) return endTurn();
    // Continue guessing.
    return {
      nextPhase: 'guess',
      nextTeam: currentTeam,
      winner: null,
      cyanRemaining,
      amberRemaining,
      guessesRemaining,
      turnEnded: false,
    };
  }

  if (revealedIdentity === otherTeam) {
    decrement(otherTeam);
    if (remainingOf(otherTeam) === 0) {
      return {
        nextPhase: 'finished',
        nextTeam: otherTeam,
        winner: otherTeam,
        cyanRemaining,
        amberRemaining,
        guessesRemaining,
        turnEnded: true,
      };
    }
    return endTurn();
  }

  if (revealedIdentity === 'assassin') {
    return {
      nextPhase: 'finished',
      nextTeam: otherTeam,
      winner: otherTeam,
      cyanRemaining,
      amberRemaining,
      guessesRemaining,
      turnEnded: true,
    };
  }

  // neutral
  return endTurn();
}

/** Fisher–Yates shuffle using the injected rng (does not mutate the input). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
