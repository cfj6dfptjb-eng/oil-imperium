import { netWorth, type Action, type Company, type GameState, type PlayerView } from '@oil/shared';

/** One company's public standing, for reports and the final ranking. */
export interface Standing {
  company: Company;
  netWorth: number;
  producingWells: number;
  lastSold: number;
  bankrupt: boolean;
  you: boolean;
}

/**
 * What the screens need from a game, whether it runs in this browser or on
 * the server. Screens only ever see the player's own view of the game.
 */
export interface GameSession {
  readonly company: Company;
  /** Null for an online game until the server has sent the first view. */
  readonly view: PlayerView | null;
  /** Human companies the month is still waiting for. */
  readonly waitingFor: Company[];
  readonly online: boolean;
  /** Runs an action; done receives an error message, or null on success. */
  perform(action: Action, done?: (error: string | null) => void): void;
}

/** True once the game is over or this player's company has gone bankrupt. */
export function isFinished(view: PlayerView): boolean {
  return view.over || view.you.bankrupt;
}

export function standings(view: PlayerView): Standing[] {
  const fakeState = { market: view.market } as GameState;
  const mine: Standing = {
    company: view.you.company,
    netWorth: netWorth(fakeState, view.you),
    producingWells: view.fields.filter((f) => f.owner === view.you.company && f.status === 'producing').length,
    lastSold: view.you.salesHistory.at(-1) ?? 0,
    bankrupt: view.you.bankrupt,
    you: true,
  };
  const rivals: Standing[] = view.rivals.map((r) => ({
    company: r.company,
    netWorth: r.netWorth,
    producingWells: r.producingWells,
    lastSold: r.lastSold,
    bankrupt: r.bankrupt,
    you: false,
  }));
  return [mine, ...rivals].sort((a, b) => b.netWorth - a.netWorth);
}
