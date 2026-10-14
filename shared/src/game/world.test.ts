import { describe, expect, it } from 'vitest';
import { applyAction } from './actions.js';
import { shippingCapacity } from './economy.js';
import { RULES } from './rules.js';
import { upgradeGame } from './setup.js';
import { A, act, B, endMonth, GULF, newGame, player, strikeOil } from './test-helpers.js';
import type { GameEvent, GameState, SabotageKind } from './types.js';
import { viewFor } from './view.js';

/** A game where A has a producing Gulf well with tanks and some oil in storage. */
function producing(): GameState {
  let { state } = strikeOil(newGame(), A, GULF);
  state = act(state, A, { type: 'buildTank', region: GULF });
  state = act(state, A, { type: 'buildTank', region: GULF });
  state = endMonth(state);
  return state;
}

/** Orders the same sabotage under many seeds and collects what happened. */
function plotOutcomes(kind: SabotageKind, setup: (s: GameState) => void = () => {}): GameEvent[][] {
  const outcomes: GameEvent[][] = [];
  const base = producing();
  for (let seed = 1; seed <= 60; seed++) {
    let state = structuredClone(base);
    state.rngState = seed;
    setup(state);
    state = act(state, B, { type: 'sabotage', target: A, kind });
    outcomes.push(endMonth(state).events);
  }
  return outcomes;
}

describe('transport', () => {
  it('limits shipments to road capacity until a pipeline or tankers are bought', () => {
    let state = producing();
    state.players[0].stored[GULF] = 200_000;
    expect(applyAction(state, A, { type: 'sellOil', region: GULF, barrels: 20_000 })).toMatchObject({ ok: false });
    state = act(state, A, { type: 'sellOil', region: GULF, barrels: RULES.roadCapacity });
    expect(applyAction(state, A, { type: 'sellOil', region: GULF, barrels: 1 })).toEqual({
      ok: false,
      error: 'No shipping capacity left this month',
    });

    state = act(state, A, { type: 'buildPipeline', region: GULF });
    state = act(state, A, { type: 'buyTanker', region: GULF });
    expect(shippingCapacity(player(state, A), GULF)).toBe(RULES.roadCapacity + RULES.pipelineCapacity + RULES.tankerCapacity);
    state = act(state, A, { type: 'sellOil', region: GULF, barrels: RULES.pipelineCapacity + RULES.tankerCapacity });
    expect(applyAction(state, A, { type: 'buildPipeline', region: GULF })).toMatchObject({ ok: false });

    // Capacity comes back next month, and the new kit costs upkeep.
    const cash = player(state, A).cash;
    state = endMonth(state);
    expect(player(state, A).shipped).toEqual({});
    expect(cash - player(state, A).cash).toBeGreaterThan(RULES.pipelineUpkeepPerMonth + RULES.tankerUpkeepPerMonth);
  });

  it('needs a licence to build a pipeline or buy a tanker', () => {
    const state = newGame();
    expect(applyAction(state, A, { type: 'buildPipeline', region: 'USSR' })).toMatchObject({ ok: false });
    expect(applyAction(state, A, { type: 'buyTanker', region: 'USSR' })).toMatchObject({ ok: false });
  });
});

