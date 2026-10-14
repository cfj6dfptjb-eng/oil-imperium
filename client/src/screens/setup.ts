import { COMPANIES, SCREEN_WIDTH, type VictoryGoal } from '@oil/shared';
import { say, type App } from '../app.js';
import { LocalGame } from '../local-game.js';
import { COMPANY_COLORS, PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { menuBackground } from './menu.js';

const GOALS: { goal: VictoryGoal; label: string; help: string }[] = [
  { goal: 'timeLimit', label: '3 YEARS', help: 'Richest company after 3 years wins' },
  { goal: 'survival', label: 'SURVIVAL', help: 'Last company not bankrupt wins' },
  { goal: 'marketShare', label: '80% MARKET', help: 'First to sell 80% of all oil wins' },
  { goal: 'money', label: '$60 MILLION', help: 'First to $60M wins (slower drilling)' },
];

export function drawSetup(ui: Ui, app: App): void {
  menuBackground(ui, app.frame, 'NEW GAME');

  ui.text('CHOOSE YOUR COMPANY', 20, 40, PAL.white);
  COMPANIES.forEach((company, i) => {
    const selected = app.setup.company === company;
    ui.button(20 + (i % 2) * 145, 54 + Math.floor(i / 2) * 16, (selected ? '> ' : '') + company.toUpperCase(), () => {
      app.setup.company = company;
    }, { w: 135, color: selected ? COMPANY_COLORS[company] === PAL.gold ? PAL.goldDark : COMPANY_COLORS[company] : PAL.black });
  });

  ui.text('CHOOSE THE GOAL', 20, 100, PAL.white);
  GOALS.forEach(({ goal, label }, i) => {
    const selected = app.setup.goal === goal;
    ui.button(20 + (i % 2) * 145, 114 + Math.floor(i / 2) * 16, (selected ? '> ' : '') + label, () => {
      app.setup.goal = goal;
    }, { w: 135, color: selected ? PAL.redDark : PAL.black });
  });
  const help = GOALS.find((g) => g.goal === app.setup.goal)!.help;
  ui.text(help.toUpperCase(), SCREEN_WIDTH / 2, 152, PAL.greyLight, 'center');

  ui.text('THE OTHER COMPANIES ARE PLAYED', SCREEN_WIDTH / 2, 176, PAL.grey, 'center');
  ui.text('BY THE COMPUTER', SCREEN_WIDTH / 2, 186, PAL.grey, 'center');

  ui.button(SCREEN_WIDTH / 2 - 105, 210, 'BACK', () => (app.screen = 'menu'), { w: 100 });
  ui.button(SCREEN_WIDTH / 2 + 5, 210, 'START GAME', () => {
    app.game = new LocalGame(app.setup.company, app.setup.goal);
    app.seenMonth = 0;
    app.screen = 'office';
    say(app, 'Click the world map on the wall to explore');
  }, { w: 100 });
}
