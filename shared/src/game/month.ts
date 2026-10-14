import { REGIONS } from '../constants.js';
import { Rng } from '../rng.js';
import { activePlayers, marketShare, netWorth } from './economy.js';
import { REGION_DATA, RULES } from './rules.js';
import type { GameEvent, GameState, Player } from './types.js';

/**
 * Month-end resolution, run once every company has ended its turn. Mutates
 * the state it is given (callers pass a fresh copy). Order: drilling,
 * production, costs and interest, oil price, bankruptcy, victory check.
 */
export function resolveMonth(state: GameState): void {
  const rng = new Rng(state.rngState);
  const events: GameEvent[] = [];
  const players = activePlayers(state);

  advanceDrilling(state, events);
  for (const player of players) produce(state, player, events);
  for (const player of players) payCosts(state, player, events);
  updatePrice(state, rng);

  for (const player of players) {
    player.salesHistory.push(player.soldThisMonth);
    player.soldThisMonth = 0;
    player.daysLeft = RULES.daysPerMonth;
    player.endedTurn = false;
  }

  state.month += 1;
  state.rngState = rng.seed;
  checkVictory(state, events);
  state.events = events;
}

function advanceDrilling(state: GameState, events: GameEvent[]): void {
  const speed =
    RULES.drillMetresPerMonth * (state.config.goal === 'money' ? RULES.moneyGoalDrillFactor : 1);
  for (const field of state.fields) {
    if (field.status !== 'drilling' || !field.owner) continue;
    field.drilled = Math.min(field.depth, field.drilled + speed);
    if (field.drilled < field.depth) continue;
    if (field.reserves > 0) {
      field.status = 'producing';
      events.push({ type: 'strike', company: field.owner, fieldId: field.id, reserves: field.reserves });
    } else {
      field.status = 'dry';
      events.push({ type: 'dryHole', company: field.owner, fieldId: field.id });
    }
  }
}

function produce(state: GameState, player: Player, events: GameEvent[]): void {
  const pumped: Partial<Record<(typeof REGIONS)[number], number>> = {};
  for (const field of state.fields) {
    if (field.owner !== player.company || field.status !== 'producing') continue;
    const output = Math.min(
      field.reserves,
      Math.max(1_000, Math.round(field.reserves * RULES.productionRate)),
      RULES.maxWellOutputPerMonth,
    );
    field.reserves -= output;
    pumped[field.region] = (pumped[field.region] ?? 0) + output;
    player.cash -= output * REGION_DATA[field.region].productionCost;
    if (field.reserves === 0) {
      field.status = 'depleted';
      events.push({ type: 'depleted', company: player.company, fieldId: field.id });
    }
  }

  for (const region of REGIONS) {
    const output = pumped[region];
    if (!output) continue;
    const capacity = (player.tanks[region] ?? 0) * RULES.tankCapacity;
    const stored = player.stored[region] ?? 0;
    const kept = Math.max(0, Math.min(output, capacity - stored));
    player.stored[region] = stored + kept;
    if (kept < output) {
      events.push({ type: 'overflow', company: player.company, region, barrels: output - kept });
    }
  }
}

function payCosts(state: GameState, player: Player, events: GameEvent[]): void {
  let costs = RULES.companyOverheadPerMonth;
  for (const field of state.fields) {
    if (field.owner !== player.company) continue;
    if (field.status === 'producing') costs += RULES.wellUpkeepPerMonth;
    // Wells still drilling cost another month of drilling.
    if (field.status === 'drilling') costs += REGION_DATA[field.region].drillCostPerMonth;
  }
  const tanks = Object.values(player.tanks).reduce((a, b) => a + (b ?? 0), 0);
  costs += tanks * RULES.tankUpkeepPerMonth;
  costs += Math.round(player.debt * RULES.loanInterestPerMonth);
  player.cash -= costs;

  if (player.cash >= 0) return;
  // The bank covers a shortfall while credit lasts; otherwise the company goes under.
  const shortfall = -player.cash;
  if (player.debt + shortfall <= RULES.maxDebt) {
    player.debt += shortfall;
    player.cash = 0;
    events.push({ type: 'autoLoan', company: player.company, amount: shortfall });
  } else {
    goBankrupt(state, player, events);
  }
}

function goBankrupt(state: GameState, player: Player, events: GameEvent[]): void {
  player.bankrupt = true;
  player.endedTurn = true;
  for (const field of state.fields) {
    if (field.owner !== player.company) continue;
    field.owner = null;
    if (field.status === 'drilling') {
      field.status = 'unexplored';
      field.drilled = 0;
    }
  }
  events.push({ type: 'bankrupt', company: player.company });
}

function updatePrice(state: GameState, rng: Rng): void {
  const sold = state.players.reduce((sum, p) => sum + p.soldThisMonth, 0);
  const { price } = state.market;
  const next =
    price +
    RULES.priceReversion * (RULES.baseOilPrice - price) +
    rng.noise(RULES.priceVolatility) -
    (sold / 1_000_000) * RULES.pricePressurePerMillion;
  state.market.price = Math.round(clamp(next, RULES.minOilPrice, RULES.maxOilPrice) * 100) / 100;
  state.market.history.push(state.market.price);
}

function checkVictory(state: GameState, events: GameEvent[]): void {
  const alive = activePlayers(state);
  const { goal } = state.config;
  const richest = () =>
    alive.reduce<Player | null>((best, p) => (!best || netWorth(state, p) > netWorth(state, best) ? p : best), null);

  let winner: Player | null | undefined;
  if (alive.length === 0) {
    winner = null;
  } else if (alive.length === 1 && state.players.length > 1) {
    // Last company standing wins whatever the goal.
    winner = alive[0];
  } else if (goal === 'timeLimit' && state.month >= RULES.timeLimitMonths) {
    winner = richest();
  } else if (goal === 'money') {
    winner = alive.find((p) => p.cash - p.debt >= RULES.moneyGoal);
  } else if (goal === 'marketShare' && state.players.length > 1) {
    const totalSold = state.players
      .flatMap((p) => p.salesHistory.slice(-RULES.marketShareWindow))
      .reduce((a, b) => a + b, 0);
    if (totalSold >= RULES.marketShareMinBarrels) {
      winner = alive.find((p) => marketShare(state, p) >= RULES.marketShareGoal);
    }
  }

  if (winner === undefined) return;
  state.over = true;
  state.winner = winner?.company ?? null;
  events.push({ type: 'gameOver', winner: state.winner, reason: goal });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