describe('supply contracts', () => {
  it('offers fresh contracts every month, first come first served', () => {
    let state = newGame();
    expect(state.contractOffers).toHaveLength(RULES.contractOffersPerMonth);
    const offer = state.contractOffers[0];
    state = act(state, A, { type: 'acceptContract', contractId: offer.id });
    expect(player(state, A).contracts).toEqual([offer]);
    expect(applyAction(state, B, { type: 'acceptContract', contractId: offer.id })).toEqual({
      ok: false,
      error: 'That contract has already gone',
    });
    const left = state.contractOffers[0].id;
    state = endMonth(state);
    expect(state.contractOffers.map((c) => c.id)).not.toContain(left);
    expect(state.contractOffers).toHaveLength(RULES.contractOffersPerMonth);
  });

  it('pays for delivered oil and charges a penalty for the rest', () => {
    let state = producing();
    const me = player(state, A);
    me.stored[GULF] = 10_000;
    me.contracts = [{ id: 'X', buyer: 'Test', barrelsPerMonth: 30_000, price: 25, monthsLeft: 2, penaltyPerBarrel: 10 }];
    // Production this month adds to storage before delivery, so count it.
    state = endMonth(state);
    const delivery = state.events.find((e) => e.type === 'delivery');
    expect(delivery).toMatchObject({ company: A, contractId: 'X' });
    if (delivery?.type !== 'delivery') throw new Error('no delivery');
    expect(delivery.delivered + delivery.missing).toBe(30_000);
    expect(delivery.delivered).toBeLessThanOrEqual(RULES.roadCapacity);
    expect(delivery.penalty).toBe(delivery.missing * 10);
    expect(delivery.revenue).toBe(delivery.delivered * 25);
    expect(player(state, A).salesHistory.at(-1)).toBe(delivery.delivered);
    expect(player(state, A).contracts[0].monthsLeft).toBe(1);

    state = endMonth(state);
    expect(player(state, A).contracts).toEqual([]);
    // Rivals never see someone else's deliveries.
    expect(viewFor(state, B).events.some((e) => e.type === 'delivery')).toBe(false);
  });

  it('limits how many contracts a company can hold', () => {
    const state = newGame();
    state.players[0].contracts = Array.from({ length: RULES.maxContracts }, (_, i) => ({
      id: `Z${i}`,
      buyer: 'Test',
      barrelsPerMonth: 1,
      price: 1,
      monthsLeft: 1,
      penaltyPerBarrel: 1,
    }));
    expect(applyAction(state, A, { type: 'acceptContract', contractId: state.contractOffers[0].id })).toMatchObject({ ok: false });
  });
});

describe('sabotage', () => {
  it('sets wells on fire without naming the saboteur, unless they are caught', () => {
    const outcomes = plotOutcomes('fire');
    const hit = outcomes.find((events) => events.some((e) => e.type === 'sabotaged'))!;
    expect(hit).toContainEqual(expect.objectContaining({ type: 'sabotaged', company: A, kind: 'fire' }));
    expect(hit).toContainEqual(expect.objectContaining({ type: 'plotSucceeded', company: B, target: A }));

    let state = producing();
    state.rngState = outcomes.indexOf(hit) + 1;
    state = act(state, B, { type: 'sabotage', target: A, kind: 'fire' });
    expect(viewFor(state, A).you.plots).toEqual([]);
    expect(viewFor(state, B).you.plots).toEqual([{ target: A, kind: 'fire' }]);
    state = endMonth(state);
    const victim = viewFor(state, A);
    expect(victim.events.some((e) => e.type === 'plotSucceeded')).toBe(false);
    expect(JSON.stringify(victim.events)).not.toContain(B);
    expect(state.fields.filter((f) => f.status === 'burning')).toHaveLength(1);

    const caught = outcomes.find((events) => events.some((e) => e.type === 'plotFailed' && e.caught))!;
    expect(caught).toContainEqual(expect.objectContaining({ type: 'plotFailed', company: B, fine: RULES.sabotageFine }));
    expect(caught.find((e) => e.type === 'plotFailed')).not.toHaveProperty('secret');
  });

  it('is much less likely to work against a company with security', () => {
    const successes = (events: GameEvent[][]) => events.filter((e) => e.some((x) => x.type === 'sabotaged')).length;
    const open = successes(plotOutcomes('books'));
    const guarded = successes(
      plotOutcomes('books', (s) => {
        s.players[0].security = true;
      }),
    );
    expect(guarded).toBeLessThan(open);
  });

  it('sinks tankers and cooks the books', () => {
    const tankers = plotOutcomes('tanker', (s) => {
      s.players[0].tankers[GULF] = 2;
    });
    expect(tankers.flat()).toContainEqual({ type: 'sabotaged', company: A, kind: 'tanker', region: GULF });
    const books = plotOutcomes('books').flat().find((e) => e.type === 'sabotaged');
    expect(books).toMatchObject({ company: A, kind: 'books' });
  });

  it('fails when there is nothing to hit', () => {
    let state = newGame();
    state = act(state, B, { type: 'sabotage', target: A, kind: 'tanker' });
    state = endMonth(state);
    expect(state.events.some((e) => e.type === 'sabotaged')).toBe(false);
    expect(viewFor(state, B).events).toContainEqual(expect.objectContaining({ type: 'plotFailed', company: B }));
  });

  it('rejects sabotage against yourself or a missing company', () => {
    const state = newGame();
    expect(applyAction(state, A, { type: 'sabotage', target: A, kind: 'fire' })).toMatchObject({ ok: false });
    expect(applyAction(state, A, { type: 'sabotage', target: 'Explora Inc.', kind: 'fire' })).toMatchObject({ ok: false });
  });

  it('charges for security every month', () => {
    let state = newGame();
    state = act(state, A, { type: 'setSecurity', on: true });
    expect(applyAction(state, A, { type: 'setSecurity', on: true })).toMatchObject({ ok: false });
    state = endMonth(state);
    expect(player(state, A).cash).toBe(5_000_000 - RULES.companyOverheadPerMonth - RULES.securityCostPerMonth);
  });
});

