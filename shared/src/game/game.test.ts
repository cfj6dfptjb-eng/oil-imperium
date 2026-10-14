import { describe, expect, it } from 'vitest';
import type { Company, Region } from '../constants.js';
import { applyAction } from './actions.js';
import { netWorth } from './economy.js';
import { REGION_DATA, RULES } from './rules.js';
import { CLASSIC_MAP_SEED, createGame } from './setup.js';
import type { Action, Field, GameConfig, GameState } from './types.js';
import { viewFor } from './view.js';

const A: Company = 'Interoil';
const B: Company = 'Transoil';
const GULF: Region = 'Gulf Region';

function newGame(overrides: Partial<GameConfig> = {}): GameState {
  return createGame({ goal: 'timeLimit', companies: [A, B], seed: 1, mapSeed: CLASSIC_MAP_SEED, ...overrides });
}

/** Applies an action and fails the test if it is rejected. */
function act(state: GameState, company: Company, action: Action): GameState {
  const result = applyAction(state, company, action);
  if (!result.ok) throw new Error(`${company} ${action.type}: ${result.error}`);
  return result.state;
}

function endMonth(state: GameState): GameState {
  for (const p of state.players) if (!p.bankrupt && !p.endedTurn) state = act(state, p.company, { type: 'endTurn' });
  return state;
}

function oilField(state: GameState, region: Region): Field {
  const field = state.fields.find((f) => f.region === region && f.reserves > 0 && !f.owner);
  if (!field) throw new Error(`No oil field in ${region}`);
  return field;
}

function dryField(state: GameState): Field {
  const field = state.fields.find((f) => f.reserves === 0 && !f.owner);
  if (!field) throw new Error('No dry field');
  return field;
}

function player(state: GameState, company: Company) {
  return state.players.find((p) => p.company === company)!;
}

/** Buys a licence and a field and drills it until it produces. */
function strikeOil(state: GameState, company: Company, region: Region): { state: GameState; field: Field } {
  const field = oilField(state, region);
  if (!player(state, company).licences.includes(region)) state = act(state, company, { type: 'buyLicence', region });
  state = act(state, company, { type: 'buyField', fieldId: field.id });
  state = act(state, company, { type: 'startDrilling', fieldId: field.id });
  while (state.fields.find((f) => f.id === field.id)!.status === 'drilling') state = endMonth(state);
  return { state, field: state.fields.find((f) => f.id === field.id)! };
}

describe('setup', () => {
  it('creates 20 fields in each of the 8 regions', () => {
    const state = newGame();
    expect(state.fields).toHaveLength(160);
    expect(state.players.map((p) => p.cash)).toEqual([5_000_000, 5_000_000]);
  });

  it('gives the same map for the same map seed and a different one otherwise', () => {
    expect(newGame().fields).toEqual(newGame({ seed: 99 }).fields);
    expect(newGame().fields).not.toEqual(newGame({ mapSeed: 7 }).fields);
  });

  it('rejects bad company lists', () => {
    expect(() => newGame({ companies: [] })).toThrow();
    expect(() => newGame({ companies: [A, A] })).toThrow();
  });
});

