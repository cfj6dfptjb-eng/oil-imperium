import { REGIONS, type Region } from '../constants.js';
import { Rng } from '../rng.js';
import { refreshContractOffers } from './contracts.js';
import { activePlayers, marketShare, netWorth, shippingLeft } from './economy.js';
import { REGION_DATA, RULES } from './rules.js';
import type { GameEvent, GameState, NewsKind, Player, SabotageKind } from './types.js';

/**
 * Month-end resolution, run once every company has ended its turn. Mutates
 * the state it is given (callers pass a fresh copy). Order: sabotage,
 * drilling, fires, production, contract deliveries, costs and interest, oil
 * price, world news, new contract offers, victory check.
 */
export function resolveMonth(state: GameState): void {
  const rng = new Rng(state.rngState);
  const events: GameEvent[] = [];
  const players = activePlayers(state);
  // Only spot market sales move the price; contract oil is already spoken for.
  const spotSold = state.players.reduce((sum, p) => sum + p.soldThisMonth, 0);

  for (const player of players) carryOutPlots(state, player, rng, events);
  advanceDrilling(state, events);
  burnFires(state, events);
  for (const player of players) produce(state, player, events);
  for (const player of players) deliverContracts(player, events);
  for (const player of players) payCosts(state, player, events);
  updatePrice(state, spotSold, rng);
  worldNews(state, rng, events);

  for (const player of players) {
    player.salesHistory.push(player.soldThisMonth);
    player.soldThisMonth = 0;
    player.shipped = {};
    player.daysLeft = RULES.daysPerMonth;
    player.endedTurn = player.bankrupt;
  }

  state.month += 1;
  refreshContractOffers(state, rng);
  state.rngState = rng.seed;
  checkVictory(state, events);
  state.events = events;
}

function carryOutPlots(state: GameState, player: Player, rng: Rng, events: GameEvent[]): void {
  const plots = player.plots;
  player.plots = [];
  for (const { target: targetName, kind } of plots) {
    const target = state.players.find((p) => p.company === targetName);
    if (!target || target.bankrupt) continue;
    const odds = target.security ? RULES.sabotageSuccessVsSecurity : RULES.sabotageSuccess;
    if (rng.chance(odds) && strike(state, target, kind, rng, events)) {
      events.push({ type: 'plotSucceeded', company: player.company, target: targetName, kind, secret: true });
      continue;
    }
    const caught = rng.chance(RULES.sabotageCaughtChance);
    const fine = caught ? RULES.sabotageFine : 0;
    player.cash -= fine;
    events.push(
      caught
        ? { type: 'plotFailed', company: player.company, target: targetName, kind, caught, fine }
        : { type: 'plotFailed', company: player.company, target: targetName, kind, caught, fine, secret: true },
    );
  }
}

/** Carries out one act of sabotage. Returns false when there was nothing to hit. */
function strike(state: GameState, target: Player, kind: SabotageKind, rng: Rng, events: GameEvent[]): boolean {
  const company = target.company;
  if (kind === 'fire') {
    const wells = state.fields.filter((f) => f.owner === company && f.status === 'producing');
    if (wells.length === 0) return false;
    const field = wells[rng.int(0, wells.length - 1)];
    field.status = 'burning';
    field.fireMonths = 0;
    events.push({ type: 'sabotaged', company, kind, fieldId: field.id });
    return true;
  }
  if (kind === 'tanker') {
    const regions = REGIONS.filter((r) => (target.tankers[r] ?? 0) > 0);
    if (regions.length === 0) return false;
    const region = regions[rng.int(0, regions.length - 1)];
    target.tankers[region] = (target.tankers[region] ?? 0) - 1;
    events.push({ type: 'sabotaged', company, kind, region });
    return true;
  }
  const [min, max] = RULES.auditFineRange;
  const amount = Math.round(clamp(target.cash * RULES.auditFineFraction, min, max) / 10_000) * 10_000;
  target.cash -= amount;
  events.push({ type: 'sabotaged', company, kind, amount });
  return true;
}

