import { describe, expect, it } from 'vitest';
import { LocalGame } from './local-game.js';

describe('LocalGame', () => {
  it('lets the computers play and waits for the human to end the month', () => {
    const game = new LocalGame('Transoil', 'timeLimit', 42);
    const others = game.state.players.filter((p) => p.company !== 'Transoil');
    expect(others.every((p) => p.endedTurn)).toBe(true);
    expect(game.state.month).toBe(0);

    game.endMonth();
    expect(game.state.month).toBe(1);
    expect(game.me.endedTurn).toBe(false);
  });

  it('reports errors instead of throwing', () => {
    const game = new LocalGame('Interoil', 'timeLimit', 1);
    const results: (string | null)[] = [];
    game.perform({ type: 'sellOil', region: 'Europe', barrels: 5 }, (e) => results.push(e));
    game.perform({ type: 'buyLicence', region: 'Europe' }, (e) => results.push(e));
    expect(results).toEqual(['Not enough oil in storage', null]);
    expect(game.view.you.licences).toEqual(['Europe']);
  });

  it('finishes when the human goes bankrupt, even if the computers play on', () => {
    const game = new LocalGame('Interoil', 'survival', 7);
    game.state.players[0].cash = 0;
    game.state.players[0].debt = 10_000_000;
    game.endMonth();
    expect(game.me.bankrupt).toBe(true);
    expect(game.state.over).toBe(false);
    expect(game.finished).toBe(true);
  });

  it('plays a whole 3-year game', () => {
    const game = new LocalGame('Interoil', 'timeLimit', 3);
    while (!game.finished) game.endMonth();
    expect(game.state.month).toBe(36);
  });
});
