import { FIELD_GRID, REGION_DATA, RULES, SCREEN_WIDTH, shippingCapacity, shippingLeft, type Action, type Field } from '@oil/shared';
import { act, type App } from '../app.js';
import { barrels, money } from '../format.js';
import { COMPANY_COLORS, PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { drawDerrick } from './title.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

const TILE_W = 27;
const TILE_H = 36;
const GRID_X = 6;
const GRID_Y = 30;
const PANEL_X = 152;

export function drawRegion(ui: Ui, app: App): void {
  const { ctx } = ui;
  const game = app.game!;
  const region = app.region!;
  const data = REGION_DATA[region];
  const view = game.view!;
  const me = view.you;
  const licensed = me.licences.includes(region);
  const fields = view.fields.filter((f) => f.region === region);
  const surveys = new Map(me.surveys.map((s) => [s.fieldId, s.estimate]));

  ctx.fillStyle = PAL.blueDark;
  ctx.fillRect(0, HUD_HEIGHT, SCREEN_WIDTH, FOOTER_Y - HUD_HEIGHT);
  ui.text(region.toUpperCase(), 6, HUD_HEIGHT + 4, PAL.gold);

  // Field grid.
  for (const field of fields) {
    const x = GRID_X + field.col * (TILE_W + 1);
    const y = GRID_Y + field.row * (TILE_H + 1);
    drawTile(ctx, field, x, y, game.company, app.frame);
    if (surveys.has(field.id) && field.status === 'unexplored') {
      const est = surveys.get(field.id)!;
      ui.text(est ? `${Math.round(est / 100_000) / 10}M` : 'DRY', x + 2, y + TILE_H - 10, est ? PAL.white : PAL.red);
    }
    if (app.fieldId === field.id) {
      ctx.strokeStyle = PAL.white;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE_W - 1, TILE_H - 1);
    }
    ui.hotspot(x, y, TILE_W, TILE_H, () => (app.fieldId = field.id));
  }
  ui.text('BORDER COLOUR = OWNER', GRID_X, GRID_Y + FIELD_GRID.rows * (TILE_H + 1) + 4, PAL.grey);

  // Right panel: region and selected field.
  ui.panel(PANEL_X - 4, HUD_HEIGHT + 2, SCREEN_WIDTH - PANEL_X + 2, FOOTER_Y - HUD_HEIGHT - 20);
  let y = HUD_HEIGHT + 6;
  const line = (text: string, color: string = PAL.white) => {
    ui.text(text, PANEL_X, y, color);
    y += 10;
  };

  const run = (action: Action, ok: string) => act(app, action, ok);

  if (!licensed) {
    line('NO LICENCE HERE', PAL.red);
    line(`LICENCE: ${money(data.licenceCost)}`);
    line(`TAKES ${RULES.days.buyLicence} DAYS`);
    y += 2;
    ui.button(PANEL_X, y, 'BUY LICENCE', () => run({ type: 'buyLicence', region }, 'Licence bought'));
    y += 18;
  } else {
    const tanks = me.tanks[region] ?? 0;
    const stored = me.stored[region] ?? 0;
    const left = shippingLeft(me, region);
    const sell = Math.min(stored, left);
    if (view.strikes.includes(region)) line('WORKERS ON STRIKE!', PAL.red);
    line(`TANKS: ${tanks}  (${barrels(tanks * RULES.tankCapacity)})`);
    line(`STORED: ${barrels(stored)}`, stored > 0 ? PAL.green : PAL.white);
    ui.button(PANEL_X, y, `+TANK ${money(RULES.tankCost)}`, () => run({ type: 'buildTank', region }, 'Tank built'));
    if (sell > 0) {
      ui.button(PANEL_X + 86, y, 'SELL', () =>
        run({ type: 'sellOil', region, barrels: sell }, `Sold ${barrels(sell)} at $${view.market.price.toFixed(2)}`),
      );
    }
    y += 16;
    const tankers = me.tankers[region] ?? 0;
    line(`PIPELINE: ${me.pipelines.includes(region) ? 'YES' : 'NO'}  TANKERS: ${tankers}`);
    line(`SHIPS ${barrels(shippingCapacity(me, region))}/MO`, PAL.greyLight);
    line(`LEFT THIS MONTH ${barrels(left)}`, left > 0 ? PAL.greyLight : PAL.red);
    if (!me.pipelines.includes(region)) {
      ui.button(PANEL_X, y, `PIPE ${money(data.pipelineCost)}`, () => run({ type: 'buildPipeline', region }, 'Pipeline built'));
    }
    ui.button(PANEL_X + 80, y, `TANKER ${money(RULES.tankerCost)}`, () => run({ type: 'buyTanker', region }, 'Tanker bought'));
    y += 18;
  }

  const field = fields.find((f) => f.id === app.fieldId);
  ctx.fillStyle = PAL.grey;
  ctx.fillRect(PANEL_X, y, SCREEN_WIDTH - PANEL_X - 6, 1);
  y += 4;
  if (!field) {
    line('CLICK A FIELD', PAL.grey);
  } else {
    line(`FIELD ${field.col + 1}-${field.row + 1}`, PAL.gold);
    line(field.owner ? `OWNER: ${field.owner.toUpperCase()}` : `PRICE: ${money(field.price)}`,
      field.owner ? COMPANY_COLORS[field.owner] : PAL.white);
    line(`STATUS: ${field.status.toUpperCase()}`);
    if (field.owner === game.company && field.status === 'drilling') {
      line(`DRILLED ${field.drilled} M`);
    }
    if (field.owner === game.company && (field.status === 'producing' || field.status === 'burning')) {
      line(`RESERVES ${barrels(field.reserves)}`, PAL.green);
    }
    if (field.owner === game.company && field.status === 'burning') {
      ui.button(PANEL_X, y, `FIGHT FIRE ${money(RULES.extinguishCost)}`, () =>
        run({ type: 'extinguishFire', fieldId: field.id }, 'The fire fighters blew out the fire'),
      );
      y += 14;
    }
    const est = surveys.get(field.id);
    if (est !== undefined && field.status === 'unexplored') line(est ? `SURVEY: ~${barrels(est)}` : 'SURVEY: DRY HOLE', est ? PAL.green : PAL.red);
    y += 2;

    if (licensed && field.status === 'unexplored') {
      if (!field.owner) {
        ui.button(PANEL_X, y, `SURVEY ${money(RULES.surveyCost)}`, () => run({ type: 'survey', fieldId: field.id }, 'Survey report filed'));
        y += 14;
        ui.button(PANEL_X, y, 'BUY FIELD', () => run({ type: 'buyField', fieldId: field.id }, 'Field bought'));
        y += 14;
      } else if (field.owner === game.company) {
        ui.button(PANEL_X, y, `DRILL ${money(data.drillCostPerMonth)}/MO`, () =>
          run({ type: 'startDrilling', fieldId: field.id }, 'Drilling started'),
        );
        y += 14;
      }
    }
  }

  backButton(ui, app, 'world');
  drawHud(ui, app);
  drawFooter(ui, app, `Oil price $${view.market.price.toFixed(2)} per barrel`);
}

