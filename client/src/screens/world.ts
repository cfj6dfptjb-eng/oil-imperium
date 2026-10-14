import { REGION_DATA, REGIONS, SCREEN_WIDTH, type Region } from '@oil/shared';
import type { App } from '../app.js';
import { money } from '../format.js';
import { PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { backButton, drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

/** Where each region's button sits on the 320x256 world map. */
const POSITIONS: Record<Region, [number, number]> = {
  Alaska: [10, 34],
  'North America': [40, 66],
  'Central America': [50, 112],
  'South America': [86, 150],
  Europe: [148, 50],
  USSR: [224, 34],
  'Gulf Region': [184, 100],
  Indochina: [240, 130],
};

/** Rough blocky continents. Placeholder art. */
const LAND: [number, number, number, number][] = [
  [8, 30, 34, 26], [30, 52, 70, 50], [60, 102, 30, 22], [80, 124, 44, 64],
  [140, 40, 50, 36], [190, 26, 120, 50], [150, 80, 50, 96], [196, 80, 34, 30],
  [230, 80, 60, 50], [262, 160, 44, 30],
];

export function drawWorld(ui: Ui, app: App): void {
  const { ctx } = ui;
  const me = app.game!.me;
  const fields = app.game!.state.fields;
  ctx.fillStyle = PAL.ocean;
  ctx.fillRect(0, HUD_HEIGHT, SCREEN_WIDTH, FOOTER_Y - HUD_HEIGHT);
  ctx.fillStyle = PAL.land;
  for (const [x, y, w, h] of LAND) ctx.fillRect(x, y, w, h);

  let hovered: Region | null = null;
  for (const region of REGIONS) {
    const [x, y] = POSITIONS[region];
    const licensed = me.licences.includes(region);
    const wells = fields.filter((f) => f.region === region && f.owner === me.company && f.status === 'producing').length;
    const label = region.toUpperCase() + (wells ? ` (${wells})` : '');
    ui.button(x, y, label, () => {
      app.region = region;
      app.fieldId = undefined;
      app.screen = 'region';
    }, { color: licensed ? PAL.greenDark : PAL.black });
    if (ui.hovering(x, y, 90, 12)) hovered = region;
  }

  ui.text('WORLD MAP', 4, HUD_HEIGHT + 4, PAL.gold);
  if (hovered) {
    const data = REGION_DATA[hovered];
    const text = me.licences.includes(hovered) ? 'LICENCE HELD' : `LICENCE ${money(data.licenceCost)}`;
    ui.text(`${hovered.toUpperCase()}: ${text}`, 4, FOOTER_Y - 12, PAL.white);
  }
  backButton(ui, app);
  drawHud(ui, app);
  drawFooter(ui, app, 'Green = licence held. (n) = your producing wells');
}
