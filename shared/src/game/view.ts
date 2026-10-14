import type { Company } from '../constants.js';
import { netWorth } from './economy.js';
import type { Field, GameState, Player } from './types.js';

/** What one company may see of a rival: public standing, not the books. */
export interface RivalView {
  company: Company;
  bankrupt: boolean;
  endedTurn: boolean;
  licences: Player['licences'];
  netWorth: number;
  producingWells: number;
  /** Barrels sold last month. */
  lastSold: number;
}

export interface PlayerView extends Omit<GameState, 'players' | 'fields' | 'rngState'> {
  you: Player;
  rivals: RivalView[];
  fields: Field[];
}

/**
 * The game state as one company sees it. Hidden reserves and depths are
 * blanked unless the field is that company's own and has been drilled, and
 * rivals' finances, surveys and storage are left out.
 */
export function viewFor(state: GameState, company: Company): PlayerView {
  const you = state.players.find((p) => p.company === company);
  if (!you) throw new Error('Unknown company');
  const { players, fields, rngState: _rng, ...rest } = state;
  return {
    ...rest,
    you: structuredClone(you),
    rivals: players
      .filter((p) => p.company !== company)
      .map((p) => ({
        company: p.company,
        bankrupt: p.bankrupt,
        endedTurn: p.endedTurn,
        licences: [...p.licences],
        netWorth: netWorth(state, p),
        producingWells: fields.filter((f) => f.owner === p.company && f.status === 'producing').length,
        lastSold: p.salesHistory.at(-1) ?? 0,
      })),
    fields: fields.map((f) => {
      const revealed = f.owner === company && f.status !== 'unexplored' && f.status !== 'drilling';
      return { ...f, reserves: revealed ? f.reserves : 0, depth: f.owner === company && f.status !== 'unexplored' ? f.depth : 0 };
    }),
  };
}
