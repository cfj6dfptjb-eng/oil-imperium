import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import { act, type App } from '../app.js';
import { amiga, cached, hash, type Pix } from '../art/pix.js';
import { derrick, pumpjack, SILHOUETTE, tank } from '../art/props.js';
import { WORLD_HEIGHT, WORLD_WIDTH, worldMask } from '../art/world-mask.js';
import { date } from '../format.js';
import { PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { drawFooter, drawHud, FOOTER_Y, HUD_HEIGHT } from './hud.js';

const WALL_BOTTOM = 150;

// The clickable objects in the room.
const MAP = { x: 96, y: 24, w: 110, h: 64 };
const WINDOW = { x: 12, y: 24, w: 72, h: 74 };
const CALENDAR = { x: 214, y: 26, w: 34, h: 40 };
const DOOR = { x: 268, y: 58, w: 42, h: 94 };
const COAT = { x: 236, y: 70, w: 26, h: 82 };
const FILES = { x: 10, y: 98, w: 40, h: 62 };
const SAFE = { x: 212, y: 124, w: 32, h: 38 };
const PAPER = { x: 86, y: 139, w: 38, h: 15 };
const PHONE = { x: 148, y: 134, w: 30, h: 20 };

const C = {
  paper: amiga(0xffe),
  wallpaper: amiga(0x354),
  wallpaperLight: amiga(0x465),
  wallpaperDark: amiga(0x243),
  woodLight: amiga(0xa63),
  wood: amiga(0x742),
  woodDark: amiga(0x521),
  woodDeep: amiga(0x310),
  brass: amiga(0xdb5),
  brassDark: amiga(0x973),
  carpet: amiga(0x612),
  carpetLight: amiga(0x823),
  carpetDark: amiga(0x401),
  steel: amiga(0x899),
  steelLight: amiga(0xbcc),
  steelDark: amiga(0x455),
  leather: amiga(0x253),
  leatherLight: amiga(0x375),
  leatherDark: amiga(0x132),
  black: amiga(0x000),
  outline: amiga(0x100),
};

/**
 * The office is the hub, as in the original: click the objects in the room.
 * Map on the wall, newspaper and phone on the desk, the agent's coat on the
 * stand, safe for the bank, filing cabinet for the reports and the door to
 * end the month.
 */
export function drawOffice(ui: Ui, app: App): void {
  const { ctx } = ui;
  const game = app.game!;
  const view = game.view!;
  ctx.drawImage(cached(`office:${game.company}`, SCREEN_WIDTH, SCREEN_HEIGHT, (p) => paintOffice(p, game.company)), 0, 0);

  // Out of the window a pumpjack nods away.
  ctx.save();
  ctx.beginPath();
  ctx.rect(WINDOW.x + 4, WINDOW.y + 4, WINDOW.w - 8, WINDOW.h - 8);
  ctx.clip();
  pumpjack(ctx, WINDOW.x + 40, WINDOW.y + 62, app.frame);
  ctx.restore();

  // Tear-off calendar.
  const [mon, year] = date(view.month).split(' ');
  ui.text(mon, CALENDAR.x + CALENDAR.w / 2, CALENDAR.y + 6, PAL.white, 'center');
  ui.text(`'${year.slice(2)}`, CALENDAR.x + CALENDAR.w / 2, CALENDAR.y + 19, PAL.black, 'center', { scale: 2, shadow: null });

  // The phone rings when buyers have contracts on offer.
  if (view.contractOffers.length > 0 && Math.floor(app.frame / 12) % 5 < 2) {
    ui.text('RING!', PHONE.x + PHONE.w / 2, PHONE.y - 10, PAL.goldLight, 'center');
  }

  let hint = '';
  const spot = (r: { x: number; y: number; w: number; h: number }, label: string, onClick: () => void) => {
    if (ui.hotspot(r.x, r.y, r.w, r.h, onClick)) {
      hint = label;
      if (Math.floor(app.frame / 8) % 2 === 0) {
        ctx.strokeStyle = PAL.goldLight;
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3);
      }
    }
  };
  spot(MAP, 'WORLD MAP: LICENCES AND OIL FIELDS', () => (app.screen = 'world'));
  spot(FILES, 'FILES: MONTHLY REPORT AND RIVALS', () => (app.screen = 'report'));
  spot(SAFE, 'SAFE: THE BANK', () => (app.screen = 'bank'));
  spot(COAT, 'THE AGENT: SABOTAGE AND SECURITY', () => (app.screen = 'agent'));
  spot(PAPER, 'NEWSPAPER: NEWS, PRICES, SELLING', () => (app.screen = 'market'));
  spot(PHONE, 'TELEPHONE: SUPPLY CONTRACTS', () => (app.screen = 'contracts'));
  // The main loop switches to the report once the new month arrives.
  spot(DOOR, 'DOOR: END THE MONTH', () => act(app, { type: 'endTurn' }, 'Month ended'));
  if (hint) {
    ui.panel(SCREEN_WIDTH / 2 - 100, FOOTER_Y - 15, 200, 12, PAL.black);
    ui.text(hint, SCREEN_WIDTH / 2, FOOTER_Y - 13, PAL.goldLight, 'center');
  }

  if (view.you.endedTurn) {
    const others = game.waitingFor.filter((c) => c !== game.company);
    ui.panel(60, 90, 200, 36);
    ui.text('MONTH ENDED. WAITING FOR', SCREEN_WIDTH / 2, 96, PAL.gold, 'center');
    ui.text(others.length ? others.join(', ').toUpperCase() : 'THE SERVER', SCREEN_WIDTH / 2, 110, PAL.white, 'center');
  }

  drawHud(ui, app);
  drawFooter(ui, app, 'Click an object in the office');
}