describe('actions', () => {
  it('charges money and days for a licence and refuses a second one', () => {
    let state = newGame();
    state = act(state, A, { type: 'buyLicence', region: GULF });
    const p = player(state, A);
    expect(p.cash).toBe(5_000_000 - REGION_DATA[GULF].licenceCost);
    expect(p.daysLeft).toBe(RULES.daysPerMonth - RULES.days.buyLicence);
    expect(applyAction(state, A, { type: 'buyLicence', region: GULF })).toEqual({
      ok: false,
      error: 'You already hold this licence',
    });
  });

  it('never modifies the state it is given', () => {
    const state = newGame();
    const before = structuredClone(state);
    act(state, A, { type: 'buyLicence', region: GULF });
    expect(state).toEqual(before);
  });

  it('runs out of days', () => {
    let state = newGame();
    for (let i = 0; i < RULES.daysPerMonth; i++) state = act(state, A, { type: 'takeLoan', amount: 1 });
    expect(applyAction(state, A, { type: 'takeLoan', amount: 1 })).toMatchObject({ ok: false });
  });

  it('needs a licence to buy a field and gives it to whoever buys first', () => {
    let state = newGame();
    const field = oilField(state, GULF);
    expect(applyAction(state, A, { type: 'buyField', fieldId: field.id })).toMatchObject({ ok: false });
    state = act(state, A, { type: 'buyLicence', region: GULF });
    state = act(state, B, { type: 'buyLicence', region: GULF });
    state = act(state, B, { type: 'buyField', fieldId: field.id });
    expect(applyAction(state, A, { type: 'buyField', fieldId: field.id })).toEqual({
      ok: false,
      error: 'Another company owns this field',
    });
  });

  it('gives survey estimates near the true reserves', () => {
    let state = newGame();
    state = act(state, A, { type: 'buyLicence', region: GULF });
    const field = oilField(state, GULF);
    state = act(state, A, { type: 'survey', fieldId: field.id });
    const report = player(state, A).surveys[0];
    expect(report.fieldId).toBe(field.id);
    expect(Math.abs(report.estimate - field.reserves)).toBeLessThanOrEqual(field.reserves * RULES.surveyAccuracy + 10_000);
  });

  it('cannot sell more oil than is stored', () => {
    const state = newGame();
    expect(applyAction(state, A, { type: 'sellOil', region: GULF, barrels: 10 })).toEqual({
      ok: false,
      error: 'Not enough oil in storage',
    });
  });

  it('caps loans at the bank limit and repays them', () => {
    let state = newGame();
    expect(applyAction(state, A, { type: 'takeLoan', amount: RULES.maxDebt + 1 })).toMatchObject({ ok: false });
    state = act(state, A, { type: 'takeLoan', amount: 1_000_000 });
    state = act(state, A, { type: 'repayLoan', amount: 400_000 });
    expect(player(state, A)).toMatchObject({ debt: 600_000, cash: 5_600_000 });
  });
});

describe('month end', () => {
  it('waits until every company has ended its turn, then resets days', () => {
    let state = newGame();
    state = act(state, A, { type: 'buyLicence', region: GULF });
    state = act(state, A, { type: 'endTurn' });
    expect(state.month).toBe(0);
    expect(applyAction(state, A, { type: 'takeLoan', amount: 1 })).toMatchObject({ ok: false });
    state = act(state, B, { type: 'endTurn' });
    expect(state.month).toBe(1);
    expect(player(state, A)).toMatchObject({ daysLeft: RULES.daysPerMonth, endedTurn: false });
    expect(state.market.history).toHaveLength(2);
  });

  it('strikes oil after drilling deep enough', () => {
    const { state, field } = strikeOil(newGame(), A, GULF);
    expect(field.status).toBe('producing');
    expect(state.month).toBe(Math.ceil(field.depth / RULES.drillMetresPerMonth));
  });

  it('finds a dry hole', () => {
    let state = newGame();
    const field = dryField(state);
    state = act(state, A, { type: 'buyLicence', region: field.region });
    state = act(state, A, { type: 'buyField', fieldId: field.id });
    state = act(state, A, { type: 'startDrilling', fieldId: field.id });
    while (state.fields.find((f) => f.id === field.id)!.status === 'drilling') state = endMonth(state);
    expect(state.fields.find((f) => f.id === field.id)!.status).toBe('dry');
  });

  it('drills slower in the money goal game', () => {
    const fast = strikeOil(newGame(), A, GULF);
    const slow = strikeOil(newGame({ goal: 'money' }), A, GULF);
    expect(slow.state.month).toBeGreaterThan(fast.state.month);
  });

  it('wastes oil without tanks and stores it with them', () => {
    let { state } = strikeOil(newGame(), A, GULF);
    state = endMonth(state);
    expect(state.events).toContainEqual(expect.objectContaining({ type: 'overflow', company: A, region: GULF }));
    expect(player(state, A).stored[GULF] ?? 0).toBe(0);

    state = act(state, A, { type: 'buildTank', region: GULF });
    state = endMonth(state);
    const stored = player(state, A).stored[GULF]!;
    expect(stored).toBeGreaterThan(0);
    expect(stored).toBeLessThanOrEqual(RULES.tankCapacity);
  });

  it('sells oil at the market price and records the sale', () => {
    let { state } = strikeOil(newGame(), A, GULF);
    state = act(state, A, { type: 'buildTank', region: GULF });
    state = endMonth(state);
    const stored = player(state, A).stored[GULF]!;
    const cashBefore = player(state, A).cash;
    state = act(state, A, { type: 'sellOil', region: GULF, barrels: stored });
    expect(player(state, A).cash).toBe(cashBefore + Math.round(stored * state.market.price));
    state = endMonth(state);
    expect(player(state, A).salesHistory.at(-1)).toBe(stored);
  });

  it('charges interest on loans', () => {
    let state = newGame();
    state = act(state, A, { type: 'takeLoan', amount: 1_000_000 });
    state = endMonth(state);
    const interest = 1_000_000 * RULES.loanInterestPerMonth;
    expect(player(state, A).cash).toBe(6_000_000 - RULES.companyOverheadPerMonth - interest);
  });

  it('covers a shortfall with a loan, then goes bankrupt when credit runs out', () => {
    let state = newGame();
    state.players[0].cash = 10_000;
    state = endMonth(state);
    expect(player(state, A)).toMatchObject({ cash: 0, debt: RULES.companyOverheadPerMonth - 10_000 });
    expect(state.events).toContainEqual(expect.objectContaining({ type: 'autoLoan', company: A }));

    state.players[0].debt = RULES.maxDebt;
    state = endMonth(state);
    expect(player(state, A).bankrupt).toBe(true);
    expect(state.events).toContainEqual({ type: 'bankrupt', company: A });
  });

  it('keeps the oil price within its limits', () => {
    let state = newGame();
    for (let i = 0; i < 30; i++) state = endMonth(state);
    for (const price of state.market.history) {
      expect(price).toBeGreaterThanOrEqual(RULES.minOilPrice);
      expect(price).toBeLessThanOrEqual(RULES.maxOilPrice);
    }
  });

  it('pushes the price down when a lot of oil is sold', () => {
    const quiet = endMonth(newGame());
    let busy = newGame();
    busy.players[0].stored[GULF] = 5_000_000;
    busy = act(busy, A, { type: 'sellOil', region: GULF, barrels: 5_000_000 });
    busy = endMonth(busy);
    expect(busy.market.price).toBeLessThan(quiet.market.price);
  });

  it('plays out the same way from the same seed', () => {
    const play = () => {
      let { state } = strikeOil(newGame({ seed: 5 }), A, GULF);
      for (let i = 0; i < 6; i++) state = endMonth(state);
      return state;
    };
    expect(play()).toEqual(play());
  });
});

