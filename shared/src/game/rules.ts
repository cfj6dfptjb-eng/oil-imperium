import type { Region } from '../constants.js';

/**
 * Tunable numbers for the rules engine. These are first guesses in the spirit
 * of the original and should be checked against the manual and emulator play
 * (see docs/design.md, section 6).
 */
export const RULES = {
  daysPerMonth: 30,
  timeLimitMonths: 36,
  moneyGoal: 60_000_000,
  marketShareGoal: 0.8,
  /** Months of sales history used for the market share goal. */
  marketShareWindow: 3,
  /** Total sales in the window must reach this before the share goal can be won. */
  marketShareMinBarrels: 300_000,

  companyOverheadPerMonth: 50_000,

  surveyCost: 25_000,
  /** Survey estimates are within this fraction of the true reserves. */
  surveyAccuracy: 0.3,

  /** Metres drilled per month by automatic drilling. */
  drillMetresPerMonth: 1_000,
  /** Drilling speed multiplier in the money goal game, which slows drilling. */
  moneyGoalDrillFactor: 0.5,

  wellUpkeepPerMonth: 10_000,
  /** Fraction of a field's remaining reserves pumped each month. */
  productionRate: 0.04,
  maxWellOutputPerMonth: 80_000,

  tankCapacity: 50_000,
  tankCost: 100_000,
  tankUpkeepPerMonth: 2_000,

  loanInterestPerMonth: 0.01,
  maxDebt: 10_000_000,

  startingOilPrice: 20,
  baseOilPrice: 20,
  minOilPrice: 8,
  maxOilPrice: 60,
  /** How strongly the price drifts back towards the base each month. */
  priceReversion: 0.2,
  priceVolatility: 4,
  /** Price drop in dollars per million barrels sold by all companies in a month. */
  pricePressurePerMillion: 1.5,

  /** Day costs of actions. */
  days: {
    buyLicence: 5,
    survey: 3,
    buyField: 2,
    startDrilling: 3,
    buildTank: 2,
    sellOil: 1,
    loan: 1,
  },
} as const;

export interface RegionData {
  licenceCost: number;
  /** Price range of a field before modifiers. */
  fieldPrice: [number, number];
  drillCostPerMonth: number;
  /** Depth range of oil in metres. */
  depth: [number, number];
  /** Chance a field holds oil at all. */
  oilChance: number;
  /** Reserve range in barrels for fields that hold oil. */
  reserves: [number, number];
  /** Cost per barrel to pump. */
  productionCost: number;
}

/** Per-region economics: harsh regions cost more but hide bigger fields. */
export const REGION_DATA: Record<Region, RegionData> = {
  Alaska: {
    licenceCost: 600_000,
    fieldPrice: [300_000, 700_000],
    drillCostPerMonth: 250_000,
    depth: [1_500, 3_500],
    oilChance: 0.5,
    reserves: [1_000_000, 4_000_000],
    productionCost: 6,
  },
  'North America': {
    licenceCost: 400_000,
    fieldPrice: [200_000, 500_000],
    drillCostPerMonth: 120_000,
    depth: [800, 2_500],
    oilChance: 0.55,
    reserves: [500_000, 2_000_000],
    productionCost: 5,
  },
  'Central America': {
    licenceCost: 250_000,
    fieldPrice: [150_000, 350_000],
    drillCostPerMonth: 90_000,
    depth: [600, 2_000],
    oilChance: 0.45,
    reserves: [400_000, 1_500_000],
    productionCost: 4,
  },
  'South America': {
    licenceCost: 300_000,
    fieldPrice: [150_000, 400_000],
    drillCostPerMonth: 100_000,
    depth: [700, 2_500],
    oilChance: 0.5,
    reserves: [500_000, 2_500_000],
    productionCost: 4,
  },
  Europe: {
    licenceCost: 700_000,
    fieldPrice: [400_000, 900_000],
    drillCostPerMonth: 300_000,
    depth: [1_500, 3_000],
    oilChance: 0.4,
    reserves: [800_000, 3_000_000],
    productionCost: 7,
  },
  USSR: {
    licenceCost: 500_000,
    fieldPrice: [200_000, 500_000],
    drillCostPerMonth: 150_000,
    depth: [1_000, 3_000],
    oilChance: 0.55,
    reserves: [800_000, 3_500_000],
    productionCost: 5,
  },
  'Gulf Region': {
    licenceCost: 900_000,
    fieldPrice: [500_000, 1_200_000],
    drillCostPerMonth: 100_000,
    depth: [500, 1_500],
    oilChance: 0.75,
    reserves: [1_500_000, 6_000_000],
    productionCost: 2,
  },
  Indochina: {
    licenceCost: 200_000,
    fieldPrice: [100_000, 300_000],
    drillCostPerMonth: 80_000,
    depth: [600, 2_000],
    oilChance: 0.35,
    reserves: [300_000, 1_500_000],
    productionCost: 3,
  },
};

/** Fields per region, laid out as a grid on the region map. */
export const FIELD_GRID = { cols: 5, rows: 4 } as const;
