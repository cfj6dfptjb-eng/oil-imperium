import { Rng } from '../rng.js';
import { RULES } from './rules.js';
import type { Contract, GameState } from './types.js';

const BUYERS = ['Nordic Power', 'Tokyo Electric', 'Rhine Chemie', 'Texas Refining', 'Atlantic Shipping', 'Paris Gaz'];

/** Replaces last month's unclaimed offers with fresh ones at today's price. */
export function refreshContractOffers(state: GameState, rng: Rng): void {
  state.contractOffers = [];
  for (let i = 0; i < RULES.contractOffersPerMonth; i++) {
    const price = state.market.price * rng.float(...RULES.contractPriceFactor);
    const offer: Contract = {
      id: `C${state.nextContractId++}`,
      buyer: BUYERS[rng.int(0, BUYERS.length - 1)],
      barrelsPerMonth: Math.round(rng.int(...RULES.contractBarrels) / 5_000) * 5_000,
      price: Math.round(price * 100) / 100,
      monthsLeft: rng.int(...RULES.contractMonths),
      penaltyPerBarrel: Math.round(price * RULES.contractPenaltyFactor * 100) / 100,
    };
    state.contractOffers.push(offer);
  }
}