describe('fires', () => {
  it('stops production and burns reserves until put out', () => {
    let state = producing();
    const well = state.fields.find((f) => f.owner === A && f.status === 'producing')!;
    well.status = 'burning';
    const reserves = well.reserves;
    const stored = player(state, A).stored[GULF] ?? 0;
    state = endMonth(state);
    const burnt = state.fields.find((f) => f.id === well.id)!;
    expect(burnt.reserves).toBeLessThan(reserves);
    expect(player(state, A).stored[GULF] ?? 0).toBe(stored);

    expect(applyAction(state, B, { type: 'extinguishFire', fieldId: well.id })).toMatchObject({ ok: false });
    const cash = player(state, A).cash;
    state = act(state, A, { type: 'extinguishFire', fieldId: well.id });
    expect(state.fields.find((f) => f.id === well.id)!.status).toBe('producing');
    expect(player(state, A).cash).toBe(cash - RULES.extinguishCost);
  });

  it('burns itself out after a few months', () => {
    let state = producing();
    const well = state.fields.find((f) => f.owner === A && f.status === 'producing')!;
    well.status = 'burning';
    for (let i = 0; i < RULES.fireBurnOutMonths; i++) state = endMonth(state);
    expect(state.fields.find((f) => f.id === well.id)!.status).toBe('producing');
    expect(state.events).toContainEqual({ type: 'fireOut', company: A, fieldId: well.id });
  });
});

describe('world news', () => {
  it('reports price shocks and strikes now and then', () => {
    let state = newGame();
    const news: GameEvent[] = [];
    for (let i = 0; i < 30; i++) {
      state = endMonth(state);
      news.push(...state.events.filter((e) => e.type === 'news'));
    }
    expect(news.length).toBeGreaterThan(3);
    expect(news.some((e) => e.type === 'news' && e.priceChange !== undefined)).toBe(true);
  });

  it('halts production in a region on strike', () => {
    let state = producing();
    state.strikes = [GULF];
    const stored = player(state, A).stored[GULF] ?? 0;
    state = endMonth(state);
    expect(player(state, A).stored[GULF] ?? 0).toBe(stored);
  });
});

describe('saved games', () => {
  it('upgrades a game saved before transport and sabotage existed', () => {
    const state = newGame() as unknown as Record<string, unknown>;
    delete state.contractOffers;
    delete state.strikes;
    delete state.nextContractId;
    const players = state.players as Record<string, unknown>[];
    for (const p of players) for (const key of ['pipelines', 'tankers', 'shipped', 'security', 'contracts', 'plots']) delete p[key];
    const upgraded = upgradeGame(state as unknown as GameState);
    expect(upgraded.players[0]).toMatchObject({ pipelines: [], tankers: {}, security: false, contracts: [], plots: [] });
    expect(endMonth(upgraded).month).toBe(1);
  });
});
