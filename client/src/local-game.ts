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
  type PlayerView,
  type VictoryGoal,
} from '@oil/shared';
import type { GameSession } from './session.js';

/**
 * A single-player game running entirely in the browser: one human company and
 * computer opponents for the other seats. Computer companies take their turn
 * at the start of each month, then wait for the human to end the month.
 */
export class LocalGame implements GameSession {
  readonly online = false;
  readonly waitingFor: Company[] = [];
  state: GameState;
  private cachedView?: { state: GameState; view: PlayerView };

  constructor(
    readonly company: Company,
    goal: VictoryGoal,
    seed = Math.floor(Math.random() * 2 ** 31),
  ) {
    this.state = createGame({ goal, companies: [...COMPANIES], seed, mapSeed: CLASSIC_MAP_SEED });
    this.playComputers();
  }

  get view(): PlayerView {
    if (this.cachedView?.state !== this.state) {
      this.cachedView = { state: this.state, view: viewFor(this.state, this.company) };
    }
    return this.cachedView.view;
  }

  get me() {
    return this.state.players.find((p) => p.company === this.company)!;
  }

  /** True once the game is over or the human's company has gone bankrupt. */
  get finished(): boolean {
    return this.state.over || this.me.bankrupt;
  }

  perform(action: Action, done?: (error: string | null) => void): void {
    const month = this.state.month;
    const result = applyAction(this.state, this.company, action);
    if (result.ok) {
      this.state = result.state;
      // A new month has started: the computers play it straight away.
      if (this.state.month !== month && !this.finished) this.playComputers();
    }
    done?.(result.ok ? null : result.error);
  }

  /** Ends the human's month, resolves it and lets the computers play the next one. */
  endMonth(): void {
    this.perform({ type: 'endTurn' });
  }

  private playComputers(): void {
    for (const p of this.state.players) {
      if (p.company !== this.company && !this.state.over) this.state = playAiTurn(this.state, p.company);
    }
  }
}
