import type { Action, Company, Region, VictoryGoal } from '@oil/shared';
import type { Connection } from './connection.js';
import type { Online } from './online.js';
import type { GameSession } from './session.js';

export type Screen =
  | 'title'
  | 'menu'
  | 'join'
  | 'lobby'
  | 'setup'
  | 'office'
  | 'world'
  | 'region'
  | 'market'
  | 'bank'
  | 'report'
  | 'gameover';

export interface App {
  screen: Screen;
  conn: Connection;
  online: Online;
  frame: number;
  /** The game being played, local or online. */
  game?: GameSession;
  /** Month of the game last shown, to spot when a new month starts. */
  seenMonth: number;
  setup: { company: Company; goal: VictoryGoal };
  playerName: string;
  /** Room code being typed on the join screen. */
  joinCode: string;
  region?: Region;
  fieldId?: string;
  /** Short feedback line shown at the bottom of the screen. */
  message?: { text: string; error: boolean; until: number };
}

export function say(app: App, text: string, error = false): void {
  app.message = { text, error, until: app.frame + 180 };
}

/** Runs an action for the player and reports the outcome on the message line. */
export function act(app: App, action: Action, ok: string): void {
  app.game?.perform(action, (error) => say(app, error ?? ok, !!error));
}