function drawTile(ctx: CanvasRenderingContext2D, field: Field, x: number, y: number, me: string, frame: number): void {
  ctx.fillStyle = field.status === 'dry' || field.status === 'depleted' ? PAL.sandDark : PAL.sand;
  ctx.fillRect(x, y, TILE_W, TILE_H);
  if (field.owner) {
    ctx.fillStyle = COMPANY_COLORS[field.owner];
    ctx.fillRect(x, y, TILE_W, 2);
    ctx.fillRect(x, y + TILE_H - 2, TILE_W, 2);
    ctx.fillRect(x, y, 2, TILE_H);
    ctx.fillRect(x + TILE_W - 2, y, 2, TILE_H);
  }
  const cx = x + TILE_W / 2;
  switch (field.status) {
    case 'drilling':
      drawDerrick(ctx, cx, y + TILE_H - 4, 14, frame, false);
      break;
    case 'producing':
      drawDerrick(ctx, cx, y + TILE_H - 4, 14, frame, field.owner === me);
      break;
    case 'burning':
      drawDerrick(ctx, cx, y + TILE_H - 4, 14, frame, false);
      drawFire(ctx, cx, y + TILE_H - 18, frame);
      break;
    case 'dry':
      ctx.fillStyle = PAL.greyDark;
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(cx - 5 + i, y + 10 + i, 2, 1);
        ctx.fillRect(cx + 5 - i, y + 10 + i, 2, 1);
      }
      break;
    case 'depleted':
      ctx.fillStyle = PAL.black;
      ctx.fillRect(cx - 3, y + TILE_H - 8, 6, 4);
      break;
  }
}

/** Flickering flames over a burning well. */
function drawFire(ctx: CanvasRenderingContext2D, cx: number, base: number, frame: number): void {
  const colors = [PAL.red, PAL.gold, PAL.white];
  for (let i = 0; i < 7; i++) {
    const h = 6 + ((i * 7 + Math.floor(frame / 6)) % 5) * 2;
    ctx.fillStyle = colors[(i + Math.floor(frame / 8)) % 2];
    ctx.fillRect(cx - 7 + i * 2, base - h, 2, h);
  }
  ctx.fillStyle = colors[2];
  ctx.fillRect(cx - 1, base - 4, 2, 4);
}
