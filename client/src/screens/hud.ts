import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import type { App } from '../app.js';
import { date, money } from '../format.js';
import { COMPANY_COLORS, PAL } from '../palette.js';
import type { Ui } from '../ui.js';

export const HUD_HEIGHT = 12;
export const FOOTER_Y = SCREEN_HEIGHT - 12;

/** Top status bar: company, date, cash and days left. */
export function drawHud(ui: Ui, app: App): void {
  const game = app.game!;
  const me = game.me;
  const { ctx } = ui;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(0, 0, SCREEN_WIDTH, HUD_HEIGHT);
  ui.text(me.company.toUpperCase(), 3, 2, COMPANY_COLORS[me.company]);
  ui.text(date(game.state.month), 110, 2, PAL.white);
  ui.text(money(me.cash), 222, 2, me.cash < 200_000 ? PAL.red : PAL.green, 'right');
  ui.text(`${me.daysLeft}D`, SCREEN_WIDTH - 3, 2, me.daysLeft < 5 ? PAL.red : PAL.white, 'right');
}

/** Bottom line: the latest message, or a hint. */
export function drawFooter(ui: Ui, app: App, hint = ''): void {
  const { ctx } = ui;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(0, FOOTER_Y, SCREEN_WIDTH, SCREEN_HEIGHT - FOOTER_Y);
  const msg = app.message && app.message.until > app.frame ? app.message : null;
  if (msg) ui.text(msg.text.toUpperCase(), 3, FOOTER_Y + 2, msg.error ? PAL.red : PAL.gold);
  else if (hint) ui.text(hint.toUpperCase(), 3, FOOTER_Y + 2, PAL.grey);
}

/** Small "BACK" button used on every sub-screen, returning to the office. */
export function backButton(ui: Ui, app: App, to: App['screen'] = 'office'): void {
  ui.button(SCREEN_WIDTH - 44, FOOTER_Y - 14, 'BACK', () => {
    app.screen = to;
  }, { w: 40 });
}
