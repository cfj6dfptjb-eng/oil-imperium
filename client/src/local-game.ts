import {
  applyAction,
  CLASSIC_MAP_SEED,
  COMPANIES,
  createGame,
  playAiTurn,
  type Action,
  type Company,
  type GameEvent,
  type GameState,
  type VictoryGoal,
} from '@oil/shared';

/**
 * A single-player game running entirely in the browser: one human company and
 * computer opponents for the other seats. Computer companies take their turn
 * at the start of each month, then wait for the human to end the month.
 */
export class LocalGame {
  state: GameState;
  /** Events from the month that just ended, for the monthly report. */
  lastEvents: GameEvent[] = [];

  constructor(
    readonly human: Company,
    goal: VictoryGoal,
    seed = Math.floor(Math.random() * 2 ** 31),
  ) {
    this.state = createGame({ goal, companies: [...COMPANIES], seed, mapSeed: CLASSIC_MAP_SEED });
    this.playComputers();
  }

  get me() {
    return this.state.players.find((p) => p.company === this.human)!;
  }

  /** Runs an action for the human player. Returns an error message, or null on success. */
  perform(action: Action): string | null {
    const result = applyAction(this.state, this.human, action);
    if (!result.ok) return result.error;
    this.state = result.state;
    return null;
  }

  /** Ends the human's month, resolves it and lets the computers play the next one. */
  endMonth(): void {
    const month = this.state.month;
    this.perform({ type: 'endTurn' });
    if (this.state.month !== month) this.lastEvents = this.state.events;
    this.playComputers();
    // If the human is out of the game, keep playing months until it ends.
    while (this.me.bankrupt && !this.state.over) {
      this.playComputers();
    }
  }

  private playComputers(): void {
    for (const p of this.state.players) {
      if (p.company !== this.human && !this.state.over) this.state = playAiTurn(this.state, p.company);
    }
  }
}
