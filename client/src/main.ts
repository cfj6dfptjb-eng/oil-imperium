import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import { Connection } from './connection.js';
import { drawTitle } from './title.js';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

/** Scale the 320x256 screen by the largest whole number that fits the window. */
function fit(): void {
  const scale = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_WIDTH, innerHeight / SCREEN_HEIGHT)));
  canvas.style.width = `${SCREEN_WIDTH * scale}px`;
  canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
}
addEventListener('resize', fit);
fit();

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const conn = new Connection(wsUrl);

let frame = 0;
function loop(): void {
  drawTitle(ctx, conn, frame++);
  requestAnimationFrame(loop);
}
loop();
