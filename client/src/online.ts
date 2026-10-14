import type { Action, Company, PlayerView, RoomInfo, ServerMessage, VictoryGoal } from '@oil/shared';
import type { Connection } from './connection.js';
import type { GameSession } from './session.js';

const SAVED_KEY = 'oil-imperium-room';

export interface SavedRoom {
  code: string;
  token: string;
}

export function loadSavedRoom(): SavedRoom | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedRoom) : null;
  } catch {
    return null;
  }
}

function saveRoom(room: SavedRoom | null): void {
  try {
    if (room) localStorage.setItem(SAVED_KEY, JSON.stringify(room));
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    // Private mode or blocked storage: rejoining after a reload just won't work.
  }
}

/**
 * The online side of the client: joins rooms, keeps the lobby and the game
 * view up to date, and rejoins automatically after a reconnect.
 */
export class Online implements GameSession {
  readonly online = true;
  room: RoomInfo | null = null;
  view: PlayerView | null = null;
  waitingFor: Company[] = [];
  /** Last error from the server, for the lobby screens. */
  error: string | null = null;
  private joined: SavedRoom | null = null;
  private nextId = 1;
  private pending = new Map<number, (error: string | null) => void>();

  constructor(private readonly conn: Connection, private name: () => string) {}

  get company(): Company {
    return this.room?.you ?? 'Interoil';
  }

  get inRoom(): boolean {
    return this.room !== null;
  }

  handle(msg: ServerMessage): void {
    switch (msg.type) {
      case 'hello':
        // After a reconnect, slip back into the same seat.
        if (this.joined) this.conn.send({ type: 'joinRoom', ...this.joined, name: this.name() });
        break;
      case 'joined':
        this.joined = { code: msg.code, token: msg.token };
        saveRoom(this.joined);
        this.error = null;
        break;
      case 'room':
        this.room = msg.room;
        break;
      case 'game':
        this.view = msg.view;
        this.waitingFor = msg.waitingFor;
        break;
      case 'actionResult':
        this.pending.get(msg.id)?.(msg.error);
        this.pending.delete(msg.id);
        break;
      case 'error':
        this.error = msg.message;
        // A saved room that no longer exists is forgotten.
        if (!this.room && msg.message === 'No game with that code') saveRoom(null);
        break;
    }
  }

  create(): void {
    this.reset();
    this.conn.send({ type: 'createRoom', name: this.name() });
  }

  join(code: string, token?: string): void {
    // Rejoining a game you were already in (say, from the invite link after a reload) keeps your seat.
    const saved = loadSavedRoom();
    if (!token && saved?.code === code) token = saved.token;
    this.reset();
    this.conn.send({ type: 'joinRoom', code, name: this.name(), ...(token ? { token } : {}) });
  }

  leave(): void {
    this.conn.send({ type: 'leaveRoom' });
    saveRoom(null);
    this.reset();
  }

  takeSeat(company: Company): void {
    this.conn.send({ type: 'takeSeat', company });
  }

  setGoal(goal: VictoryGoal): void {
    this.conn.send({ type: 'setGoal', goal });
  }

  start(): void {
    this.conn.send({ type: 'startGame' });
  }

  perform(action: Action, done?: (error: string | null) => void): void {
    const id = this.nextId++;
    if (!this.conn.send({ type: 'action', action, id })) {
      done?.('Not connected to the server');
      return;
    }
    if (done) this.pending.set(id, done);
  }

  private reset(): void {
    this.joined = null;
    this.room = null;
    this.view = null;
    this.waitingFor = [];
    this.error = null;
    this.pending.clear();
  }
}
