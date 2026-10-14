import { describe, expect, it } from 'vitest';
import { COMPANIES } from '../constants.js';
import { playAiTurn } from './ai.js';
import { RULES } from './rules.js';
import { CLASSIC_MAP_SEED, createGame } from './setup.js';
import type { GameState } from './types.js';

function playAiGame(seed: number): GameState {
  let state = createGame({ goal: 'timeLimit', companies: [...COMPANIES], seed, mapSeed: CLASSIC_MAP_SEED });
  while (!state.over && state.month < RULES.timeLimitMonths + 1) {
    for (const p of state.players) if (!state.over) state = playAiTurn(state, p.company);
  }
  return state;
}

describe('computer opponents', () => {
  it('play a full 3-year game to the end', () => {
    const state = playAiGame(3);
    expect(state.over).toBe(true);
    expect(state.winner).not.toBeNull();
  });

  it('strike oil, sell it and grow', () => {
    const state = playAiGame(11);
    expect(state.fields.some((f) => f.owner && f.status === 'producing')).toBe(true);
    expect(state.players.some((p) => p.salesHistory.some((s) => s > 0))).toBe(true);
    const best = Math.max(...state.players.map((p) => p.cash - p.debt));
    expect(best).toBeGreaterThan(5_000_000);
  });

  it('do not modify the state they are given', () => {
    const state = createGame({ goal: 'timeLimit', companies: [...COMPANIES], seed: 1, mapSeed: CLASSIC_MAP_SEED });
    const before = structuredClone(state);
    playAiTurn(state, 'Interoil');
    expect(state).toEqual(before);
  });
});
