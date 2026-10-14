import { FIELD_GRID, REGION_DATA, type Region, RULES, SCREEN_WIDTH, shippingCapacity, shippingLeft, type Action, type Field } from '@oil/shared';
import { act, type App } from '../app.js';
import { barrels, money } from '../format.js';
import { COMPANY_COLORS, PAL } from '../palette.js';
import { drawBackdrop } from '../art/backdrops.js';
import { amiga, cached, hash, type Pix } from '../art/pix.js';
import { derrick, flames, pumpjack, STEEL } from '../art/props.js';
import type { Ui } from '../ui.js';
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

  drawBackdrop(ctx, 'desk');
  ui.text(region.toUpperCase(), 6, HUD_HEIGHT + 4, PAL.goldLight);
  ctx.drawImage(cached(`terrain:${region}`, GRID_W, GRID_H, (p) => paintTerrain(p, region)), GRID_X - 2, GRID_Y - 2);

  // Field grid.
  for (const field of fields) {
    const x = GRID_X + field.col * (TILE_W + 1);
    const y = GRID_Y + field.row * (TILE_H + 1);
    drawTile(ctx, field, x, y, app.frame, region);
    if (surveys.has(field.id) && field.status === 'unexplored') {
      const est = surveys.get(field.id)!;
      ui.text(est ? `${Math.round(est / 100_000) / 10}M` : 'DRY', x + 2, y + TILE_H - 10, est ? PAL.white : PAL.red);
    }
    if (app.fieldId === field.id && Math.floor(app.frame / 10) % 3 !== 0) {
      ctx.strokeStyle = PAL.white;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, TILE_W + 1, TILE_H + 1);
    }
    ui.hotspot(x, y, TILE_W, TILE_H, () => (app.fieldId = field.id));
  }
  ui.text('FLAG COLOUR = OWNER', GRID_X, GRID_Y + FIELD_GRID.rows * (TILE_H + 1) + 4, PAL.grey);

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

const GRID_W = FIELD_GRID.cols * (TILE_W + 1) + 3;
const GRID_H = FIELD_GRID.rows * (TILE_H + 1) + 3;

interface Terrain {
  base: string;
  light: string;
  dark: string;
  /** Paints a small feature (tree, rock, wave) at a spot on the tile. */
  feature?: (p: Pix, x: number, y: number) => void;
  density: number;
}

const tree = (leaf: string, shade: string) => (p: Pix, x: number, y: number) => {
  p.vline(x, y + 3, 2, amiga(0x421));
  p.hline(x - 1, y + 2, 3, leaf);
  p.hline(x - 2, y + 1, 4, shade);
  p.px(x, y, leaf);
};
const palm = (p: Pix, x: number, y: number) => {
  p.vline(x, y + 1, 4, amiga(0x642));
  p.hline(x - 2, y, 5, amiga(0x3a3));
  p.px(x - 3, y + 1, amiga(0x282));
  p.px(x + 3, y + 1, amiga(0x282));
};
const rock = (c: string, shade: string) => (p: Pix, x: number, y: number) => {
  p.hline(x, y, 3, c);
  p.hline(x - 1, y + 1, 4, shade);
};
const wave = (p: Pix, x: number, y: number) => {
  p.hline(x, y, 3, amiga(0x8bd));
  p.px(x + 3, y + 1, amiga(0x8bd));
};

/** Each region looks like its landscape: snow, prairie, jungle, sea, tundra or desert. */
const TERRAIN: Record<Region, Terrain> = {
  Alaska: { base: amiga(0xdde), light: amiga(0xfff), dark: amiga(0xabc), feature: tree(amiga(0x264), amiga(0x153)), density: 0.0025 },
  'North America': { base: amiga(0xa94), light: amiga(0xba5), dark: amiga(0x873), feature: rock(amiga(0x986), amiga(0x653)), density: 0.004 },
  'Central America': { base: amiga(0x5a3), light: amiga(0x6b4), dark: amiga(0x382), feature: palm, density: 0.003 },
  'South America': { base: amiga(0x392), light: amiga(0x4a3), dark: amiga(0x271), feature: tree(amiga(0x5b3), amiga(0x260)), density: 0.005 },
  Europe: { base: amiga(0x358), light: amiga(0x469), dark: amiga(0x247), feature: wave, density: 0.01 },
  USSR: { base: amiga(0x9a8), light: amiga(0xbcb), dark: amiga(0x786), feature: tree(amiga(0x364), amiga(0x253)), density: 0.004 },
  'Gulf Region': { base: amiga(0xdb7), light: amiga(0xec8), dark: amiga(0xb95), feature: rock(amiga(0xa85), amiga(0x864)), density: 0.002 },
  Indochina: { base: amiga(0x473), light: amiga(0x584), dark: amiga(0x362), feature: palm, density: 0.004 },
};

