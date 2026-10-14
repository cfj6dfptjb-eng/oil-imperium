import { REGIONS, RULES, SCREEN_WIDTH, shippingLeft } from '@oil/shared';
import { act, type App } from '../app.js';
import { barrels, money } from '../format.js';
import { headline } from '../news.js';
import { PAL } from '../palette.js';
import { drawBackdrop } from '../art/backdrops.js';
import type { Ui } from '../ui.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

/** The newspaper: world news, oil price history and selling stored oil. */
export function drawMarket(ui: Ui, app: App): void {
  const { ctx } = ui;
  const { market, you: me, events } = app.game!.view!;

  drawBackdrop(ctx, 'newsprint');
  ctx.fillStyle = PAL.black;
  ctx.fillRect(6, HUD_HEIGHT + 3, SCREEN_WIDTH - 12, 2);
  ui.text('THE DAILY BARREL', SCREEN_WIDTH / 2, HUD_HEIGHT + 4, PAL.black, 'center', { scale: 2, shadow: null });
  ctx.fillRect(6, HUD_HEIGHT + 20, SCREEN_WIDTH - 12, 1);
  ctx.fillRect(6, HUD_HEIGHT + 22, SCREEN_WIDTH - 12, 1);

  let y = HUD_HEIGHT + 26;
  const headlines = events.map(headline).filter((h): h is string => !!h);
  if (headlines.length === 0) headlines.push('MARKETS QUIET THIS MONTH');
  for (const text of headlines.slice(0, 3)) {
    ui.text(text, 8, y, PAL.redDark);
    y += 10;
  }
  ui.text(`CRUDE OIL: $${market.price.toFixed(2)} PER BARREL`, 8, y + 2, PAL.black);

  // Price chart for the last 24 months.
  const chart = { x: 8, y: y + 14, w: SCREEN_WIDTH - 16, h: 50 };
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

  // Selling, as much as shipping allows this month.
  y = chart.y + chart.h + 6;
  ui.text('YOUR STORED OIL', 8, y, PAL.black);
  ui.text('CAN SHIP', 250, y, PAL.black, 'right');
  y += 12;
  let any = false;
  for (const region of REGIONS) {
    const stored = me.stored[region] ?? 0;
    if (stored <= 0) continue;
    any = true;
    const left = shippingLeft(me, region);
    const sell = Math.min(stored, left);
    ui.text(`${region.toUpperCase()}: ${barrels(stored)}`, 8, y + 2, PAL.black);
    ui.text(barrels(left), 250, y + 2, left > 0 ? PAL.black : PAL.red, 'right');
    ui.button(SCREEN_WIDTH - 60, y, 'SELL', () => {
      act(app, { type: 'sellOil', region, barrels: sell }, `Sold ${barrels(sell)} for ${money(sell * market.price)}`);
    }, { w: 40, disabled: sell <= 0 });
    y += 14;
    if (y > FOOTER_Y - 30) break;
  }
  if (!any) ui.text('NONE. BUILD TANKS NEXT TO PRODUCING WELLS.', 8, y, PAL.greyDark);

  backButton(ui, app);
  drawHud(ui, app);
  drawFooter(ui, app, `Selling takes ${RULES.days.sellOil} day. Big sales push the price down`);
}
