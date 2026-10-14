import { RULES, SABOTAGE_KINDS, type Company } from '@oil/shared';
import { act, type App } from '../app.js';
import { money } from '../format.js';
import { SABOTAGE_NAMES } from '../news.js';
import { COMPANY_COLORS, PAL } from '../palette.js';
import { drawBackdrop, paintAgent } from '../art/backdrops.js';
import { cached } from '../art/pix.js';
import type { Ui } from '../ui.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

const JOBS: Record<string, string> = {
  fire: 'SET A WELL ON FIRE',
  tanker: 'SINK A TANKER',
  books: 'COOK THE BOOKS',
};

/** The man in the trench coat: sabotage against rivals, and security for yourself. */
export function drawAgent(ui: Ui, app: App): void {
  const { ctx } = ui;
  const view = app.game!.view!;
  const me = view.you;
  drawBackdrop(ctx, 'alley');
  ctx.drawImage(cached('agent', 80, 140, (p) => paintAgent(p, 40, 134)), 222, 86);
  ui.panel(4, HUD_HEIGHT + 2, 214, FOOTER_Y - HUD_HEIGHT - 20, 'rgba(0, 0, 0, 0.7)');
  ui.big('THE AGENT', 8, HUD_HEIGHT + 4, PAL.red);
  ui.text('"NO NAMES. CASH ONLY."', 8, HUD_HEIGHT + 24, PAL.greyLight);

  let y = HUD_HEIGHT + 40;
  const target = app.target && view.rivals.some((r) => r.company === app.target && !r.bankrupt) ? app.target : undefined;
  ui.text('TARGET:', 8, y + 2, PAL.gold);
  let x = 56;
  for (const rival of view.rivals.filter((r) => !r.bankrupt)) {
    const label = rival.company.toUpperCase();
    const w = ui.button(x, y, label, () => (app.target = rival.company as Company));
    if (target === rival.company) {
      ctx.fillStyle = COMPANY_COLORS[rival.company];
      ctx.fillRect(x, y + 13, w, 2);
    }
    x += w + 4;
  }
  if (view.rivals.every((r) => r.bankrupt)) ui.text('NO RIVALS LEFT.', 56, y + 2, PAL.grey);
  y += 18;

  if (target) {
    const rival = view.rivals.find((r) => r.company === target)!;
    ui.text(`${rival.producingWells} PRODUCING WELLS, ${rival.tankers} TANKERS`, 8, y, COMPANY_COLORS[target]);
    y += 14;
    for (const kind of SABOTAGE_KINDS) {
      ui.button(8, y, `${JOBS[kind]}  ${money(RULES.sabotageCost[kind])}`, () =>
        act(app, { type: 'sabotage', target, kind }, `The agent nods. ${SABOTAGE_NAMES[kind].toLowerCase()} planned`), { w: 170 });
      y += 16;
    }
  } else {
    ui.text('PICK A COMPANY.', 8, y, PAL.grey);
    y += 14;
  }

  y += 4;
  if (me.plots.length) {
    ui.text('ORDERED THIS MONTH:', 8, y, PAL.gold);
    y += 10;
    for (const plot of me.plots) {
      ui.text(`${JOBS[plot.kind]}: ${plot.target.toUpperCase()}`, 16, y, PAL.white);
      y += 10;
    }
  }

  // Security, the other side of the trade.
  const sy = FOOTER_Y - 52;
  ctx.fillStyle = PAL.greyDark;
  ctx.fillRect(8, sy - 4, 206, 1);
  ui.text(me.security ? 'YOUR SECURITY: HIRED' : 'YOUR SECURITY: NONE', 8, sy, me.security ? PAL.green : PAL.red);
  ui.text(`GUARDS COST ${money(RULES.securityCostPerMonth)}/MONTH`, 8, sy + 10, PAL.greyLight);
  ui.button(8, sy + 22, me.security ? 'DISMISS GUARDS' : 'HIRE GUARDS', () =>
    act(app, { type: 'setSecurity', on: !me.security }, me.security ? 'Guards dismissed' : 'Guards hired'));

  backButton(ui, app);
  drawHud(ui, app);
  const odds = Math.round(RULES.sabotageCaughtChance * 100);
  drawFooter(ui, app, `Sabotage takes ${RULES.days.sabotage} days. Failed agents are traced ${odds}% of the time`);
}