function paintOffice(p: Pix, company: string): void {
  paintWall(p);
  paintWindow(p);
  paintMap(p);
  paintCalendar(p);
  paintDoor(p, company);
  paintFloor(p);
  paintCabinet(p);
  paintCoatStand(p);
  paintSafe(p);
  paintChair(p);
  paintDesk(p);
}

function paintWall(p: Pix): void {
  // Striped green wallpaper with a faint damask dot.
  for (let y = HUD_HEIGHT; y < WALL_BOTTOM; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const stripe = x % 12;
      let c = stripe < 2 ? C.wallpaperLight : stripe === 6 ? C.wallpaperDark : C.wallpaper;
      if (stripe === 9 && y % 8 === 4) c = C.wallpaperLight;
      p.px(x, y, c);
    }
  }
  // Shadow under the cornice, the cornice itself.
  p.dither(0, HUD_HEIGHT + 5, SCREEN_WIDTH, 4, C.wallpaper, C.wallpaperDark, 8);
  p.rect(0, HUD_HEIGHT, SCREEN_WIDTH, 5, C.wood);
  p.hline(0, HUD_HEIGHT, SCREEN_WIDTH, C.woodLight);
  p.hline(0, HUD_HEIGHT + 4, SCREEN_WIDTH, C.woodDeep);
  // Wood panelling below the chair rail.
  const rail = 112;
  p.rect(0, rail, SCREEN_WIDTH, WALL_BOTTOM - rail, C.wood);
  p.rect(0, rail, SCREEN_WIDTH, 3, C.woodLight);
  p.hline(0, rail + 3, SCREEN_WIDTH, C.woodDeep);
  for (let x = 4; x < SCREEN_WIDTH - 20; x += 32) {
    p.bevel(x, rail + 8, 26, WALL_BOTTOM - rail - 14, C.woodDark, C.woodLight);
    for (let y = rail + 9; y < WALL_BOTTOM - 7; y++) {
      for (let i = x + 1; i < x + 25; i++) if (hash(i, y >> 1, 7) < 0.12) p.px(i, y, C.woodDark);
    }
  }
  p.rect(0, WALL_BOTTOM - 4, SCREEN_WIDTH, 4, C.woodDeep);
  p.hline(0, WALL_BOTTOM - 4, SCREEN_WIDTH, C.woodDark);
}

function paintWindow(p: Pix): void {
  const { x, y, w, h } = WINDOW;
  // The view: evening over an oil field.
  p.gradient(x + 4, y + 4, w - 8, 40, [0x134, 0x358, 0x87a, 0xd97, 0xfb7].map(amiga));
  for (let i = x + 4; i < x + w - 4; i++) {
    const hill = Math.round(3 + 2 * Math.sin(i / 6));
    p.vline(i, y + 44 - hill, hill, amiga(0x535));
  }
  p.gradient(x + 4, y + 44, w - 8, h - 48, [0xb74, 0xc85, 0xd96].map(amiga));
  derrick(p, x + 16, y + 46, 26, SILHOUETTE);
  derrick(p, x + 58, y + 44, 16, SILHOUETTE);
  tank(p, x + 24, y + 62, 10, 8);
  // Frame and glazing bars.
  p.bevel(x, y, w, h, C.woodLight, C.woodDeep, 2);
  p.rect(x + 2, y + 2, w - 4, 2, C.wood);
  p.rect(x + 2, y + h - 4, w - 4, 2, C.wood);
  p.rect(x + 2, y + 2, 2, h - 4, C.wood);
  p.rect(x + w - 4, y + 2, 2, h - 4, C.wood);
  p.rect(x + w / 2 - 1, y + 4, 2, h - 8, C.wood);
  p.rect(x + 4, y + 38, w - 8, 2, C.wood);
  p.rect(x - 2, y + h, w + 4, 3, C.woodLight);
  p.hline(x - 2, y + h + 3, w + 4, C.woodDeep);
  // Velvet curtains.
  for (const cx of [x - 6, x + w - 4]) {
    for (let i = 0; i < 10; i++) {
      const fold = [amiga(0x701), amiga(0xa22), amiga(0xc44), amiga(0xa22), amiga(0x701)][i % 5];
      p.vline(cx + i, y - 6, h + 14, fold);
    }
  }
  p.rect(x - 8, y - 8, w + 16, 3, C.brassDark);
  p.hline(x - 8, y - 8, w + 16, C.brass);
}

function paintMap(p: Pix): void {
  const { x, y, w, h } = MAP;
  const inner = { x: x + 4, y: y + 4, w: w - 8, h: h - 8 };
  const mask = worldMask();
  for (let j = 0; j < inner.h; j++) {
    for (let i = 0; i < inner.w; i++) {
      const mx = Math.floor((i * WORLD_WIDTH) / inner.w);
      const my = Math.floor((j * WORLD_HEIGHT) / inner.h);
      const land = mask[my * WORLD_WIDTH + mx] === 1;
      const c = land
        ? (my < 24 ? amiga(0xdec) : hash(i, j, 2) < 0.2 ? amiga(0x8b5) : amiga(0x9c6))
        : (i + j) % 2 === 0 && hash(i, j) < 0.3 ? amiga(0x6ad) : amiga(0x59c);
      p.px(inner.x + i, inner.y + j, c);
    }
  }
  // Parchment-coloured grid lines.
  for (let i = 0; i < inner.w; i += 17) p.vline(inner.x + i, inner.y, inner.h, amiga(0x7bd));
  // Gilt frame.
  p.rect(x, y, w, 4, C.brassDark);
  p.rect(x, y + h - 4, w, 4, C.brassDark);
  p.rect(x, y, 4, h, C.brassDark);
  p.rect(x + w - 4, y, 4, h, C.brassDark);
  p.bevel(x, y, w, h, C.brass, C.woodDeep);
  p.bevel(x + 3, y + 3, w - 6, h - 6, C.woodDeep, C.brass);
  p.dither(x + 2, y + h, w, 2, C.wallpaper, C.wallpaperDark, 10);
}

function paintCalendar(p: Pix): void {
  const { x, y, w, h } = CALENDAR;
  p.px(x + w / 2, y - 4, C.black);
  p.line(x + w / 2, y - 4, x + 6, y, C.steelDark);
  p.line(x + w / 2, y - 4, x + w - 6, y, C.steelDark);
  p.rect(x, y, w, h, C.paper);
  p.rect(x, y, w, 14, amiga(0xc22));
  p.hline(x, y, w, amiga(0xe55));
  for (const rx of [x + 6, x + w - 8]) p.rect(rx, y - 1, 2, 4, C.steel);
  // Pages underneath.
  p.hline(x + 1, y + h, w - 1, amiga(0xccb));
  p.hline(x + 2, y + h + 1, w - 2, amiga(0x998));
  p.vline(x + w, y + 1, h, C.wallpaperDark);
}

function paintDoor(p: Pix, company: string): void {
  const { x, y, w, h } = DOOR;
  p.rect(x - 4, y - 4, w + 8, h + 4, C.woodDark);
  p.bevel(x - 4, y - 4, w + 8, h + 4, C.woodLight, C.woodDeep);
  p.rect(x, y, w, h, C.wood);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (hash(i >> 2, j, 9) < 0.15) p.px(i, j, C.woodDark);
  // Frosted glass pane with the company name in gold leaf (drawn by the text layer is not cached, so paint letters here).
  p.bevel(x + 5, y + 6, w - 10, 34, C.woodDeep, C.woodLight);
  p.gradient(x + 6, y + 7, w - 12, 32, [0xcde, 0xabc, 0x9ab].map(amiga));
  goldLetters(p, company, x + w / 2, y + 16);
  // Lower panels.
  p.bevel(x + 5, y + 46, w - 10, 20, C.woodLight, C.woodDeep);
  p.bevel(x + 5, y + 70, w - 10, 20, C.woodLight, C.woodDeep);
  // Knob.
  p.rect(x + 4, y + 52, 3, 3, C.brass);
  p.px(x + 4, y + 52, amiga(0xffe));
}

/** Small block lettering painted straight onto artwork (company name on the door). */
function goldLetters(p: Pix, text: string, cx: number, y: number): void {
  const words = text.toUpperCase().split(' ');
  words.forEach((word, row) => {
    const x0 = Math.round(cx - (word.length * 4) / 2);
    for (let i = 0; i < word.length; i++) {
      const g = MINI[word[i]] ?? MINI['.'];
      g.forEach((line, j) => {
        for (let k = 0; k < 3; k++) if (line[k] === '#') p.px(x0 + i * 4 + k, y + row * 7 + j, j < 2 ? C.brass : C.brassDark);
      });
    }
  });
}

/** 3x5 letters for tiny signage. */
const MINI: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], C: ['###', '#..', '#..', '#..', '###'], E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'], P: ['###', '#.#', '###', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['###', '#..', '###', '..#', '###'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'], '.': ['...', '...', '...', '...', '.#.'],
};

function paintFloor(p: Pix): void {
  for (let y = WALL_BOTTOM; y < FOOTER_Y; y++) {
    const depth = (y - WALL_BOTTOM) / (FOOTER_Y - WALL_BOTTOM);
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      // Diamond pattern that widens towards the viewer.
      const s = 8 + depth * 10;
      const u = Math.abs(((x - SCREEN_WIDTH / 2) / s + (y - WALL_BOTTOM) / (s * 0.6)) % 2) - 1;
      const v = Math.abs(((x - SCREEN_WIDTH / 2) / s - (y - WALL_BOTTOM) / (s * 0.6)) % 2) - 1;
      let c = C.carpet;
      if (Math.abs(Math.abs(u) - Math.abs(v)) < 0.08) c = C.carpetLight;
      if (hash(x, y, 4) < 0.06) c = C.carpetDark;
      p.px(x, y, c);
    }
  }
  p.dither(0, WALL_BOTTOM, SCREEN_WIDTH, 6, C.carpet, C.carpetDark, 8);
}

function paintCabinet(p: Pix): void {
  const { x, y, w, h } = FILES;
  p.dither(x + 3, y + h, w, 3, C.carpet, C.carpetDark, 12);
  p.rect(x, y, w, h, C.steel);
  p.bevel(x, y, w, h, C.steelLight, C.steelDark);
  p.vline(x + w - 2, y + 1, h - 2, C.steelDark);
  for (let i = 0; i < 3; i++) {
    const dy = y + 4 + i * 19;
    p.rect(x + 3, dy, w - 7, 16, amiga(0x9aa));
    p.bevel(x + 3, dy, w - 7, 16, C.steelLight, C.steelDark);
    p.rect(x + 12, dy + 4, 14, 5, C.paper);
    p.hline(x + 13, dy + 6, 12, C.steelDark);
    p.rect(x + 14, dy + 10, 10, 2, C.steelDark);
    p.hline(x + 14, dy + 10, 10, C.black);
  }
}

function paintCoatStand(p: Pix): void {
  const { x, y, w, h } = COAT;
  const cx = x + w / 2;
  // Pole and feet.
  p.rect(cx - 1, y + 4, 3, h - 4, C.woodDark);
  p.vline(cx - 1, y + 4, h - 4, C.woodLight);
  p.line(cx, y + h - 6, x + 1, y + h - 1, C.woodDark);
  p.line(cx, y + h - 6, x + w - 2, y + h - 1, C.woodDark);
  // Trench coat.
  const coat = amiga(0xa85);
  const coatDark = amiga(0x753);
  const coatLight = amiga(0xcb8);
  for (let j = 0; j < 46; j++) {
    const half = 5 + Math.round(j / 6);
    p.hline(cx - half, y + 14 + j, half * 2 + 1, coat);
    p.px(cx - half, y + 14 + j, coatLight);
    p.px(cx + half, y + 14 + j, coatDark);
    p.px(cx + 1, y + 14 + j, coatDark);
  }
  p.hline(cx - 9, y + 34, 19, coatDark);
  p.rect(cx - 3, y + 14, 7, 4, coatDark);
  // Empty sleeves hanging at the sides.
  p.rect(cx - 9, y + 17, 3, 26, coatLight);
  p.vline(cx - 6, y + 17, 26, coatDark);
  p.rect(cx + 7, y + 17, 3, 26, coatDark);
  // Fedora on top.
  p.rect(cx - 8, y + 9, 17, 2, amiga(0x333));
  p.rect(cx - 5, y + 3, 11, 6, amiga(0x444));
  p.hline(cx - 5, y + 7, 11, amiga(0x711));
  p.hline(cx - 5, y + 3, 11, amiga(0x666));
}

function paintSafe(p: Pix): void {
  const { x, y, w, h } = SAFE;
  p.dither(x + 3, y + h, w, 3, C.carpet, C.carpetDark, 12);
  const body = amiga(0x354);
  p.rect(x, y, w, h, body);
  p.bevel(x, y, w, h, amiga(0x687), amiga(0x121), 2);
  p.bevel(x + 4, y + 4, w - 8, h - 8, amiga(0x121), amiga(0x576));
  // Dial with ticks, handle and maker's plate.
  p.ellipse(x + 13, y + 17, 5, 5, amiga(0x999));
  p.ellipse(x + 13, y + 17, 3, 3, amiga(0xccc));
  p.px(x + 13, y + 12, C.black);
  p.px(x + 18, y + 17, C.black);
  p.px(x + 8, y + 17, C.black);
  p.rect(x + 22, y + 13, 2, 10, C.brass);
  p.rect(x + 9, y + 27, 12, 3, C.brass);
  p.hline(x + 9, y + 27, 12, amiga(0xfe9));
}

function paintChair(p: Pix): void {
  // High-backed leather chair behind the desk.
  const x = 112;
  const y = 104;
  p.rect(x, y, 42, 46, C.leather);
  p.bevel(x, y, 42, 46, C.leatherLight, C.leatherDark, 2);
  for (let j = y + 6; j < y + 44; j += 8) {
    for (let i = x + 6 + ((j / 8) % 2) * 4; i < x + 38; i += 8) {
      p.px(i, j, C.brass);
      p.px(i - 1, j + 1, C.leatherDark);
      p.px(i + 1, j + 1, C.leatherLight);
    }
  }
  p.rect(x - 2, y - 2, 46, 3, C.leatherDark);
  p.hline(x - 2, y - 2, 46, C.leatherLight);
}

function paintDesk(p: Pix): void {
  const x = 54;
  const w = 156;
  const top = 146;
  const front = 156;
  const bottom = 214;
  // Shadow on the carpet.
  p.dither(x + 4, bottom, w, 5, C.carpet, C.carpetDark, 12);
  // Top with a leather writing pad.
  p.rect(x - 2, top, w + 4, front - top, C.wood);
  p.hline(x - 2, top, w + 4, C.woodLight);
  p.rect(x + 28, top + 2, 92, front - top - 3, C.leather);
  p.bevel(x + 28, top + 2, 92, front - top - 3, C.leatherLight, C.leatherDark);
  p.rect(x - 4, front, w + 8, 4, C.woodLight);
  p.hline(x - 4, front + 3, w + 8, C.woodDeep);
  // Front: two pedestals of drawers and a recessed middle panel.
  p.rect(x, front + 4, w, bottom - front - 4, C.woodDark);
  for (let j = front + 4; j < bottom; j++) for (let i = x; i < x + w; i++) if (hash(i, j >> 1, 5) < 0.1) p.px(i, j, C.wood);
  for (const px of [x + 2, x + w - 44]) {
    for (let i = 0; i < 3; i++) {
      const dy = front + 7 + i * 17;
      p.rect(px, dy, 42, 15, C.wood);
      p.bevel(px, dy, 42, 15, C.woodLight, C.woodDeep);
      p.rect(px + 17, dy + 6, 8, 2, C.brass);
      p.hline(px + 17, dy + 6, 8, amiga(0xfe9));
    }
  }
  p.rect(x + 48, front + 7, w - 96, bottom - front - 10, C.woodDeep);
  p.bevel(x + 48, front + 7, w - 96, bottom - front - 10, C.outline, C.woodDark);

  // Desk lamp with a green glass shade casting light on the desk.
  p.dither(x + 2, top + 1, 26, front - top - 1, C.wood, C.woodLight, 6);
  p.rect(x + 8, top - 3, 14, 4, C.brassDark);
  p.hline(x + 8, top - 3, 14, C.brass);
  p.rect(x + 14, top - 22, 2, 20, C.brass);
  for (let j = 0; j < 8; j++) {
    const half = 5 + j;
    p.hline(x + 15 - half, top - 30 + j, half * 2, j < 2 ? amiga(0x6c8) : amiga(0x283));
  }
  p.hline(x + 3, top - 22, 24, amiga(0xffd));

  // Newspaper folded on the pad.
  const n = PAPER;
  p.rect(n.x, n.y + 2, n.w, n.h - 2, amiga(0xddc));
  p.rect(n.x + 1, n.y + 1, n.w - 2, n.h - 3, amiga(0xeed));
  p.hline(n.x + 3, n.y + 3, n.w - 6, C.black);
  p.hline(n.x + 3, n.y + 4, n.w - 6, C.black);
  p.rect(n.x + 3, n.y + 6, 10, 6, amiga(0x666));
  for (let i = 0; i < 3; i++) p.hline(n.x + 15, n.y + 6 + i * 2, n.w - 18, amiga(0x888));
  p.hline(n.x, n.y + n.h - 1, n.w, amiga(0x998));

  // Black telephone.
  const t = PHONE;
  const black = amiga(0x111);
  const shine = amiga(0x556);
  for (let j = 0; j < 9; j++) {
    const half = 9 + Math.floor(j / 3);
    p.hline(t.x + 15 - half, t.y + 10 + j, half * 2, black);
  }
  p.hline(t.x + 7, t.y + 10, 16, shine);
  p.ellipse(t.x + 15, t.y + 14, 4, 3, amiga(0xccb));
  p.ellipse(t.x + 15, t.y + 14, 1, 1, black);
  // Handset on its cradle.
  p.rect(t.x + 2, t.y + 5, 26, 3, black);
  p.rect(t.x + 1, t.y + 3, 6, 5, black);
  p.rect(t.x + 23, t.y + 3, 6, 5, black);
  p.hline(t.x + 3, t.y + 5, 24, shine);
  // Brass pen stand.
  p.rect(178, top, 12, 4, C.brassDark);
  p.line(181, top, 176, top - 10, C.black);
  p.line(186, top, 190, top - 9, amiga(0x22a));
}
