import { GAME_TITLE, SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import type { App } from '../app.js';
import { amiga, cached, hash, type Pix } from '../art/pix.js';
import { barrels, derrick, gusher, SILHOUETTE, STEEL, tank } from '../art/props.js';
import { PAL } from '../palette.js';
import type { Ui } from '../ui.js';

const HORIZON = 168;
const RIG = { x: 244, base: 214, height: 118 };

/** Title screen in the spirit of the original: a sunset over the desert and a gusher. */
export function drawTitle(ui: Ui, app: App): void {
  const { ctx } = ui;
  const { conn, frame } = app;
  drawDesert(ctx, frame);

  ui.text(GAME_TITLE.toUpperCase(), SCREEN_WIDTH / 2, 26, PAL.goldLight, 'center', { scale: 3, fade: amiga(0xc50), shadow: amiga(0x201) });
  ui.text('ONLINE EDITION', SCREEN_WIDTH / 2, 56, PAL.white, 'center');
  ui.text('FOR 1 TO 4 OIL BARONS', SCREEN_WIDTH / 2, 68, amiga(0xfda), 'center');

  if (Math.floor(frame / 30) % 2 === 0) {
    ui.text('CLICK TO START', SCREEN_WIDTH / 2, 228, PAL.white, 'center');
  }
  ui.hotspot(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, () => {
    // A shared invite link (?room=CODE) goes straight to joining.
    app.screen = app.joinCode.length === 4 ? 'join' : 'menu';
  });

  const status =
    conn.state === 'online'
      ? `SERVER ONLINE${conn.latencyMs !== null ? `  ${conn.latencyMs} MS` : ''}`
      : conn.state === 'connecting'
        ? 'CONNECTING...'
        : 'SERVER OFFLINE';
  const color = conn.state === 'online' ? PAL.green : conn.state === 'offline' ? PAL.red : PAL.white;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(0, SCREEN_HEIGHT - 12, SCREEN_WIDTH, 12);
  ui.text(status, 4, SCREEN_HEIGHT - 11, color);
}

/** Sunset sky, desert and a gushing derrick. Shared with the menus and the game over screen. */
export function drawDesert(ctx: CanvasRenderingContext2D, frame: number): void {
  ctx.drawImage(cached('desert', SCREEN_WIDTH, SCREEN_HEIGHT, paintDesert), 0, 0);
  gusher(ctx, RIG.x, RIG.base - RIG.height - 3, frame, 1.3);
}

function paintDesert(p: Pix): void {
  // Copper-style sunset.
  p.gradient(0, 0, SCREEN_WIDTH, HORIZON, [0x013, 0x124, 0x236, 0x437, 0x637, 0x946, 0xc54, 0xe75, 0xfa6, 0xfc8].map(amiga));
  // The sun, half set, with a dithered glow.
  const sun = { x: 92, y: HORIZON - 4, r: 22 };
  for (let y = sun.y - sun.r - 14; y < HORIZON; y++) {
    for (let x = sun.x - sun.r - 14; x <= sun.x + sun.r + 14; x++) {
      const d = Math.hypot(x - sun.x, (y - sun.y) * 1.1);
      if (d <= sun.r) p.px(x, y, d < sun.r - 3 ? amiga(0xffe) : amiga(0xfe9));
      else if (d < sun.r + 12 && hash(x, y) < (sun.r + 12 - d) / 18) p.px(x, y, amiga(0xfd8));
    }
  }
  // Distant mesas and rigs on the horizon.
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    const h = Math.max(0, Math.round(5 + 4 * Math.sin(x / 23) + 3 * Math.sin(x / 7.3) + (x > 150 && x < 200 ? 9 : 0)));
    p.vline(x, HORIZON - h, h, amiga(0x524));
  }
  for (const [x, h] of [[30, 18], [150, 22], [178, 14], [300, 16]] as const) derrick(p, x, HORIZON, h, SILHOUETTE);
  // Sand, hazy near the horizon, with ripples and stones.
  p.gradient(0, HORIZON, SCREEN_WIDTH, SCREEN_HEIGHT - HORIZON, [0xa65, 0xb75, 0xc85, 0xd96, 0xda7].map(amiga));
  for (let y = HORIZON + 3; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const ripple = Math.sin(x / 9 + y * 0.9 + Math.sin(x / 31) * 3);
      if (ripple > 0.93) p.px(x, y, amiga(0x954));
      else if (ripple < -0.97) p.px(x, y, amiga(0xeb8));
      if (hash(x, y, 3) < 0.004) p.px(x, y, amiga(0x643));
    }
  }
  // The rig in the foreground, its tanks and barrels.
  derrick(p, RIG.x, RIG.base, RIG.height, STEEL);
  for (let x = RIG.x - 40; x < RIG.x + 40; x++) p.hline(x, RIG.base + 1, 1, amiga(0x753));
  tank(p, 180, 222, 26, 22);
  tank(p, 152, 220, 20, 16);
  barrels(p, 286, 226, 4);
  p.hline(0, 236, 152, amiga(0x444));
  p.hline(0, 237, 152, amiga(0x222));
}