function paintTerrain(p: Pix, region: Region): void {
  const t = TERRAIN[region];
  const seed = region.length * 31;
  p.rect(0, 0, GRID_W, GRID_H, amiga(0x000));
  for (let y = 2; y < GRID_H - 2; y++) {
    for (let x = 2; x < GRID_W - 2; x++) {
      const n = hash(x >> 1, y >> 1, seed) + 0.5 * Math.sin(x / 9 + y / 13 + seed);
      p.px(x, y, n > 1.05 ? t.light : n < -0.1 ? t.dark : t.base);
    }
  }
  if (region === 'Gulf Region' || region === 'North America') {
    // Wind-blown ripples.
    for (let y = 2; y < GRID_H - 2; y += 3) {
      for (let x = 2; x < GRID_W - 2; x++) if (Math.sin(x / 5 + y * 1.7) > 0.95) p.px(x, y, t.dark);
    }
  }
  if (t.feature) {
    for (let y = 4; y < GRID_H - 8; y++) {
      for (let x = 4; x < GRID_W - 6; x++) if (hash(x, y, seed + 1) < t.density) t.feature(p, x, y);
    }
  }
  // Plot boundaries: survey lines between the fields.
  for (let c = 0; c <= FIELD_GRID.cols; c++) {
    const x = 1 + c * (TILE_W + 1);
    for (let y = 1; y < GRID_H - 1; y++) if (y % 4 < 2) p.px(x, y, amiga(0x000));
  }
  for (let r = 0; r <= FIELD_GRID.rows; r++) {
    const y = 1 + r * (TILE_H + 1);
    for (let x = 1; x < GRID_W - 1; x++) if (x % 4 < 2) p.px(x, y, amiga(0x000));
  }
  p.bevel(0, 0, GRID_W, GRID_H, amiga(0x68b), amiga(0x012));
}

/** A small derrick, cached once. */
function smallDerrick(): HTMLCanvasElement {
  return cached('small-derrick', 18, 22, (p) => derrick(p, 9, 21, 17, STEEL));
}

function drawTile(ctx: CanvasRenderingContext2D, field: Field, x: number, y: number, frame: number, region: Region): void {
  const cx = x + Math.floor(TILE_W / 2);
  const ground = y + TILE_H - 6;
  const offshore = region === 'Europe';
  if (offshore && field.status !== 'unexplored') {
    // North Sea fields are worked from a platform.
    ctx.fillStyle = amiga(0x555);
    ctx.fillRect(cx - 10, ground - 1, 21, 3);
    ctx.fillStyle = amiga(0x333);
    for (const lx of [cx - 9, cx - 3, cx + 3, cx + 9]) ctx.fillRect(lx, ground + 2, 1, 4);
  }
  if (field.status === 'dry' || field.status === 'depleted') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, TILE_W, TILE_H);
  }
  switch (field.status) {
    case 'drilling':
      ctx.drawImage(smallDerrick(), cx - 9, ground - 21);
      // Working light on the crown and mud at the base.
      ctx.fillStyle = frame % 30 < 15 ? amiga(0xf40) : amiga(0x810);
      ctx.fillRect(cx - 1, ground - 22, 2, 2);
      ctx.fillStyle = amiga(0x642);
      ctx.fillRect(cx - 6 + ((frame >> 3) % 3), ground + 1, 4, 1);
      break;
    case 'producing':
      pumpjack(ctx, cx - 11, ground + 1, frame + x);
      ctx.fillStyle = amiga(0xddc);
      ctx.fillRect(x + TILE_W - 8, ground - 7, 5, 8);
      ctx.fillStyle = amiga(0x887);
      ctx.fillRect(x + TILE_W - 4, ground - 7, 1, 8);
      break;
    case 'burning':
      ctx.drawImage(smallDerrick(), cx - 9, ground - 21);
      flames(ctx, cx, ground, frame, 0.8);
      break;
    case 'dry':
      // Capped hole and an abandoned sign.
      ctx.fillStyle = amiga(0x555);
      ctx.fillRect(cx - 2, ground - 3, 5, 3);
      ctx.fillStyle = amiga(0x222);
      ctx.fillRect(cx - 4, ground, 9, 1);
      ctx.fillStyle = amiga(0xc22);
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(cx - 4 + i, ground - 14 + i, 1, 1);
        ctx.fillRect(cx - i, ground - 14 + i, 1, 1);
      }
      break;
    case 'depleted':
      pumpjack(ctx, cx - 11, ground + 1, 0, false, true);
      break;
    case 'unexplored':
      if (field.owner) {
        // Survey stake marking a field bought but not yet drilled.
        ctx.fillStyle = amiga(0x642);
        ctx.fillRect(cx, ground - 10, 1, 10);
      }
      break;
  }
  if (field.owner) {
    const color = COMPANY_COLORS[field.owner];
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE_W - 1, TILE_H - 1);
    // Company pennant in the corner.
    ctx.fillStyle = amiga(0x222);
    ctx.fillRect(x + 3, y + 3, 1, 9);
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 3, 6, 4);
    ctx.fillRect(x + 4, y + 7, 3, 1);
  }
}