function burnFires(state: GameState, events: GameEvent[]): void {
  for (const field of state.fields) {
    if (field.status !== 'burning' || !field.owner) continue;
    field.fireMonths += 1;
    field.reserves -= Math.round(field.reserves * RULES.fireLossRate);
    if (field.fireMonths < RULES.fireBurnOutMonths) continue;
    field.status = field.reserves > 0 ? 'producing' : 'depleted';
    field.fireMonths = 0;
    events.push({ type: 'fireOut', company: field.owner, fieldId: field.id });
  }
}

/** Delivers contract oil from storage, as far as stock and shipping allow, and settles up. */
function deliverContracts(player: Player, events: GameEvent[]): void {
  for (const contract of player.contracts) {
    let delivered = 0;
    for (const region of REGIONS) {
      const take = Math.min(contract.barrelsPerMonth - delivered, player.stored[region] ?? 0, shippingLeft(player, region));
      if (take <= 0) continue;
      player.stored[region] = (player.stored[region] ?? 0) - take;
      player.shipped[region] = (player.shipped[region] ?? 0) + take;
      delivered += take;
    }
    const missing = contract.barrelsPerMonth - delivered;
    const revenue = Math.round(delivered * contract.price);
    const penalty = Math.round(missing * contract.penaltyPerBarrel);
    player.cash += revenue - penalty;
    player.soldThisMonth += delivered;
    contract.monthsLeft -= 1;
    events.push({ type: 'delivery', company: player.company, contractId: contract.id, delivered, missing, revenue, penalty, secret: true });
  }
  player.contracts = player.contracts.filter((c) => c.monthsLeft > 0);
}

const NEWS: { kind: NewsKind; direction: number; region?: Region }[] = [
  { kind: 'war', direction: 1, region: 'Gulf Region' },
  { kind: 'embargo', direction: 1 },
  { kind: 'discovery', direction: -1 },
  { kind: 'glut', direction: -1 },
  { kind: 'strike', direction: 0 },
];

/** Sometimes the world makes the news: price shocks, or a strike that stops wells in one region next month. */
function worldNews(state: GameState, rng: Rng, events: GameEvent[]): void {
  state.strikes = [];
  if (!rng.chance(RULES.newsChance)) return;
  const story = NEWS[rng.int(0, NEWS.length - 1)];
  if (story.kind === 'strike') {
    const region = REGIONS[rng.int(0, REGIONS.length - 1)];
    state.strikes = [region];
    events.push({ type: 'news', kind: 'strike', region });
    return;
  }
  const before = state.market.price;
  const shock = story.direction * rng.float(...RULES.newsPriceShock);
  state.market.price = Math.round(clamp(before + shock, RULES.minOilPrice, RULES.maxOilPrice) * 100) / 100;
  state.market.history[state.market.history.length - 1] = state.market.price;
  const priceChange = Math.round((state.market.price - before) * 100) / 100;
  events.push(story.region ? { type: 'news', kind: story.kind, region: story.region, priceChange } : { type: 'news', kind: story.kind, priceChange });
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
    if (state.strikes.includes(field.region)) continue;
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
  const count = (record: Partial<Record<Region, number>>) => Object.values(record).reduce((a, b) => a + (b ?? 0), 0);
  costs += count(player.tanks) * RULES.tankUpkeepPerMonth;
  costs += count(player.tankers) * RULES.tankerUpkeepPerMonth;
  costs += player.pipelines.length * RULES.pipelineUpkeepPerMonth;
  if (player.security) costs += RULES.securityCostPerMonth;
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
  player.contracts = [];
  for (const field of state.fields) {
    if (field.owner !== player.company) continue;
    field.owner = null;
    if (field.status === 'burning') field.status = 'producing';
    if (field.status === 'drilling') {
      field.status = 'unexplored';
      field.drilled = 0;
    }
  }
  events.push({ type: 'bankrupt', company: player.company });
}

function updatePrice(state: GameState, sold: number, rng: Rng): void {
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
