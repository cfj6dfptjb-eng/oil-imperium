import { COMPANIES, GAME_TITLE, SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import type { App } from '../app.js';
import { PAL } from '../palette.js';
import { pixelText } from '../text.js';
import type { Ui } from '../ui.js';

const HORIZON = 176;

/** Title screen in the spirit of the original: copper sky, desert and a derrick. */
export function drawTitle(ui: Ui, app: App): void {
  const { ctx } = ui;
  const { conn, frame } = app;
  drawDesert(ctx, frame);

  // Title with a drop shadow.
  pixelText(ctx, GAME_TITLE.toUpperCase(), SCREEN_WIDTH / 2 + 1, 33, PAL.goldDark, 24, 'center');
  pixelText(ctx, GAME_TITLE.toUpperCase(), SCREEN_WIDTH / 2, 32, PAL.gold, 24, 'center');
  pixelText(ctx, 'ONLINE EDITION', SCREEN_WIDTH / 2, 60, PAL.white, 8, 'center');

  COMPANIES.forEach((name, i) => {
    pixelText(ctx, name, 24, 96 + i * 12, PAL.white, 8);
  });

  if (Math.floor(frame / 30) % 2 === 0) {
    pixelText(ctx, 'CLICK TO START', SCREEN_WIDTH / 2, 200, PAL.black, 8, 'center');
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
  pixelText(ctx, status, 4, SCREEN_HEIGHT - 11, color, 8);
}

/** Copper-bar sky, desert and an animated gusher. Shared with the game over screen. */
export function drawDesert(ctx: CanvasRenderingContext2D, frame: number): void {
  const band = Math.ceil(HORIZON / PAL.sky.length);
  PAL.sky.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * band, SCREEN_WIDTH, band);
  });

  ctx.fillStyle = PAL.sand;
  ctx.fillRect(0, HORIZON, SCREEN_WIDTH, SCREEN_HEIGHT - HORIZON);
  ctx.fillStyle = PAL.sandDark;
  for (let y = HORIZON + 4; y < SCREEN_HEIGHT; y += 6) {
    for (let x = (y * 7) % 13; x < SCREEN_WIDTH; x += 13) ctx.fillRect(x, y, 3, 1);
  }

  drawDerrick(ctx, 236, HORIZON, 96, frame);
}

export function drawDerrick(ctx: CanvasRenderingContext2D, cx: number, base: number, height: number, frame = 0, gusher = true): void {
  ctx.fillStyle = PAL.derrick;
  const halfBase = Math.round(height / 5);
  // Two legs tapering to the top, with cross braces.
  for (let y = 0; y < height; y++) {
    const half = Math.round(halfBase * (1 - y / height)) + 2;
    ctx.fillRect(cx - half, base - y, 2, 1);
    ctx.fillRect(cx + half - 1, base - y, 2, 1);
    if (y % Math.max(4, Math.round(height / 6)) === 0) ctx.fillRect(cx - half, base - y, half * 2 + 1, 1);
  }
  ctx.fillRect(cx - 3, base - height - 3, 8, 3);

  if (!gusher) return;
  const spray = 3 + (frame % 8 < 4 ? 1 : 0);
  ctx.fillStyle = PAL.black;
  for (let i = 0; i < spray; i++) {
    ctx.fillRect(cx - i * 3, base - height - 7 - i * 4, 2 + i * 6, 3);
  }
}
