import { REGIONS, RULES, SCREEN_WIDTH } from '@oil/shared';
import { act, type App } from '../app.js';
import { barrels, money } from '../format.js';
import { PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

/** The newspaper: oil price history and selling stored oil. */
export function drawMarket(ui: Ui, app: App): void {
  const { ctx } = ui;
  const { market, you: me } = app.game!.view!;

  ctx.fillStyle = PAL.white;
  ctx.fillRect(0, HUD_HEIGHT, SCREEN_WIDTH, FOOTER_Y - HUD_HEIGHT);
  ui.big('OIL NEWS', SCREEN_WIDTH / 2, HUD_HEIGHT + 3, PAL.black, 'center');
  ctx.fillStyle = PAL.black;
  ctx.fillRect(6, HUD_HEIGHT + 22, SCREEN_WIDTH - 12, 1);
  ui.text(`CRUDE OIL: $${market.price.toFixed(2)} PER BARREL`, 8, HUD_HEIGHT + 27, PAL.black);

  // Price chart for the last 24 months.
  const chart = { x: 8, y: HUD_HEIGHT + 42, w: SCREEN_WIDTH - 16, h: 70 };
  ctx.fillStyle = PAL.greyLight;
  ctx.fillRect(chart.x, chart.y, chart.w, chart.h);
  const history = market.history.slice(-24);
  const max = 40;
  const step = chart.w / 24;
  ctx.fillStyle = PAL.greyDark;
  for (const level of [10, 20, 30]) {
    const ly = chart.y + chart.h - (level / max) * chart.h;
    ctx.fillRect(chart.x, Math.round(ly), chart.w, 1);
    ui.text(`$${level}`, chart.x + chart.w - 2, Math.round(ly) + 2, PAL.greyDark, 'right');
  }
  history.forEach((price, i) => {
    const h = Math.min(chart.h, Math.round((price / max) * chart.h));
    ctx.fillStyle = i === history.length - 1 ? PAL.redDark : PAL.black;
    ctx.fillRect(chart.x + Math.round(i * step) + 1, chart.y + chart.h - h, Math.max(2, Math.floor(step) - 2), h);
  });

  // Selling.
  let y = chart.y + chart.h + 8;
  ui.text('YOUR STORED OIL', 8, y, PAL.black);
  y += 12;
  let any = false;
  for (const region of REGIONS) {
    const stored = me.stored[region] ?? 0;
    if (stored <= 0) continue;
    any = true;
    ui.text(`${region.toUpperCase()}: ${barrels(stored)} = ${money(stored * market.price)}`, 8, y + 2, PAL.black);
    ui.button(SCREEN_WIDTH - 60, y, 'SELL', () => {
      act(app, { type: 'sellOil', region, barrels: stored }, `Sold ${barrels(stored)} for ${money(stored * market.price)}`);
    }, { w: 40 });
    y += 14;
  }
  if (!any) ui.text('NONE. BUILD TANKS NEXT TO PRODUCING WELLS.', 8, y, PAL.greyDark);

  backButton(ui, app);
  drawHud(ui, app);
  drawFooter(ui, app, `Selling takes ${RULES.days.sellOil} day. Big sales push the price down`);
}
