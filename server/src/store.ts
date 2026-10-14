import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RoomData } from './room.js';

/** Rooms untouched for this long are deleted on startup. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Saves rooms to a single SQLite file so games survive restarts. */
export class RoomStore {
  private db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated INTEGER NOT NULL
    )`);
  }

  save(room: RoomData): void {
    this.db
      .prepare('INSERT INTO rooms (code, data, updated) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated = excluded.updated')
      .run(room.code, JSON.stringify(room), Date.now());
  }

  delete(code: string): void {
    this.db.prepare('DELETE FROM rooms WHERE code = ?').run(code);
  }

  loadAll(): RoomData[] {
    this.db.prepare('DELETE FROM rooms WHERE updated < ?').run(Date.now() - MAX_AGE_MS);
    const rows = this.db.prepare('SELECT data FROM rooms').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as RoomData);
  }

  close(): void {
    this.db.close();
  }
}
