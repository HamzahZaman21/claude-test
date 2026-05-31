import { describe, it, expect } from 'vitest';
import {
  generateBoard,
  initialRemaining,
  validateClue,
  applyReveal,
  BOARD_SIZE,
} from '@/lib/engine';
import type { CardIdentity, GameTeam } from '@/lib/types';

// Deterministic seeded RNG (mulberry32) for reproducible board tests.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = Array.from({ length: 60 }, (_, i) => `WORD${i}`);

function distribution(cards: { identity: CardIdentity }[]) {
  return cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.identity] = (acc[c.identity] ?? 0) + 1;
    return acc;
  }, {});
}

describe('generateBoard', () => {
  it('returns exactly 25 cards', () => {
    const board = generateBoard(WORDS, 'cyan', mulberry32(1));
    expect(board).toHaveLength(BOARD_SIZE);
  });

  it('has identity split 9/8/7/1 with the starting team getting 9 (cyan start)', () => {
    const board = generateBoard(WORDS, 'cyan', mulberry32(2));
    const dist = distribution(board);
    expect(dist.cyan).toBe(9);
    expect(dist.amber).toBe(8);
    expect(dist.neutral).toBe(7);
    expect(dist.assassin).toBe(1);
  });

  it('gives the starting team 9 when amber starts', () => {
    const board = generateBoard(WORDS, 'amber', mulberry32(3));
    const dist = distribution(board);
    expect(dist.amber).toBe(9);
    expect(dist.cyan).toBe(8);
    expect(dist.neutral).toBe(7);
    expect(dist.assassin).toBe(1);
  });

  it('assigns unique positions 0–24', () => {
    const board = generateBoard(WORDS, 'cyan', mulberry32(4));
    const positions = board.map((c) => c.position).sort((a, b) => a - b);
    expect(positions).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it('uses 25 unique words', () => {
    const board = generateBoard(WORDS, 'cyan', mulberry32(5));
    const words = new Set(board.map((c) => c.word));
    expect(words.size).toBe(25);
  });

  it('is deterministic for the same seed', () => {
    const a = generateBoard(WORDS, 'cyan', mulberry32(42));
    const b = generateBoard(WORDS, 'cyan', mulberry32(42));
    expect(a).toEqual(b);
  });

  it('differs across seeds', () => {
    const a = generateBoard(WORDS, 'cyan', mulberry32(1));
    const b = generateBoard(WORDS, 'cyan', mulberry32(999));
    expect(a).not.toEqual(b);
  });
});

describe('initialRemaining', () => {
  it('starting cyan → cyan 9, amber 8', () => {
    expect(initialRemaining('cyan')).toEqual({ cyan: 9, amber: 8 });
  });
  it('starting amber → amber 9, cyan 8', () => {
    expect(initialRemaining('amber')).toEqual({ cyan: 8, amber: 9 });
  });
});

describe('validateClue', () => {
  it('accepts a single letters-only word with a number 1–9', () => {
    expect(validateClue('FALCON', 3)).toEqual({ ok: true });
    expect(validateClue('a', 1)).toEqual({ ok: true });
    expect(validateClue('A'.repeat(24), 9)).toEqual({ ok: true });
  });
  it('rejects multi-word clues', () => {
    expect(validateClue('two words', 2).ok).toBe(false);
  });
  it('rejects empty / whitespace', () => {
    expect(validateClue('', 1).ok).toBe(false);
    expect(validateClue('   ', 1).ok).toBe(false);
  });
  it('rejects words containing digits or punctuation', () => {
    expect(validateClue('agent007', 1).ok).toBe(false);
    expect(validateClue('hy-phen', 1).ok).toBe(false);
  });
  it('rejects words longer than 24 chars', () => {
    expect(validateClue('A'.repeat(25), 1).ok).toBe(false);
  });
  it('rejects number <= 0, > 9, or non-integer', () => {
    expect(validateClue('word', 0).ok).toBe(false);
    expect(validateClue('word', 10).ok).toBe(false);
    expect(validateClue('word', 2.5).ok).toBe(false);
    expect(validateClue('word', -1).ok).toBe(false);
  });
  it('returns the INVALID_CLUE code on failure', () => {
    const r = validateClue('', 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_CLUE');
  });
});

describe('applyReveal rule table', () => {
  const base = (overrides: Partial<Parameters<typeof applyReveal>[0]> = {}) => ({
    currentTeam: 'cyan' as GameTeam,
    cyanRemaining: 5,
    amberRemaining: 5,
    guessesRemaining: 3,
    revealedIdentity: 'cyan' as CardIdentity,
    ...overrides,
  });

  it('own-team card with guesses left → continue, decrement own + guesses', () => {
    const o = applyReveal(base({ revealedIdentity: 'cyan', guessesRemaining: 3 }));
    expect(o.turnEnded).toBe(false);
    expect(o.nextPhase).toBe('guess');
    expect(o.nextTeam).toBe('cyan');
    expect(o.cyanRemaining).toBe(4);
    expect(o.guessesRemaining).toBe(2);
    expect(o.winner).toBeNull();
  });

  it('own-team card that empties own remaining → finished, win', () => {
    const o = applyReveal(base({ revealedIdentity: 'cyan', cyanRemaining: 1, guessesRemaining: 3 }));
    expect(o.nextPhase).toBe('finished');
    expect(o.winner).toBe('cyan');
    expect(o.cyanRemaining).toBe(0);
    expect(o.turnEnded).toBe(true);
  });

  it('own-team card with guesses hitting 0 → end turn', () => {
    const o = applyReveal(base({ revealedIdentity: 'cyan', cyanRemaining: 5, guessesRemaining: 1 }));
    expect(o.turnEnded).toBe(true);
    expect(o.nextPhase).toBe('clue');
    expect(o.nextTeam).toBe('amber');
    expect(o.cyanRemaining).toBe(4);
    expect(o.guessesRemaining).toBe(0);
    expect(o.winner).toBeNull();
  });

  it('neutral → end turn, no winner', () => {
    const o = applyReveal(base({ revealedIdentity: 'neutral', guessesRemaining: 3 }));
    expect(o.turnEnded).toBe(true);
    expect(o.nextPhase).toBe('clue');
    expect(o.nextTeam).toBe('amber');
    expect(o.cyanRemaining).toBe(5);
    expect(o.amberRemaining).toBe(5);
    expect(o.winner).toBeNull();
  });

  it('opponent card → end turn, decrement opponent', () => {
    const o = applyReveal(base({ revealedIdentity: 'amber', amberRemaining: 5, guessesRemaining: 3 }));
    expect(o.turnEnded).toBe(true);
    expect(o.nextTeam).toBe('amber');
    expect(o.amberRemaining).toBe(4);
    expect(o.winner).toBeNull();
  });

  it('opponent card emptying opponent remaining → opponent wins', () => {
    const o = applyReveal(base({ revealedIdentity: 'amber', amberRemaining: 1, guessesRemaining: 3 }));
    expect(o.nextPhase).toBe('finished');
    expect(o.winner).toBe('amber');
    expect(o.amberRemaining).toBe(0);
    expect(o.turnEnded).toBe(true);
  });

  it('assassin → finished, other team wins (instant loss)', () => {
    const o = applyReveal(base({ revealedIdentity: 'assassin', guessesRemaining: 3 }));
    expect(o.nextPhase).toBe('finished');
    expect(o.winner).toBe('amber');
    expect(o.turnEnded).toBe(true);
  });

  it('works symmetrically when amber is the current team (assassin)', () => {
    const o = applyReveal(base({ currentTeam: 'amber', revealedIdentity: 'assassin' }));
    expect(o.winner).toBe('cyan');
  });
});
