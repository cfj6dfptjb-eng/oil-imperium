import { createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { cleanName, hello, parseClientMessage, type ClientMessage, type ServerMessage } from '@oil/shared';
import { Room } from './room.js';
import { RoomStore } from './store.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
};

export interface GameServerOptions {
  /** Built client files to serve. Optional so the server can run headless in tests. */
  staticDir?: string;
  /** SQLite file for saved games. Defaults to an in-memory database. */
  dbPath?: string;
}

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_ROOMS = 200;

interface Client {
  socket: WebSocket;
  room?: Room;
  token?: string;
}

export function createGameServer(options: GameServerOptions = {}): http.Server {
  const store = new RoomStore(options.dbPath ?? ':memory:');
  const rooms = new Map<string, Room>();
  for (const data of store.loadAll()) rooms.set(data.code, new Room(data));
  const clients = new Set<Client>();
  let closed = false;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (!options.staticDir || !serveStatic(options.staticDir, url.pathname, res)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });

  const connected = (room: Room) => (token: string) =>
    [...clients].some((c) => c.room === room && c.token === token);

  /** Sends every member of a room their own view of it. */
  function broadcast(room: Room): void {
    if (closed) return;
    store.save(room.data);
    for (const c of clients) {
      if (c.room !== room || !c.token) continue;
      send(c.socket, { type: 'room', room: room.info(c.token, connected(room)) });
      const game = room.gameMessage(c.token);
      if (game) send(c.socket, game);
    }
  }

  function enter(client: Client, room: Room, token: string): void {
    const previous = client.room;
    client.room = room;
    client.token = token;
    send(client.socket, { type: 'joined', code: room.code, token });
    broadcast(room);
    if (previous && previous !== room) broadcast(previous);
  }

  function newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  function handle(client: Client, msg: ClientMessage): void {
    const fail = (message: string) => send(client.socket, { type: 'error', message });
    switch (msg.type) {
      case 'ping':
        send(client.socket, { type: 'pong', t: msg.t });
        return;

      case 'createRoom': {
        if (rooms.size >= MAX_ROOMS) return fail('The server is full, try again later');
        const { room, token } = Room.create(newCode(), cleanName(msg.name));
        rooms.set(room.code, room);
        enter(client, room, token);
        return;
      }

      case 'joinRoom': {
        const room = rooms.get(msg.code.toUpperCase().trim());
        if (!room) return fail('No game with that code');
        const result = room.join(cleanName(msg.name), msg.token);
        if ('error' in result) return fail(result.error);
        enter(client, room, result.token);
        return;
      }

      case 'leaveRoom': {
        const { room, token } = client;
        if (!room || !token) return;
        room.leave(token);
        client.room = client.token = undefined;
        if (room.data.members.length === 0) {
          rooms.delete(room.code);
          store.delete(room.code);
        } else {
          broadcast(room);
        }
        return;
      }

      default: {
        const { room, token } = client;
        if (!room || !token) return fail('Join a game first');
        let error: string | null;
        if (msg.type === 'takeSeat') error = room.takeSeat(token, msg.company);
        else if (msg.type === 'setGoal') error = room.setGoal(token, msg.goal);
        else if (msg.type === 'startGame') error = room.start(token);
        else {
          error = room.act(token, msg.action);
          send(client.socket, { type: 'actionResult', id: msg.id, error });
          if (!error) broadcast(room);
          return;
        }
        if (error) fail(error);
        else broadcast(room);
      }
    }
  }

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  wss.on('connection', (socket) => {
    const client: Client = { socket };
    clients.add(client);
    send(socket, hello());
    socket.on('message', (data) => {
      const msg = parseClientMessage(data.toString());
      if (!msg) {
        send(socket, { type: 'error', message: 'Invalid message' });
        return;
      }
      try {
        handle(client, msg);
      } catch (err) {
        console.error('Error handling message', err);
        send(socket, { type: 'error', message: 'Server error' });
      }
    });
    socket.on('close', () => {
      clients.delete(client);
      if (client.room) broadcast(client.room);
    });
  });
  server.on('close', () => {
    closed = true;
    for (const c of clients) c.socket.terminate();
    wss.close();
    store.close();
  });

  return server;
}

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
}

/** Serves a file from root, falling back to index.html. Returns false if nothing matched. */
function serveStatic(root: string, pathname: string, res: http.ServerResponse): boolean {
  const resolvedRoot = path.resolve(root);
  let filePath = path.resolve(resolvedRoot, '.' + decodeURIComponent(pathname));
  if (filePath !== resolvedRoot && !filePath.startsWith(resolvedRoot + path.sep)) return false;
  if (!isFile(filePath)) filePath = path.join(resolvedRoot, 'index.html');
  if (!isFile(filePath)) return false;
  res.writeHead(200, {
    'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(res);
  return true;
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
