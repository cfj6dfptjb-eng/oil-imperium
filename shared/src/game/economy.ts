import type { Region } from '../constants.js';
import { RULES } from './rules.js';
import type { GameState, Player } from './types.js';

export function storedBarrels(player: Player): number {
  return Object.values(player.stored).reduce((sum, b) => sum + (b ?? 0), 0);
}

/** Cash minus debt plus stored oil at today's price. Used to rank companies. */
export function netWorth(state: GameState, player: Player): number {
  return player.cash - player.debt + storedBarrels(player) * state.market.price;
}

/** This player's share of all oil sold over the recent sales window, 0 to 1. */
export function marketShare(state: GameState, player: Player): number {
  const window = RULES.marketShareWindow;
  const recent = (p: Player) => p.salesHistory.slice(-window).reduce((a, b) => a + b, 0);
  const total = state.players.reduce((sum, p) => sum + recent(p), 0);
  return total === 0 ? 0 : recent(player) / total;
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

/** Barrels a month that can leave a region: by road, plus pipeline and tankers. */
export function shippingCapacity(player: Player, region: Region): number {
  return (
    RULES.roadCapacity +
    (player.pipelines.includes(region) ? RULES.pipelineCapacity : 0) +
    (player.tankers[region] ?? 0) * RULES.tankerCapacity
  );
}

/** Shipping capacity still unused this month in a region. */
export function shippingLeft(player: Player, region: Region): number {
  return Math.max(0, shippingCapacity(player, region) - (player.shipped[region] ?? 0));
}
