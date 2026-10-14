import { COMPANIES, REGIONS, type Company, type Region } from '../constants.js';
import { applyAction } from './actions.js';
import { REGION_DATA, RULES } from './rules.js';
import type { Action, GameState } from './types.js';
import { viewFor, type PlayerView } from './view.js';

/** Cash the computer keeps in hand before spending on expansion. */
const CASH_BUFFER = 600_000;
const MAX_ACTIONS_PER_TURN = 25;

/**
 * Plays one month for a computer-controlled company and ends its turn. It only
 * looks at what that company is allowed to see, so it cannot cheat by reading
 * hidden reserves. Returns the new state; the input is not modified.
 */
export function playAiTurn(state: GameState, company: Company): GameState {
  const tried = new Set<string>();
  for (let i = 0; i < MAX_ACTIONS_PER_TURN; i++) {
    const me = state.players.find((p) => p.company === company);
    if (!me || me.bankrupt || me.endedTurn || state.over) return state;
    const action = chooseAction(viewFor(state, company), tried);
    if (!action) break;
    tried.add(JSON.stringify(action));
    const result = applyAction(state, company, action);
    if (result.ok) state = result.state;
  }
  const result = applyAction(state, company, { type: 'endTurn' });
  return result.ok ? result.state : state;
}

function chooseAction(view: PlayerView, tried: Set<string>): Action | null {
  const candidates = [...sellOil(view), ...buildTanks(view), ...manageDebt(view), ...expand(view)];
  return candidates.find((a) => !tried.has(JSON.stringify(a))) ?? null;
}

function sellOil(view: PlayerView): Action[] {
  const { you, market } = view;
  const recent = market.history.slice(-6);
  const average = recent.reduce((a, b) => a + b, 0) / recent.length;
  const actions: Action[] = [];
  for (const region of REGIONS) {
    const stored = you.stored[region] ?? 0;
    if (stored <= 0) continue;
    const capacity = (you.tanks[region] ?? 0) * RULES.tankCapacity;
    const nearlyFull = stored >= capacity * 0.6;
    if (market.price >= average * 0.95 || nearlyFull || you.cash < CASH_BUFFER) {
      actions.push({ type: 'sellOil', region, barrels: stored });
    }
  }
  return actions;
}

function buildTanks(view: PlayerView): Action[] {
  const { you, fields } = view;
  const actions: Action[] = [];
  for (const region of REGIONS) {
    const wells = fields.filter(
      (f) => f.owner === you.company && f.region === region && (f.status === 'producing' || f.status === 'drilling'),
    );
    if (wells.length === 0) continue;
    const needed = Math.ceil((wells.length * RULES.maxWellOutputPerMonth) / RULES.tankCapacity);
    if ((you.tanks[region] ?? 0) < needed && you.cash > RULES.tankCost + CASH_BUFFER / 2) {
      actions.push({ type: 'buildTank', region });
    }
  }
  return actions;
}

function manageDebt(view: PlayerView): Action[] {
  const { you } = view;
  if (you.cash < CASH_BUFFER / 2 && you.debt < RULES.maxDebt / 2) {
    return [{ type: 'takeLoan', amount: 1_000_000 }];
  }
  if (you.debt > 0 && you.cash > 4_000_000) {
    return [{ type: 'repayLoan', amount: Math.min(you.debt, you.cash - 3_000_000) }];
  }
  return [];
}

function expand(view: PlayerView): Action[] {
  const { you, fields, month } = view;
  const active = fields.filter((f) => f.owner === you.company && (f.status === 'drilling' || f.status === 'producing'));
  const targetWells = 1 + Math.floor(month / 4);
  if (active.length >= targetWells || you.cash < CASH_BUFFER) return [];

  const actions: Action[] = [];
  const surveys = new Map(you.surveys.map((s) => [s.fieldId, s.estimate]));

  // Drill fields already owned.
  for (const f of fields) {
    if (f.owner === you.company && f.status === 'unexplored') {
      actions.push({ type: 'startDrilling', fieldId: f.id });
    }
  }

  for (const region of preferredRegions(you.company)) {
    const data = REGION_DATA[region];
    if (!you.licences.includes(region)) {
      if (you.cash > data.licenceCost + data.fieldPrice[1] + data.drillCostPerMonth * 2 + CASH_BUFFER) {
        actions.push({ type: 'buyLicence', region });
      }
      continue;
    }
    const open = fields.filter((f) => f.region === region && !f.owner && f.status === 'unexplored');
    // Buy the best surveyed field that looks worth it.
    const worthIt = open
      .filter((f) => (surveys.get(f.id) ?? 0) * view.market.price * 0.3 > f.price)
      .sort((a, b) => (surveys.get(b.id) ?? 0) - (surveys.get(a.id) ?? 0));
    for (const f of worthIt) actions.push({ type: 'buyField', fieldId: f.id });
    // Otherwise survey a couple of fields.
    for (const f of open.filter((f) => !surveys.has(f.id)).slice(0, 3)) {
      actions.push({ type: 'survey', fieldId: f.id });
    }
  }
  return actions;
}

/** Each company favours different regions so they spread out like the originals did. */
function preferredRegions(company: Company): Region[] {
  const offset = COMPANIES.indexOf(company) * 2;
  return REGIONS.map((_, i) => REGIONS[(i + offset) % REGIONS.length]);
}
