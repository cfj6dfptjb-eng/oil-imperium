import type { Company, Region, VictoryGoal } from '@oil/shared';
import type { Connection } from './connection.js';
import type { LocalGame } from './local-game.js';

export type Screen = 'title' | 'setup' | 'office' | 'world' | 'region' | 'market' | 'bank' | 'report' | 'gameover';

export interface App {
  screen: Screen;
  conn: Connection;
  frame: number;
  game?: LocalGame;
  setup: { company: Company; goal: VictoryGoal };
  region?: Region;
  fieldId?: string;
  /** Short feedback line shown at the bottom of the screen. */
  message?: { text: string; error: boolean; until: number };
}

export function say(app: App, text: string, error = false): void {
  app.message = { text, error, until: app.frame + 180 };
}
