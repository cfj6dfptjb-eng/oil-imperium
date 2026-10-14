import { createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { hello, parseClientMessage, type ServerMessage } from '@oil/shared';

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
}

export function createGameServer(options: GameServerOptions = {}): http.Server {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (!options.staticDir || !serveStatic(options.staticDir, url.pathname, res)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    send(socket, hello());
    socket.on('message', (data) => {
      const msg = parseClientMessage(data.toString());
      if (!msg) {
        send(socket, { type: 'error', message: 'Invalid message' });
        return;
      }
      switch (msg.type) {
        case 'ping':
          send(socket, { type: 'pong', t: msg.t });
          break;
      }
    });
  });
  server.on('close', () => wss.close());

  return server;
}

function send(socket: WebSocket, msg: ServerMessage): void {
  socket.send(JSON.stringify(msg));
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
