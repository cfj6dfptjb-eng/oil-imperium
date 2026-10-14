import { randomBytes } from 'node:crypto';
import {
  applyAction,
  CLASSIC_MAP_SEED,
  COMPANIES,
  createGame,
  playAiTurn,
  viewFor,
  type Action,
  type Company,
  type GameState,
  type RoomInfo,
  type ServerMessage,
  type VictoryGoal,
} from '@oil/shared';

export interface Seat {
  company: Company;
  /** Token of the human in this seat, or null for a computer player. */
  token: string | null;
}

export interface Member {
  token: string;
  name: string;
}

/** Everything about a room that is saved to the database. */
export interface RoomData {
  code: string;
  hostToken: string;
  goal: VictoryGoal;
  members: Member[];
  seats: Seat[];
  state: GameState | null;
}

export function newToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * One online game: a lobby where people pick companies, then the game itself.
 * Seats without a human are played by the computer. All methods return an
 * error message, or null on success.
 */
export class Room {
  constructor(public data: RoomData) {}

  static create(code: string, hostName: string): { room: Room; token: string } {
    const token = newToken();
    const room = new Room({
      code,
      hostToken: token,
      goal: 'timeLimit',
      members: [{ token, name: hostName }],
      seats: COMPANIES.map((company) => ({ company, token: null })),
      state: null,
    });
    room.takeSeat(token, COMPANIES[0]);
    return { room, token };
  }

  get code(): string {
    return this.data.code;
  }

  get started(): boolean {
    return this.data.state !== null;
  }

  member(token: string): Member | undefined {
    return this.data.members.find((m) => m.token === token);
  }

  companyOf(token: string): Company | null {
    return this.data.seats.find((s) => s.token === token)?.company ?? null;
  }

  /** Adds a person to the room, or recognises a returning one by token. Returns their token. */
  join(name: string, token?: string): { token: string } | { error: string } {
    if (token && this.member(token)) return { token };
    if (this.started) return { error: 'This game has already started' };
    if (this.data.members.length >= 8) return { error: 'This room is full' };
    const fresh = newToken();
    this.data.members.push({ token: fresh, name });
    // Take the first free company so joining is one step.
    const free = this.data.seats.find((s) => s.token === null);
    if (free) free.token = fresh;
    return { token: fresh };
  }

  leave(token: string): void {
    if (this.started) return;
    for (const seat of this.data.seats) if (seat.token === token) seat.token = null;
    this.data.members = this.data.members.filter((m) => m.token !== token);
    if (token === this.data.hostToken && this.data.members.length > 0) {
      this.data.hostToken = this.data.members[0].token;
    }
  }

  takeSeat(token: string, company: Company): string | null {
    if (this.started) return 'The game has already started';
    if (!this.member(token)) return 'You are not in this room';
    const seat = this.data.seats.find((s) => s.company === company)!;
    if (seat.token && seat.token !== token) return 'Another player has that company';
    for (const s of this.data.seats) if (s.token === token) s.token = null;
    seat.token = token;
    return null;
  }

  setGoal(token: string, goal: VictoryGoal): string | null {
    if (this.started) return 'The game has already started';
    if (token !== this.data.hostToken) return 'Only the host can change the goal';
    this.data.goal = goal;
    return null;
  }

  start(token: string, seed = Math.floor(Math.random() * 2 ** 31)): string | null {
    if (this.started) return 'The game has already started';
    if (token !== this.data.hostToken) return 'Only the host can start the game';
    if (!this.companyOf(token)) return 'Pick a company first';
    this.data.state = createGame({ goal: this.data.goal, companies: [...COMPANIES], seed, mapSeed: CLASSIC_MAP_SEED });
    this.playComputers();
    return null;
  }

  act(token: string, action: Action): string | null {
    const state = this.data.state;
    if (!state) return 'The game has not started';
    const company = this.companyOf(token);
    if (!company) return 'You are not playing in this game';
    const result = applyAction(state, company, action);
    if (!result.ok) return result.error;
    this.data.state = result.state;
    if (result.state.month !== state.month) this.playComputers();
    return null;
  }

  /** Humans the current month is still waiting for. */
  waitingFor(): Company[] {
    const state = this.data.state;
    if (!state || state.over) return [];
    const humans = this.data.seats.filter((s) => s.token).map((s) => s.company);
    return state.players
      .filter((p) => humans.includes(p.company) && !p.bankrupt && !p.endedTurn)
      .map((p) => p.company);
  }

  info(token: string, connected: (token: string) => boolean): RoomInfo {
    return {
      code: this.code,
      goal: this.data.goal,
      started: this.started,
      seats: this.data.seats.map((s) => ({
        company: s.company,
        player: s.token ? (this.member(s.token)?.name ?? null) : null,
        connected: s.token ? connected(s.token) : true,
      })),
      you: this.companyOf(token),
      host: token === this.data.hostToken,
    };
  }

  gameMessage(token: string): ServerMessage | null {
    const state = this.data.state;
    const company = this.companyOf(token);
    if (!state || !company) return null;
    const view = viewFor(state, company);
    return { type: 'game', view, lastEvents: state.events, waitingFor: this.waitingFor() };
  }

  /**
   * Computer seats play their month as soon as it starts. They never end a
   * month on their own while a human is still in the game, and once every
   * human is bankrupt the game is left as it stands rather than played out.
   */
  private playComputers(): void {
    const humans = this.data.seats.filter((s) => s.token).map((s) => s.company);
    for (const seat of this.data.seats) {
      const state = this.data.state!;
      if (seat.token || state.over) continue;
      const humanLeft = state.players.some((p) => humans.includes(p.company) && !p.bankrupt);
      if (!humanLeft) return;
      this.data.state = playAiTurn(state, seat.company);
    }
  }
}
