import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import type { App } from './app.js';
import { Connection } from './connection.js';
import { drawBank } from './screens/bank.js';
import { drawMarket } from './screens/market.js';
import { drawOffice } from './screens/office.js';
import { drawRegion } from './screens/region.js';
import { drawGameOver, drawReport } from './screens/report.js';
import { drawSetup } from './screens/setup.js';
import { drawTitle } from './screens/title.js';
import { drawWorld } from './screens/world.js';
import { Ui } from './ui.js';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
const ui = new Ui(ctx);

let scale = 1;
/** Scale the 320x256 screen by the largest whole number that fits the window. */
function fit(): void {
  scale = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_WIDTH, innerHeight / SCREEN_HEIGHT)));
  canvas.style.width = `${SCREEN_WIDTH * scale}px`;
  canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
}
addEventListener('resize', fit);
fit();

function toScreen(e: MouseEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.floor(((e.clientX - rect.left) / rect.width) * SCREEN_WIDTH),
    Math.floor(((e.clientY - rect.top) / rect.height) * SCREEN_HEIGHT),
  ];
}
canvas.addEventListener('mousemove', (e) => {
  [ui.mouseX, ui.mouseY] = toScreen(e);
});
canvas.addEventListener('mouseleave', () => {
  ui.mouseX = ui.mouseY = -1;
});
canvas.addEventListener('click', (e) => {
  const [x, y] = toScreen(e);
  ui.click(x, y);
});

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const app: App = {
  screen: 'title',
  conn: new Connection(wsUrl),
  frame: 0,
  setup: { company: 'Interoil', goal: 'timeLimit' },
};

const screens: Record<App['screen'], (ui: Ui, app: App) => void> = {
  title: drawTitle,
  setup: drawSetup,
  office: drawOffice,
  world: drawWorld,
  region: drawRegion,
  market: drawMarket,
  bank: drawBank,
  report: drawReport,
  gameover: drawGameOver,
};

function loop(): void {
  ui.beginFrame();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  screens[app.screen](ui, app);
  ui.endFrame();
  app.frame++;
  requestAnimationFrame(loop);
}
// Handy for debugging in the browser console.
(window as unknown as { oil: App }).oil = app;
loop();
