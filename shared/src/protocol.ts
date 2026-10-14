import { COMPANIES, PROTOCOL_VERSION, REGIONS, type Company } from './constants.js';
import type { Action, GameEvent, SabotageKind, VictoryGoal } from './game/types.js';
import type { PlayerView } from './game/view.js';

export const GOALS: VictoryGoal[] = ['timeLimit', 'survival', 'marketShare', 'money'];
export const MAX_NAME_LENGTH = 12;
export const SABOTAGE_KINDS: SabotageKind[] = ['fire', 'tanker', 'books'];

export interface SeatInfo {
  company: Company;
  /** Player name, or null when the computer plays this seat. */
  player: string | null;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  goal: VictoryGoal;
  started: boolean;
  seats: SeatInfo[];
  /** Your own seat, if you have taken one. */
  you: Company | null;
  host: boolean;
}

/** Messages the client sends to the server. */
export type ClientMessage =
  | { type: 'ping'; t: number }
  | { type: 'createRoom'; name: string }
  | { type: 'joinRoom'; code: string; name: string; token?: string }
  | { type: 'leaveRoom' }
  | { type: 'takeSeat'; company: Company }
  | { type: 'setGoal'; goal: VictoryGoal }
  | { type: 'startGame' }
  | { type: 'action'; action: Action; id: number };

/** Messages the server sends to the client. */
export type ServerMessage =
  | { type: 'hello'; protocol: number; serverTime: number }
  | { type: 'pong'; t: number }
  | { type: 'error'; message: string }
  /** Sent when you join a room: keep the token to rejoin after a disconnect. */
  | { type: 'joined'; code: string; token: string }
  | { type: 'room'; room: RoomInfo }
  /** The game as your company sees it, plus the humans the month is waiting for. */
  | { type: 'game'; view: PlayerView; lastEvents: GameEvent[]; waitingFor: Company[] }
  | { type: 'actionResult'; id: number; error: string | null };

export function hello(): ServerMessage {
  return { type: 'hello', protocol: PROTOCOL_VERSION, serverTime: Date.now() };
}

/** Cleans a player name: letters, digits and spaces, upper case, limited length. */
export function cleanName(raw: string): string {
  const name = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return name || 'PLAYER';
}

/** Parses and validates an incoming client message. Returns null if invalid. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  const msg = data;
  switch (msg.type) {
    case 'ping':
      return typeof msg.t === 'number' ? { type: 'ping', t: msg.t } : null;
    case 'createRoom':
      return typeof msg.name === 'string' ? { type: 'createRoom', name: msg.name } : null;
    case 'joinRoom':
      if (typeof msg.code !== 'string' || typeof msg.name !== 'string') return null;
      if (msg.token !== undefined && typeof msg.token !== 'string') return null;
      return { type: 'joinRoom', code: msg.code, name: msg.name, ...(msg.token ? { token: msg.token } : {}) };
    case 'leaveRoom':
      return { type: 'leaveRoom' };
    case 'takeSeat':
      return isCompany(msg.company) ? { type: 'takeSeat', company: msg.company } : null;
    case 'setGoal':
      return GOALS.includes(msg.goal as VictoryGoal) ? { type: 'setGoal', goal: msg.goal as VictoryGoal } : null;
    case 'startGame':
      return { type: 'startGame' };
    case 'action': {
      const action = parseAction(msg.action);
      return action && typeof msg.id === 'number' ? { type: 'action', action, id: msg.id } : null;
    }
    default:
      return null;
  }
}

/** Checks an action's shape so the rules engine only ever sees well-formed input. */
export function parseAction(data: unknown): Action | null {
  if (!isObject(data)) return null;
  const isRegion = (r: unknown) => REGIONS.includes(r as never);
  const isId = (id: unknown) => typeof id === 'string' && id.length < 64;
  const isAmount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1e12;
  switch (data.type) {
    case 'buyLicence':
      return isRegion(data.region) ? { type: 'buyLicence', region: data.region as never } : null;
    case 'buildTank':
    case 'buildPipeline':
    case 'buyTanker':
      return isRegion(data.region) ? { type: data.type, region: data.region as never } : null;
    case 'acceptContract':
      return isId(data.contractId) ? { type: 'acceptContract', contractId: data.contractId as string } : null;
    case 'sabotage':
      return isCompany(data.target) && SABOTAGE_KINDS.includes(data.kind as never)
        ? { type: 'sabotage', target: data.target, kind: data.kind as never }
        : null;
    case 'setSecurity':
      return typeof data.on === 'boolean' ? { type: 'setSecurity', on: data.on } : null;
    case 'survey':
    case 'buyField':
    case 'startDrilling':
    case 'extinguishFire':
      return isId(data.fieldId) ? { type: data.type, fieldId: data.fieldId as string } : null;
    case 'sellOil':
      return isRegion(data.region) && isAmount(data.barrels)
        ? { type: 'sellOil', region: data.region as never, barrels: data.barrels as number }
        : null;
    case 'takeLoan':
    case 'repayLoan':
      return isAmount(data.amount) ? { type: data.type, amount: data.amount as number } : null;
    case 'endTurn':
      return { type: 'endTurn' };
    default:
      return null;
  }
}

function isCompany(c: unknown): c is Company {
  return COMPANIES.includes(c as Company);
}

function isObject(d: unknown): d is Record<string, unknown> {
  return typeof d === 'object' && d !== null && !Array.isArray(d);
}
