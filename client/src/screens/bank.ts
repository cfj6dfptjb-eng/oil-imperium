import { RULES, SCREEN_WIDTH } from '@oil/shared';
import { act, type App } from '../app.js';
import { money } from '../format.js';
import { PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

export function drawBank(ui: Ui, app: App): void {
  const { ctx } = ui;
  const me = app.game!.view!.you;
  ctx.fillStyle = PAL.greenDark;
  ctx.fillRect(0, HUD_HEIGHT, SCREEN_WIDTH, FOOTER_Y - HUD_HEIGHT);
  ui.big('THE BANK', SCREEN_WIDTH / 2, HUD_HEIGHT + 6, PAL.gold, 'center');

  const rows: [string, string][] = [
    ['CASH', money(me.cash)],
    ['DEBT', money(me.debt)],
    ['CREDIT LEFT', money(RULES.maxDebt - me.debt)],
    ['INTEREST', `${(RULES.loanInterestPerMonth * 100).toFixed(0)}% PER MONTH = ${money(me.debt * RULES.loanInterestPerMonth)}`],
  ];
  rows.forEach(([label, value], i) => {
    ui.text(label, 30, 50 + i * 14, PAL.white);
    ui.text(value, 120, 50 + i * 14, PAL.gold);
  });

  ui.button(30, 120, 'BORROW $500K', () => act(app, { type: 'takeLoan', amount: 500_000 }, 'Loan granted'), { w: 120 });
  ui.button(170, 120, 'BORROW $1M', () => act(app, { type: 'takeLoan', amount: 1_000_000 }, 'Loan granted'), { w: 120 });
  ui.button(30, 138, 'REPAY $500K', () => act(app, { type: 'repayLoan', amount: 500_000 }, 'Loan repaid'), { w: 120, disabled: me.debt === 0 });
  ui.button(170, 138, 'REPAY ALL', () => act(app, { type: 'repayLoan', amount: me.debt }, 'Loan repaid'), { w: 120, disabled: me.debt === 0 });

  ui.text('IF YOU CANNOT PAY YOUR BILLS THE BANK', 30, 170, PAL.greyLight);
  ui.text('LENDS YOU THE REST. NO CREDIT LEFT', 30, 180, PAL.greyLight);
  ui.text('MEANS BANKRUPTCY.', 30, 190, PAL.greyLight);

  backButton(ui, app);
  drawHud(ui, app);
  drawFooter(ui, app, 'Loans take 1 day');
}
