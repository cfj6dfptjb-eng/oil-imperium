import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const staticDir = process.env.STATIC_DIR ?? path.resolve(here, '../../client/dist');

const server = createGameServer({ staticDir });
server.listen(port, host, () => {
  console.log(`Oil Imperium server listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
