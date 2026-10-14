import type { Company, Region } from '../constants.js';

export type VictoryGoal = 'timeLimit' | 'survival' | 'marketShare' | 'money';

export interface GameConfig {
  goal: VictoryGoal;
  /** Companies taking part, in seat order. 1 to 4. */
  companies: Company[];
  /** Seed for everything random during play. */
  seed: number;
  /** Seed for the oil field layout. A fixed value gives the same "classic" map every game. */
  mapSeed: number;
}

export type FieldStatus = 'unexplored' | 'drilling' | 'producing' | 'dry' | 'depleted';

export interface Field {
  id: string;
  region: Region;
  col: number;
  row: number;
  price: number;
  /** Hidden: depth in metres where oil is (or would be). */
  depth: number;
  /** Hidden: barrels left. 0 means a dry hole. */
  reserves: number;
  owner: Company | null;
  status: FieldStatus;
  /** Metres drilled so far. */
  drilled: number;
}

export interface SurveyReport {
  fieldId: string;
  /** Estimated reserves in barrels; 0 means the expert expects a dry hole. */
  estimate: number;
  month: number;
}

export interface Player {
  company: Company;
  cash: number;
  debt: number;
  daysLeft: number;
  endedTurn: boolean;
  bankrupt: boolean;
  licences: Region[];
  /** Storage tanks per region. */
  tanks: Partial<Record<Region, number>>;
  /** Barrels in storage per region. */
  stored: Partial<Record<Region, number>>;
  surveys: SurveyReport[];
  /** Barrels sold per month, most recent last. */
  salesHistory: number[];
  soldThisMonth: number;
}

export interface Market {
  price: number;
  /** Price at the start of each month, oldest first. */
  history: number[];
}

export type GameEvent =
  | { type: 'strike'; company: Company; fieldId: string; reserves: number }
  | { type: 'dryHole'; company: Company; fieldId: string }
  | { type: 'depleted'; company: Company; fieldId: string }
  | { type: 'overflow'; company: Company; region: Region; barrels: number }
  | { type: 'autoLoan'; company: Company; amount: number }
  | { type: 'bankrupt'; company: Company }
  | { type: 'gameOver'; winner: Company | null; reason: VictoryGoal };

export interface GameState {
  config: GameConfig;
  /** Months elapsed since the start, 0-based. */
  month: number;
  rngState: number;
  players: Player[];
  fields: Field[];
  market: Market;
  /** Events from the last month-end resolution. */
  events: GameEvent[];
  winner: Company | null;
  over: boolean;
}

export type Action =
  | { type: 'buyLicence'; region: Region }
  | { type: 'survey'; fieldId: string }
  | { type: 'buyField'; fieldId: string }
  | { type: 'startDrilling'; fieldId: string }
  | { type: 'buildTank'; region: Region }
  | { type: 'sellOil'; region: Region; barrels: number }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; amount: number }
  | { type: 'endTurn' };

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };
