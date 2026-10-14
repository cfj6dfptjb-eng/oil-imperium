import { SCREEN_WIDTH } from '@oil/shared';
import { act, type App } from '../app.js';
import { date } from '../format.js';
import { PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { drawDerrick } from './title.js';
import { drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

/**
 * The office is the hub, as in the original: click the objects in the room.
 * Map on the wall, newspaper on the desk, safe for the bank, filing cabinet
 * for the monthly report and the door to end the month.
 */
export function drawOffice(ui: Ui, app: App): void {
  const { ctx } = ui;
  const top = HUD_HEIGHT;
  const floor = 170;

  // Wall and floor.
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(0, top, SCREEN_WIDTH, floor - top);
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(0, floor, SCREEN_WIDTH, FOOTER_Y - floor);
  ctx.fillStyle = PAL.wood;
  for (let y = floor + 6; y < FOOTER_Y; y += 8) ctx.fillRect(0, y, SCREEN_WIDTH, 1);

  // Window with a view of the oil field.
  const win = { x: 16, y: 28, w: 70, h: 56 };
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(win.x - 3, win.y - 3, win.w + 6, win.h + 6);
  PAL.sky.slice(4).forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(win.x, win.y + i * 5, win.w, 5);
  });
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(win.x, win.y + 40, win.w, 16);
  drawDerrick(ctx, win.x + 48, win.y + 42, 30, app.frame, false);

  const hint = (label: string, hovered: boolean) => {
    if (hovered) ui.text(label, SCREEN_WIDTH / 2, FOOTER_Y - 12, PAL.white, 'center');
  };

  // World map on the wall.
  const map = { x: 110, y: 26, w: 110, h: 64 };
  const overMap = ui.hotspot(map.x, map.y, map.w, map.h, () => (app.screen = 'world'));
  ctx.fillStyle = overMap ? PAL.gold : PAL.woodDark;
  ctx.fillRect(map.x - 3, map.y - 3, map.w + 6, map.h + 6);
  ctx.fillStyle = PAL.ocean;
  ctx.fillRect(map.x, map.y, map.w, map.h);
  ctx.fillStyle = PAL.land;
  for (const [x, y, w, h] of [[8, 8, 26, 18], [22, 28, 10, 26], [52, 8, 18, 12], [66, 6, 34, 20], [54, 24, 14, 22], [80, 28, 10, 10], [86, 46, 14, 10]]) {
    ctx.fillRect(map.x + x, map.y + y, w, h);
  }
  hint('WORLD MAP: LICENCES AND OIL FIELDS', overMap);

  // Clock-style calendar.
  const cal = { x: 240, y: 30 };
  ctx.fillStyle = PAL.white;
  ctx.fillRect(cal.x, cal.y, 50, 40);
  ctx.fillStyle = PAL.red;
  ctx.fillRect(cal.x, cal.y, 50, 10);
  const [mon, year] = date(app.game!.view!.month).split(' ');
  ui.text(mon, cal.x + 25, cal.y + 1, PAL.white, 'center');
  ui.big(year.slice(2), cal.x + 25, cal.y + 16, PAL.black, 'center');

  // Door: end the month.
  const door = { x: 262, y: 84, w: 40, h: 86 };
  const overDoor = ui.hotspot(door.x, door.y, door.w, door.h, () => {
    // The main loop switches to the report once the new month arrives.
    act(app, { type: 'endTurn' }, 'Month ended');
  });
  ctx.fillStyle = overDoor ? PAL.gold : PAL.woodDark;
  ctx.fillRect(door.x - 2, door.y - 2, door.w + 4, door.h + 2);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(door.x, door.y, door.w, door.h);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(door.x + 30, door.y + 44, 4, 4);
  hint('DOOR: END THE MONTH', overDoor);

  // Desk.
  const desk = { x: 70, y: 130, w: 150, h: 14 };
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(desk.x, desk.y, desk.w, desk.h);
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(desk.x + 6, desk.y + desk.h, 10, 40);
  ctx.fillRect(desk.x + desk.w - 16, desk.y + desk.h, 10, 40);

  // Newspaper on the desk: the oil market.
  const paper = { x: 92, y: 118, w: 40, h: 14 };
  const overPaper = ui.hotspot(paper.x, paper.y, paper.w, paper.h, () => (app.screen = 'market'));
  ctx.fillStyle = overPaper ? PAL.gold : PAL.white;
  ctx.fillRect(paper.x, paper.y, paper.w, paper.h);
  ctx.fillStyle = PAL.greyDark;
  for (let i = 0; i < 3; i++) ctx.fillRect(paper.x + 4, paper.y + 3 + i * 4, paper.w - 8, 1);
  hint('NEWSPAPER: OIL PRICE AND SALES', overPaper);

  // Telephone on the desk: also the market, for selling.
  ctx.fillStyle = PAL.black;
  ctx.fillRect(170, 120, 22, 10);
  ctx.fillRect(166, 116, 30, 4);

  // Filing cabinet: monthly report.
  const files = { x: 20, y: 110, w: 34, h: 60 };
  const overFiles = ui.hotspot(files.x, files.y, files.w, files.h, () => (app.screen = 'report'));
  ctx.fillStyle = overFiles ? PAL.gold : PAL.greyDark;
  ctx.fillRect(files.x, files.y, files.w, files.h);
  ctx.fillStyle = PAL.grey;
  for (let i = 0; i < 3; i++) ctx.fillRect(files.x + 3, files.y + 4 + i * 19, files.w - 6, 15);
  ctx.fillStyle = PAL.black;
  for (let i = 0; i < 3; i++) ctx.fillRect(files.x + 13, files.y + 10 + i * 19, 8, 2);
  hint('FILES: MONTHLY REPORT AND RIVALS', overFiles);

  // Safe: the bank.
  const safe = { x: 228, y: 136, w: 28, h: 34 };
  const overSafe = ui.hotspot(safe.x, safe.y, safe.w, safe.h, () => (app.screen = 'bank'));
  ctx.fillStyle = overSafe ? PAL.gold : PAL.greyDark;
  ctx.fillRect(safe.x, safe.y, safe.w, safe.h);
  ctx.fillStyle = PAL.grey;
  ctx.fillRect(safe.x + 10, safe.y + 12, 8, 8);
  hint('SAFE: BANK LOANS', overSafe);

  const game = app.game!;
  if (game.view!.you.endedTurn) {
    const others = game.waitingFor.filter((c) => c !== game.company);
    ui.panel(60, 90, 200, 36, PAL.black);
    ui.text('MONTH ENDED. WAITING FOR', SCREEN_WIDTH / 2, 96, PAL.gold, 'center');
    ui.text(others.length ? others.join(', ').toUpperCase() : 'THE SERVER', SCREEN_WIDTH / 2, 110, PAL.white, 'center');
  }

  drawHud(ui, app);
  drawFooter(ui, app, 'Click an object in the office');
}
