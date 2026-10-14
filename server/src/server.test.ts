import type { AddressInfo } from 'node:net';
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
    expect(await res.json()).toEqual({ ok: true });
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