describe('victory', () => {
  it('ends the time limit game after 3 years with the richest company winning', () => {
    let state = newGame();
    state.players[1].cash = 6_000_000;
    for (let i = 0; i < RULES.timeLimitMonths; i++) state = endMonth(state);
    expect(state).toMatchObject({ over: true, winner: B, month: RULES.timeLimitMonths });
    expect(applyAction(state, A, { type: 'endTurn' })).toEqual({ ok: false, error: 'The game is over' });
  });

  it('makes the last company standing the winner', () => {
    let state = newGame({ goal: 'survival' });
    state.players[0].cash = 0;
    state.players[0].debt = RULES.maxDebt;
    state = endMonth(state);
    expect(state).toMatchObject({ over: true, winner: B });
  });

  it('wins the money game at $60 million', () => {
    let state = newGame({ goal: 'money' });
    state.players[1].cash = RULES.moneyGoal + 1_000_000;
    state = endMonth(state);
    expect(state).toMatchObject({ over: true, winner: B });
  });

  it('wins the market share game with 80% of recent sales', () => {
    let state = newGame({ goal: 'marketShare' });
    state.players[0].salesHistory = [200_000, 200_000];
    state.players[1].salesHistory = [10_000, 10_000];
    state.players[0].stored[GULF] = 100_000;
    state = act(state, A, { type: 'sellOil', region: GULF, barrels: 100_000 });
    state = endMonth(state);
    expect(state).toMatchObject({ over: true, winner: A });
  });

  it('does not end a solo game just because one company is left', () => {
    const state = endMonth(newGame({ companies: [A] }));
    expect(state.over).toBe(false);
  });
});

describe('player view', () => {
  it('hides reserves and rivals finances', () => {
    let { state, field } = strikeOil(newGame(), A, GULF);
    const other = oilField(state, GULF);
    state = act(state, B, { type: 'buyLicence', region: GULF });
    const viewA = viewFor(state, A);
    const viewB = viewFor(state, B);
    expect(viewA.fields.find((f) => f.id === field.id)!.reserves).toBe(field.reserves);
    expect(viewB.fields.find((f) => f.id === field.id)!.reserves).toBe(0);
    expect(viewA.fields.find((f) => f.id === other.id)!.reserves).toBe(0);
    expect(viewA.rivals[0]).toEqual({ company: B, bankrupt: false, endedTurn: false, licences: [GULF] });
    expect(viewA).not.toHaveProperty('rngState');
    expect(JSON.stringify(viewA.rivals)).not.toContain('cash');
  });

  it('ranks companies by net worth including stored oil', () => {
    const state = newGame();
    state.players[0].stored[GULF] = 1_000;
    expect(netWorth(state, state.players[0])).toBe(5_000_000 + 1_000 * state.market.price);
  });
});
