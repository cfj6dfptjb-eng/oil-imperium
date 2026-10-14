import { REGIONS, STARTING_CASH } from '../constants.js';
import { Rng } from '../rng.js';
import { refreshContractOffers } from './contracts.js';
import { FIELD_GRID, REGION_DATA, RULES } from './rules.js';
import type { Field, GameConfig, GameState, Player } from './types.js';

/** Map seed used for the "classic" layout, where good fields sit in the same places every game. */
export const CLASSIC_MAP_SEED = 1989;

export function createGame(config: GameConfig): GameState {
  if (config.companies.length < 1 || config.companies.length > 4) {
    throw new Error('A game needs 1 to 4 companies');
  }
  if (new Set(config.companies).size !== config.companies.length) {
    throw new Error('Each company can only be played once');
  }
  const state: GameState = {
    config,
    month: 0,
    rngState: config.seed >>> 0,
    players: config.companies.map(createPlayer),
    fields: generateFields(config.mapSeed),
    market: { price: RULES.startingOilPrice, history: [RULES.startingOilPrice] },
    contractOffers: [],
    nextContractId: 1,
    strikes: [],
    events: [],
    winner: null,
    over: false,
  };
  const rng = new Rng(state.rngState);
  refreshContractOffers(state, rng);
  state.rngState = rng.seed;
  return state;
}

/**
 * Fills in anything a game saved by an older version lacks, so games in
 * progress survive an upgrade. Modifies and returns the state.
 */
export function upgradeGame(state: GameState): GameState {
  state.contractOffers ??= [];
  state.nextContractId ??= 1;
  state.strikes ??= [];
  for (const field of state.fields) field.fireMonths ??= 0;
  for (const player of state.players) {
    const fresh = createPlayer(player.company);
    for (const key of ['pipelines', 'tankers', 'shipped', 'security', 'contracts', 'plots'] as const) {
      (player as unknown as Record<string, unknown>)[key] ??= fresh[key];
    }
  }
  return state;
}

function createPlayer(company: Player['company']): Player {
  return {
    company,
    cash: STARTING_CASH,
    debt: 0,
    daysLeft: RULES.daysPerMonth,
    endedTurn: false,
    bankrupt: false,
    licences: [],
    tanks: {},
    stored: {},
    surveys: [],
    salesHistory: [],
    soldThisMonth: 0,
    pipelines: [],
    tankers: {},
    shipped: {},
    security: false,
    contracts: [],
    plots: [],
  };
}

export function generateFields(mapSeed: number): Field[] {
  const rng = new Rng(mapSeed);
  const fields: Field[] = [];
  for (const region of REGIONS) {
    const data = REGION_DATA[region];
    for (let row = 0; row < FIELD_GRID.rows; row++) {
      for (let col = 0; col < FIELD_GRID.cols; col++) {
        const hasOil = rng.chance(data.oilChance);
        fields.push({
          id: `${region}:${col},${row}`,
          region,
          col,
          row,
          price: roundTo(rng.float(...data.fieldPrice), 10_000),
          depth: roundTo(rng.float(...data.depth), 50),
          reserves: hasOil ? roundTo(rng.float(...data.reserves), 10_000) : 0,
          owner: null,
          status: 'unexplored',
          drilled: 0,
          fireMonths: 0,
        });
      }
    }
  }
  return fields;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
