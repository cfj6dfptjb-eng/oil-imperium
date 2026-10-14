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

export type FieldStatus = 'unexplored' | 'drilling' | 'producing' | 'burning' | 'dry' | 'depleted';

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
  /** Months a burning well has been on fire. */
  fireMonths: number;
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
  /** Barrels sold or delivered this month (market share counts both). */
  soldThisMonth: number;
  /** Regions where the company owns a pipeline. */
  pipelines: Region[];
  /** Tankers per region. */
  tankers: Partial<Record<Region, number>>;
  /** Barrels shipped out of each region this month, against its shipping capacity. */
  shipped: Partial<Record<Region, number>>;
  /** Whether a security company guards this company's wells, tankers and books. */
  security: boolean;
  /** Supply contracts this company has signed. Hidden from rivals. */
  contracts: Contract[];
  /** Sabotage ordered this month, carried out at month end. Hidden from rivals. */
  plots: Plot[];
}

/** A supply contract: a fixed amount of oil each month at a fixed price. */
export interface Contract {
  id: string;
  /** Who the oil goes to, for flavour. */
  buyer: string;
  barrelsPerMonth: number;
  price: number;
  monthsLeft: number;
  /** Paid for every barrel that is not delivered. */
  penaltyPerBarrel: number;
}

export type SabotageKind = 'fire' | 'tanker' | 'books';

export interface Plot {
  target: Company;
  kind: SabotageKind;
}

export type NewsKind = 'war' | 'embargo' | 'discovery' | 'glut' | 'strike';

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
  /** Public: what the newspaper reports. The saboteur is not named. */
  | { type: 'sabotaged'; company: Company; kind: SabotageKind; fieldId?: string; region?: Region; amount?: number }
  | { type: 'plotSucceeded'; company: Company; target: Company; kind: SabotageKind; secret: true }
  /** Public when the saboteur is caught; otherwise only the saboteur hears about it. */
  | { type: 'plotFailed'; company: Company; target: Company; kind: SabotageKind; caught: boolean; fine: number; secret?: true }
  | { type: 'fireOut'; company: Company; fieldId: string }
  | {
      type: 'delivery';
      company: Company;
      contractId: string;
      delivered: number;
      missing: number;
      revenue: number;
      penalty: number;
      secret: true;
    }
  | { type: 'news'; kind: NewsKind; region?: Region; priceChange?: number }
  | { type: 'gameOver'; winner: Company | null; reason: VictoryGoal };

export interface GameState {
  config: GameConfig;
  /** Months elapsed since the start, 0-based. */
  month: number;
  rngState: number;
  players: Player[];
  fields: Field[];
  market: Market;
  /** Supply contracts on offer this month; first come, first served. */
  contractOffers: Contract[];
  nextContractId: number;
  /** Regions where oil workers are on strike this month, so wells there stand still. */
  strikes: Region[];
  /** Events from the last month-end resolution. Events marked secret are only shown to their company. */
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
  | { type: 'buildPipeline'; region: Region }
  | { type: 'buyTanker'; region: Region }
  | { type: 'acceptContract'; contractId: string }
  | { type: 'sabotage'; target: Company; kind: SabotageKind }
  | { type: 'setSecurity'; on: boolean }
  | { type: 'extinguishFire'; fieldId: string }
  | { type: 'endTurn' };

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };
