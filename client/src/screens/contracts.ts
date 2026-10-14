import { RULES, SCREEN_WIDTH, type Contract } from '@oil/shared';
import { act, type App } from '../app.js';
import { barrels } from '../format.js';
import { PAL } from '../palette.js';
import { drawBackdrop } from '../art/backdrops.js';
import type { Ui } from '../ui.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

/** The telephone: buyers offering supply contracts, and the ones you have signed. */
export function drawContracts(ui: Ui, app: App): void {
  const { ctx } = ui;
  const view = app.game!.view!;
  const me = view.you;
  drawBackdrop(ctx, 'desk');
  ui.panel(4, HUD_HEIGHT + 22, SCREEN_WIDTH - 8, FOOTER_Y - HUD_HEIGHT - 42);
  ui.big('SUPPLY CONTRACTS', SCREEN_WIDTH / 2, HUD_HEIGHT + 4, PAL.gold, 'center');

  let y = HUD_HEIGHT + 26;
  ui.text('ON THE PHONE THIS MONTH', 8, y, PAL.gold);
  y += 12;
  if (view.contractOffers.length === 0) {
    ui.text('NO MORE OFFERS UNTIL NEXT MONTH.', 8, y, PAL.grey);
    y += 12;
  }
  for (const offer of view.contractOffers) {
    contractLines(ui, offer, y, view.market.price);
    ui.button(SCREEN_WIDTH - 56, y + 4, 'SIGN', () => act(app, { type: 'acceptContract', contractId: offer.id }, `Contract with ${offer.buyer} signed`), {
      w: 48,
      disabled: me.contracts.length >= RULES.maxContracts,
    });
    y += 26;
  }

  y += 4;
  ui.text(`YOUR CONTRACTS (${me.contracts.length}/${RULES.maxContracts})`, 8, y, PAL.gold);
  y += 12;
  if (me.contracts.length === 0) ui.text('NONE SIGNED.', 8, y, PAL.grey);
  for (const contract of me.contracts) {
    contractLines(ui, contract, y, view.market.price);
    y += 26;
  }

  ui.text('OIL IS DELIVERED FROM STORAGE AT MONTH END,', 8, FOOTER_Y - 34, PAL.greyLight);
  ui.text('USING SHIPPING LEFT OVER AFTER YOUR SALES.', 8, FOOTER_Y - 24, PAL.greyLight);
  backButton(ui, app);
  drawHud(ui, app);
  drawFooter(ui, app, `Signing takes ${RULES.days.acceptContract} days. Missed barrels cost a penalty`);
}

function contractLines(ui: Ui, c: Contract, y: number, marketPrice: number): void {
  ui.text(`${c.buyer.toUpperCase()}: ${barrels(c.barrelsPerMonth)}/MONTH`, 8, y, PAL.white);
  ui.text(
    `$${c.price.toFixed(2)}/BBL FOR ${c.monthsLeft} MO, PENALTY $${c.penaltyPerBarrel.toFixed(2)}`,
    8,
    y + 10,
    c.price >= marketPrice ? PAL.green : PAL.greyLight,
  );
}
