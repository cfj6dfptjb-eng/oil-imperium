import { REGION_DATA, REGIONS, SCREEN_WIDTH, type Region } from '@oil/shared';
import type { App } from '../app.js';
import { amiga, cached, hash, type Pix } from '../art/pix.js';
import { project, WORLD_HEIGHT, WORLD_WIDTH, worldMask } from '../art/world-mask.js';
import { money } from '../format.js';
import { PAL } from '../palette.js';
import { textWidth } from '../text.js';
import type { Ui } from '../ui.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

const MAP_Y = HUD_HEIGHT + 22;

/** Where each region's oil lies, and where its label sits relative to that spot. */
const PLACES: Record<Region, { lon: number; lat: number; dx: number; dy: number }> = {
  Alaska: { lon: -150, lat: 66, dx: -4, dy: 6 },
  'North America': { lon: -100, lat: 42, dx: 6, dy: -4 },
  'Central America': { lon: -94, lat: 18, dx: -64, dy: 2 },
  'South America': { lon: -63, lat: -8, dx: 6, dy: -4 },
  Europe: { lon: 4, lat: 56, dx: -50, dy: -16 },
  USSR: { lon: 75, lat: 62, dx: -10, dy: -16 },
  'Gulf Region': { lon: 49, lat: 27, dx: -76, dy: 6 },
  Indochina: { lon: 104, lat: 14, dx: -8, dy: 8 },
};

export function drawWorld(ui: Ui, app: App): void {
  const { ctx } = ui;
  const view = app.game!.view!;
  const me = view.you;
  ctx.drawImage(cached('world', SCREEN_WIDTH, FOOTER_Y - HUD_HEIGHT, paintWorld), 0, HUD_HEIGHT);
  ui.big('WORLD MAP', 6, HUD_HEIGHT + 4);

  let hovered: Region | null = null;
  for (const region of REGIONS) {
    const place = PLACES[region];
    const [px, py] = project(place.lon, place.lat);
    const x = px;
    const y = MAP_Y + py;
    const licensed = me.licences.includes(region);
    const wells = view.fields.filter((f) => f.region === region && f.owner === me.company && f.status === 'producing').length;
    const label = region.toUpperCase() + (wells ? ` (${wells})` : '');

    // Marker: a little derrick, gold where you hold the licence.
    const blink = licensed || Math.floor(app.frame / 20) % 2 === 0;
    ctx.fillStyle = PAL.black;
    ctx.fillRect(x - 3, y - 6, 7, 8);
    ctx.fillStyle = licensed ? PAL.gold : blink ? PAL.white : PAL.grey;
    ctx.fillRect(x - 2, y - 1, 5, 2);
    ctx.fillRect(x - 1, y - 5, 3, 4);
    ctx.fillRect(x, y - 6, 1, 1);

    const lx = x + place.dx;
    const ly = y + place.dy;
    const w = textWidth(label) + 8;
    const over = ui.hotspot(lx, ly, w, 11, () => {
      app.region = region;
      app.fieldId = undefined;
      app.screen = 'region';
    }) || ui.hovering(x - 4, y - 7, 9, 10);
    if (over) hovered = region;
    ui.hotspot(x - 4, y - 7, 9, 10, () => {
      app.region = region;
      app.fieldId = undefined;
      app.screen = 'region';
    });
    ctx.fillStyle = PAL.black;
    ctx.fillRect(lx - 1, ly - 1, w + 2, 13);
    ctx.fillStyle = over ? PAL.goldLight : licensed ? amiga(0x2a4) : amiga(0x234);
    ctx.fillRect(lx, ly, w, 11);
    ctx.fillStyle = over ? PAL.white : licensed ? amiga(0x6e8) : amiga(0x68b);
    ctx.fillRect(lx, ly, w, 1);
    ui.text(label, lx + 4, ly + 1, over ? PAL.black : PAL.white, 'left', over ? { shadow: null } : {});
  }

  ui.panel(4, FOOTER_Y - 34, 220, 30, amiga(0x123));
  if (hovered) {
    const data = REGION_DATA[hovered];
    const held = me.licences.includes(hovered);
    ui.text(hovered.toUpperCase(), 10, FOOTER_Y - 30, PAL.gold);
    ui.text(held ? 'LICENCE HELD' : `LICENCE ${money(data.licenceCost)}`, 10, FOOTER_Y - 19, held ? PAL.green : PAL.white);
    ui.text(`DRILLING ${money(data.drillCostPerMonth)}/MO`, 118, FOOTER_Y - 19, PAL.greyLight);
  } else {
    ui.text('PICK A REGION TO VISIT', 10, FOOTER_Y - 30, PAL.gold);
    ui.text('GOLD = YOUR LICENCE  (N) = WELLS', 10, FOOTER_Y - 19, PAL.greyLight);
  }
  backButton(ui, app);
  drawHud(ui, app);
  drawFooter(ui, app, 'Click a region to see its oil fields');
}

function paintWorld(p: Pix): void {
  const h = FOOTER_Y - HUD_HEIGHT;
  const top = MAP_Y - HUD_HEIGHT;
  p.gradient(0, 0, SCREEN_WIDTH, h, [0x013, 0x124, 0x135].map(amiga));
  const mask = worldMask();
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT && mask[y * WORLD_WIDTH + x] === 1;
  const [dx0, dy0] = project(-15, 32);
  const [dx1, dy1] = project(58, 15);
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const coast = land(x - 1, y) || land(x + 1, y) || land(x, y - 1) || land(x, y + 1);
      let c: string;
      if (land(x, y)) {
        const edge = !land(x - 1, y) || !land(x + 1, y) || !land(x, y - 1) || !land(x, y + 1);
        const desert = x >= dx0 && x <= dx1 && y >= dy0 + 3 * Math.sin(x / 6) && y <= dy1 + 4 * Math.sin(x / 9 + 1);
        const ice = y < 22 || y > WORLD_HEIGHT - 6;
        const n = hash(x >> 1, y >> 1, 11);
        if (edge) c = ice ? amiga(0x9ab) : amiga(0x263);
        else if (ice) c = n < 0.3 ? amiga(0xcde) : amiga(0xeef);
        else if (desert) c = n < 0.25 ? amiga(0xb95) : amiga(0xdb7);
        else if (y < 45) c = n < 0.3 ? amiga(0x786) : amiga(0x8a6);
        else c = n < 0.3 ? amiga(0x372) : amiga(0x4a4);
      } else if (coast) {
        c = amiga(0x37a);
      } else {
        c = (x + y * 3) % 7 === 0 && hash(x, y) < 0.4 ? amiga(0x36a) : amiga(0x258);
      }
      p.px(x, top + y, c);
    }
  }
  // Meridians and parallels.
  for (let lon = -150; lon <= 150; lon += 30) {
    const [x] = project(lon, 0);
    for (let y = 0; y < WORLD_HEIGHT; y += 2) if (!land(x, y)) p.px(x, top + y, amiga(0x47a));
  }
  for (const lat of [-30, 0, 30, 60]) {
    const [, y] = project(0, lat);
    for (let x = 0; x < WORLD_WIDTH; x += 2) if (!land(x, y)) p.px(x, top + y, amiga(0x47a));
  }
  p.hline(0, top - 1, SCREEN_WIDTH, amiga(0x68b));
  p.hline(0, top + WORLD_HEIGHT, SCREEN_WIDTH, amiga(0x68b));
}
