import type { Company, Region } from '../constants.js';
import { applyAction } from './actions.js';
import { CLASSIC_MAP_SEED, createGame } from './setup.js';
import type { Action, Field, GameConfig, GameState } from './types.js';

export const A: Company = 'Interoil';
export const B: Company = 'Transoil';
export const GULF: Region = 'Gulf Region';

export function newGame(overrides: Partial<GameConfig> = {}): GameState {
  return createGame({ goal: 'timeLimit', companies: [A, B], seed: 1, mapSeed: CLASSIC_MAP_SEED, ...overrides });
}

/** Applies an action and fails the test if it is rejected. */
export function act(state: GameState, company: Company, action: Action): GameState {
  const result = applyAction(state, company, action);
  if (!result.ok) throw new Error(`${company} ${action.type}: ${result.error}`);
  return result.state;
}

export function endMonth(state: GameState): GameState {
  for (const p of state.players) if (!p.bankrupt && !p.endedTurn) state = act(state, p.company, { type: 'endTurn' });
  return state;
}

export function oilField(state: GameState, region: Region): Field {
  const field = state.fields.find((f) => f.region === region && f.reserves > 0 && !f.owner);
  if (!field) throw new Error(`No oil field in ${region}`);
  return field;
}

export function dryField(state: GameState): Field {
  const field = state.fields.find((f) => f.reserves === 0 && !f.owner);
  if (!field) throw new Error('No dry field');
  return field;
}

export function player(state: GameState, company: Company) {
  return state.players.find((p) => p.company === company)!;
}

/** Buys a licence and a field and drills it until it produces. */
export function strikeOil(state: GameState, company: Company, region: Region): { state: GameState; field: Field } {
  const field = oilField(state, region);
  if (!player(state, company).licences.includes(region)) state = act(state, company, { type: 'buyLicence', region });
  state = act(state, company, { type: 'buyField', fieldId: field.id });
  state = act(state, company, { type: 'startDrilling', fieldId: field.id });
  while (state.fields.find((f) => f.id === field.id)!.status === 'drilling') state = endMonth(state);
  return { state, field: state.fields.find((f) => f.id === field.id)! };
}
