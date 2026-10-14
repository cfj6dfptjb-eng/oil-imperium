import type { Company } from '../constants.js';
import { Rng } from '../rng.js';
import { activePlayers, shippingLeft } from './economy.js';
import { resolveMonth } from './month.js';
import { REGION_DATA, RULES } from './rules.js';
import type { Action, ActionResult, GameState, Player } from './types.js';

/**
 * Applies one player's action. Players act at the same time during a month;
 * actions take effect immediately (first come, first served for fields), and
 * the month resolves once every company still in the game has ended its turn.
 * The input state is never modified.
 */
export function applyAction(state: GameState, company: Company, action: Action): ActionResult {
  if (state.over) return fail('The game is over');
  const next = structuredClone(state);
  const player = next.players.find((p) => p.company === company);
  if (!player) return fail('Unknown company');
  if (player.bankrupt) return fail('Your company is bankrupt');
  if (player.endedTurn) return fail('You have already ended this month');

  const error = run(next, player, action);
  if (error) return fail(error);

  if (activePlayers(next).every((p) => p.endedTurn)) resolveMonth(next);
  return { ok: true, state: next };
}

function run(state: GameState, player: Player, action: Action): string | null {
  const { days } = RULES;
  switch (action.type) {
    case 'buyLicence': {
      if (player.licences.includes(action.region)) return 'You already hold this licence';
      const err = spend(player, REGION_DATA[action.region].licenceCost, days.buyLicence);
      if (err) return err;
      player.licences.push(action.region);
      return null;
    }

    case 'survey': {
      const field = state.fields.find((f) => f.id === action.fieldId);
      if (!field) return 'Unknown field';
      if (!player.licences.includes(field.region)) return 'You need a licence for this region';
      if (field.status !== 'unexplored') return 'This field has already been drilled';
      const err = spend(player, RULES.surveyCost, days.survey);
      if (err) return err;
      const rng = new Rng(state.rngState);
      const estimate = surveyEstimate(field.reserves, rng);
      state.rngState = rng.seed;
      player.surveys = player.surveys.filter((s) => s.fieldId !== field.id);
      player.surveys.push({ fieldId: field.id, estimate, month: state.month });
      return null;
    }

    case 'buyField': {
      const field = state.fields.find((f) => f.id === action.fieldId);
      if (!field) return 'Unknown field';
      if (!player.licences.includes(field.region)) return 'You need a licence for this region';
      if (field.owner) return field.owner === player.company ? 'You already own this field' : 'Another company owns this field';
      const err = spend(player, field.price, days.buyField);
      if (err) return err;
      field.owner = player.company;
      return null;
    }

    case 'startDrilling': {
      const field = state.fields.find((f) => f.id === action.fieldId);
      if (!field) return 'Unknown field';
      if (field.owner !== player.company) return 'You do not own this field';
      if (field.status !== 'unexplored') return 'This field has already been drilled';
      // The first month of drilling is paid up front; later months at month end.
      const err = spend(player, REGION_DATA[field.region].drillCostPerMonth, days.startDrilling);
      if (err) return err;
      field.status = 'drilling';
      return null;
    }

    case 'buildTank': {
      if (!player.licences.includes(action.region)) return 'You need a licence for this region';
      const err = spend(player, RULES.tankCost, days.buildTank);
      if (err) return err;
      player.tanks[action.region] = (player.tanks[action.region] ?? 0) + 1;
      return null;
    }

    case 'sellOil': {
      const barrels = Math.floor(action.barrels);
      if (!(barrels > 0)) return 'Choose how many barrels to sell';
      const stored = player.stored[action.region] ?? 0;
      if (barrels > stored) return 'Not enough oil in storage';
      const left = shippingLeft(player, action.region);
      if (left === 0) return 'No shipping capacity left this month';
      if (barrels > left) return `You can only ship ${left.toLocaleString('en-US')} more barrels this month`;
      const err = spend(player, 0, days.sellOil);
      if (err) return err;
      player.stored[action.region] = stored - barrels;
      player.shipped[action.region] = (player.shipped[action.region] ?? 0) + barrels;
      player.cash += Math.round(barrels * state.market.price);
      player.soldThisMonth += barrels;
      return null;
    }

    case 'takeLoan': {
      const amount = Math.floor(action.amount);
      if (!(amount > 0)) return 'Choose a loan amount';
      if (player.debt + amount > RULES.maxDebt) return 'The bank will not lend you that much';
      const err = spend(player, 0, days.loan);
      if (err) return err;
      player.debt += amount;
      player.cash += amount;
      return null;
    }

    case 'repayLoan': {
      const amount = Math.min(Math.floor(action.amount), player.debt);
      if (!(amount > 0)) return 'You have no loan to repay';
      const err = spend(player, amount, days.loan);
      if (err) return err;
      player.debt -= amount;
      return null;
    }

    case 'buildPipeline': {
      if (!player.licences.includes(action.region)) return 'You need a licence for this region';
      if (player.pipelines.includes(action.region)) return 'You already have a pipeline here';
      const err = spend(player, REGION_DATA[action.region].pipelineCost, days.buildPipeline);
      if (err) return err;
      player.pipelines.push(action.region);
      return null;
    }

    case 'buyTanker': {
      if (!player.licences.includes(action.region)) return 'You need a licence for this region';
      const err = spend(player, RULES.tankerCost, days.buyTanker);
      if (err) return err;
      player.tankers[action.region] = (player.tankers[action.region] ?? 0) + 1;
      return null;
    }

    case 'acceptContract': {
      const offer = state.contractOffers.find((c) => c.id === action.contractId);
      if (!offer) return 'That contract has already gone';
      if (player.contracts.length >= RULES.maxContracts) return `You can hold at most ${RULES.maxContracts} contracts`;
      const err = spend(player, 0, days.acceptContract);
      if (err) return err;
      state.contractOffers = state.contractOffers.filter((c) => c !== offer);
      player.contracts.push(offer);
      return null;
    }

    case 'sabotage': {
      if (action.target === player.company) return 'You cannot sabotage yourself';
      const target = state.players.find((p) => p.company === action.target);
      if (!target) return 'That company is not in this game';
      if (target.bankrupt) return 'That company is already bankrupt';
      if (player.plots.some((p) => p.target === action.target && p.kind === action.kind)) {
        return 'You have already ordered that this month';
      }
      const err = spend(player, RULES.sabotageCost[action.kind], days.sabotage);
      if (err) return err;
      player.plots.push({ target: action.target, kind: action.kind });
      return null;
    }

    case 'setSecurity': {
      if (player.security === action.on) return action.on ? 'Security is already hired' : 'You have no security to dismiss';
      const err = spend(player, 0, days.setSecurity);
      if (err) return err;
      player.security = action.on;
      return null;
    }

    case 'extinguishFire': {
      const field = state.fields.find((f) => f.id === action.fieldId);
      if (!field) return 'Unknown field';
      if (field.owner !== player.company) return 'You do not own this field';
      if (field.status !== 'burning') return 'This well is not on fire';
      const err = spend(player, RULES.extinguishCost, days.extinguishFire);
      if (err) return err;
      field.status = 'producing';
      field.fireMonths = 0;
      return null;
    }

    case 'endTurn':
      player.endedTurn = true;
      return null;

    default:
      return 'Unknown action';
  }
}

/** Deducts money and days, or returns why the player cannot afford it. */
function spend(player: Player, money: number, days: number): string | null {
  if (days > player.daysLeft) return 'Not enough days left this month';
  if (money > player.cash) return 'Not enough money';
  player.cash -= money;
  player.daysLeft -= days;
  return null;
}

function surveyEstimate(reserves: number, rng: Rng): number {
  if (reserves === 0) return rng.chance(0.15) ? Math.round(rng.float(200_000, 800_000) / 10_000) * 10_000 : 0;
  const error = rng.float(-RULES.surveyAccuracy, RULES.surveyAccuracy);
  return Math.round((reserves * (1 + error)) / 10_000) * 10_000;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}
