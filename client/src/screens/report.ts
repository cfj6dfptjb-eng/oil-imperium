import { SCREEN_WIDTH, type GameEvent } from '@oil/shared';
import type { App } from '../app.js';
import { barrels, date, money } from '../format.js';
import { COMPANY_COLORS, PAL } from '../palette.js';
import { standings } from '../session.js';
import type { Ui } from '../ui.js';
import { drawDesert } from './title.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

/** Monthly report: what happened last month and how the companies rank. */
export function drawReport(ui: Ui, app: App): void {
  const { ctx } = ui;
  const view = app.game!.view!;
  ctx.fillStyle = PAL.blueDark;
  ctx.fillRect(0, HUD_HEIGHT, SCREEN_WIDTH, FOOTER_Y - HUD_HEIGHT);
  ui.big(`REPORT ${date(Math.max(0, view.month - 1))}`, SCREEN_WIDTH / 2, HUD_HEIGHT + 4, PAL.gold, 'center');

  let y = HUD_HEIGHT + 26;
  const news = view.events.map((e) => describe(e, view.you.company)).filter((n): n is [string, string] => !!n);
  if (news.length === 0) {
    ui.text(view.month === 0 ? 'YOUR FIRST MONTH IS STARTING.' : 'A QUIET MONTH.', 10, y, PAL.greyLight);
    y += 10;
  }
  for (const [text, color] of news.slice(0, 9)) {
    ui.text(text, 10, y, color);
    y += 10;
  }

  y = Math.max(y + 6, 130);
  ui.text('COMPANY', 10, y, PAL.gold);
  ui.text('WORTH', 180, y, PAL.gold, 'right');
  ui.text('WELLS', 240, y, PAL.gold, 'right');
  ui.text('SOLD', 310, y, PAL.gold, 'right');
  y += 12;
  for (const s of standings(view)) {
    const color = s.bankrupt ? PAL.grey : COMPANY_COLORS[s.company];
    ui.text(s.company.toUpperCase() + (s.you ? ' (YOU)' : ''), 10, y, color);
    ui.text(s.bankrupt ? 'BANKRUPT' : money(s.netWorth), 180, y, color, 'right');
    ui.text(String(s.producingWells), 240, y, color, 'right');
    ui.text(barrels(s.lastSold), 310, y, color, 'right');
    y += 11;
  }

  backButton(ui, app);
  drawHud(ui, app);
  drawFooter(ui, app, `Oil price now $${view.market.price.toFixed(2)}`);
}

function describe(event: GameEvent, me: string): [string, string] | null {
  const mine = 'company' in event && event.company === me;
  const who = 'company' in event ? (mine ? 'YOU' : event.company.toUpperCase()) : '';
  switch (event.type) {
    case 'strike':
      return [`${who} STRUCK OIL! ${mine ? barrels(event.reserves) : ''}`, mine ? PAL.green : PAL.greyLight];
    case 'dryHole':
      return mine ? ['YOUR WELL WAS A DRY HOLE.', PAL.red] : null;
    case 'depleted':
      return mine ? ['ONE OF YOUR WELLS RAN DRY.', PAL.red] : null;
    case 'overflow':
      return mine ? [`TANKS FULL IN ${event.region.toUpperCase()}: ${barrels(event.barrels)} LOST`, PAL.red] : null;
    case 'autoLoan':
      return mine ? [`THE BANK COVERED ${money(event.amount)} OF BILLS.`, PAL.gold] : null;
    case 'bankrupt':
      return [`${who} WENT BANKRUPT!`, PAL.red];
    case 'gameOver':
      return null;
  }
}

export function drawGameOver(ui: Ui, app: App): void {
  const game = app.game!;
  const view = game.view!;
  drawDesert(ui.ctx, app.frame);
  const won = view.winner === game.company;
  ui.big('GAME OVER', SCREEN_WIDTH / 2, 30, PAL.gold, 'center');
  const verdict = !view.over
    ? 'YOUR COMPANY HAS GONE BANKRUPT.'
    : view.winner
      ? won ? 'YOU HAVE BUILT AN OIL IMPERIUM!' : `${view.winner.toUpperCase()} WINS.`
      : 'NOBODY WINS.';
  ui.text(verdict, SCREEN_WIDTH / 2, 56, won ? PAL.green : PAL.white, 'center');
  ui.panel(50, 74, 220, 56);
  standings(view).forEach((s, i) => {
    ui.text(`${i + 1}. ${s.company.toUpperCase()}`, 60, 80 + i * 12, COMPANY_COLORS[s.company]);
    ui.text(s.bankrupt ? 'BANKRUPT' : money(s.netWorth), 260, 80 + i * 12, PAL.white, 'right');
  });
  ui.button(SCREEN_WIDTH / 2 - 45, 140, 'MAIN MENU', () => {
    if (game.online) app.online.leave();
    app.game = undefined;
    app.screen = 'menu';
  }, { w: 90 });
}
