import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, type ServerMessage } from '@oil/shared';
import { createGameServer } from './server.js';

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
  server = createGameServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function collect(socket: WebSocket, count: number): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerMessage[] = [];
    socket.on('error', reject);
    socket.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
      if (messages.length === count) resolve(messages);
    });
  });
}

describe('game server', () => {
  it('answers the health check', async () => {
    const res = await fetch(`http://${baseUrl}/health`);
    expect(await res.json()).toEqual({ ok: true, rooms: 0 });
  });

  it('greets a WebSocket client and answers pings', async () => {
    const socket = new WebSocket(`ws://${baseUrl}/ws`);
    const received = collect(socket, 3);
    await new Promise((resolve) => socket.on('open', resolve));
    socket.send(JSON.stringify({ type: 'ping', t: 123 }));
    socket.send('garbage');
    const [first, second, third] = await received;
    socket.close();

    expect(first).toMatchObject({ type: 'hello', protocol: PROTOCOL_VERSION });
    expect(second).toEqual({ type: 'pong', t: 123 });
    expect(third).toMatchObject({ type: 'error' });
  });
});

/** A test client that collects messages and can wait for a matching one. */
class TestClient {
  messages: ServerMessage[] = [];
  /** Messages before this index have been consumed by next(). */
  private cursor = 0;
  private waiter?: { resolve: () => void };
  readonly socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on('message', (data) => {
      this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      this.waiter?.resolve();
    });
  }

  send(msg: object): void {
    this.socket.send(JSON.stringify(msg));
  }

  /** Returns the next not yet consumed message of this type that matches, waiting if needed. */
  next<T extends ServerMessage['type']>(type: T, where: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true) {
    const find = () => {
      for (let i = this.cursor; i < this.messages.length; i++) {
        const m = this.messages[i];
        if (m.type === type && where(m as Extract<ServerMessage, { type: T }>)) {
          this.cursor = i + 1;
          return m as Extract<ServerMessage, { type: T }>;
        }
      }
      return null;
    };
    return new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
      const found = find();
      if (found) return resolve(found);
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 2000);
      this.waiter = {
        resolve: () => {
          const m = find();
          if (!m) return;
          clearTimeout(timer);
          this.waiter = undefined;
          resolve(m);
        },
      };
    });
  }

  close(): void {
    this.socket.close();
  }
}

describe('online games', () => {
  it('runs a lobby and a month with two players, and survives a restart', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'oil-'));
    const dbPath = path.join(dir, 'games.db');
    const game = createGameServer({ dbPath });
    await new Promise<void>((resolve) => game.listen(0, '127.0.0.1', resolve));
    const url = `ws://127.0.0.1:${(game.address() as AddressInfo).port}/ws`;

    const host = new TestClient(url);
    await host.next('hello');
    host.send({ type: 'createRoom', name: 'Jouni' });
    const { code, token: hostToken } = await host.next('joined');
    expect(code).toMatch(/^[A-Z]{4}$/);

    const guest = new TestClient(url);
    await guest.next('hello');
    guest.send({ type: 'joinRoom', code: code.toLowerCase(), name: 'Friend' });
    const { token: guestToken } = await guest.next('joined');
    const lobby = await host.next('room', (m) => m.room.seats[1].player === 'FRIEND');
    expect(lobby.room).toMatchObject({ code, host: true, you: 'Interoil', started: false });

    guest.send({ type: 'startGame' });
    expect((await guest.next('error')).message).toBe('Only the host can start the game');

    host.send({ type: 'setGoal', goal: 'money' });
    host.send({ type: 'startGame' });
    const first = await guest.next('game');
    expect(first.view.you.company).toBe('All American');
    expect(first.view.config.goal).toBe('money');
    expect(first.waitingFor).toEqual(['Interoil', 'All American']);

    host.send({ type: 'action', id: 1, action: { type: 'buyLicence', region: 'Europe' } });
    expect(await host.next('actionResult')).toEqual({ type: 'actionResult', id: 1, error: null });
    host.send({ type: 'action', id: 2, action: { type: 'endTurn' } });
    await guest.next('game', (m) => m.waitingFor.length === 1);
    guest.send({ type: 'action', id: 1, action: { type: 'endTurn' } });
    const month1 = await host.next('game', (m) => m.view.month === 1);
    expect(month1.view.you.licences).toEqual(['Europe']);

    host.close();
    guest.close();
    await new Promise((resolve) => game.close(resolve));

    // A fresh server on the same database brings the game back.
    const again = createGameServer({ dbPath });
    await new Promise<void>((resolve) => again.listen(0, '127.0.0.1', resolve));
    const url2 = `ws://127.0.0.1:${(again.address() as AddressInfo).port}/ws`;
    const back = new TestClient(url2);
    await back.next('hello');
    back.send({ type: 'joinRoom', code, name: 'Friend', token: guestToken });
    expect(await back.next('joined')).toEqual({ type: 'joined', code, token: guestToken });
    const resumed = await back.next('game');
    expect(resumed.view.month).toBe(1);
    expect(resumed.view.you.company).toBe('All American');
    expect(hostToken).not.toBe(guestToken);
    back.close();
    await new Promise((resolve) => again.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });

  it('refuses unknown room codes', async () => {
    const client = new TestClient(`ws://${baseUrl}/ws`);
    await client.next('hello');
    client.send({ type: 'joinRoom', code: 'ZZZZ', name: 'x' });
    expect((await client.next('error')).message).toBe('No game with that code');
    client.close();
  });
});
