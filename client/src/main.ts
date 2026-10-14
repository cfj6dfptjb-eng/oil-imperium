import { MAX_NAME_LENGTH, SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import type { App } from './app.js';
import { Connection } from './connection.js';
import { Online } from './online.js';
import { isFinished } from './session.js';
import { drawJoin, drawLobby, drawMenu } from './screens/menu.js';
import { drawAgent } from './screens/agent.js';
import { drawBank } from './screens/bank.js';
import { drawContracts } from './screens/contracts.js';
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

const NAME_KEY = 'oil-imperium-name';
function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? 'PLAYER';
  } catch {
    return 'PLAYER';
  }
}
function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage blocked: the name just isn't remembered.
  }
}

/** Room code from an invite link such as ?room=ABCD (any letter case, since the lobby shows it in capitals). */
function inviteCode(): string {
  for (const [key, value] of new URLSearchParams(location.search)) {
    if (key.toLowerCase() === 'room') return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  }
  return '';
}

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const conn = new Connection(wsUrl);
const app: App = {
  screen: 'title',
  conn,
  online: new Online(conn, () => app.playerName),
  frame: 0,
  seenMonth: 0,
  setup: { company: 'Interoil', goal: 'timeLimit' },
  playerName: loadName(),
  joinCode: inviteCode(),
};
conn.onMessage = (msg) => app.online.handle(msg);

// Typing: the player name on the menu, the room code on the join screen.
addEventListener('keydown', (e) => {
  const key = e.key.toUpperCase();
  if (app.screen === 'menu') {
    if (e.key === 'Backspace') app.playerName = app.playerName.slice(0, -1);
    else if (/^[A-Z0-9 ]$/.test(key) && app.playerName.length < MAX_NAME_LENGTH) app.playerName += key;
    else return;
    saveName(app.playerName);
    e.preventDefault();
  } else if (app.screen === 'join') {
    if (e.key === 'Backspace') app.joinCode = app.joinCode.slice(0, -1);
    else if (/^[A-Z]$/.test(key) && app.joinCode.length < 4) app.joinCode += key;
    else return;
    e.preventDefault();
  }
});

const screens: Record<App['screen'], (ui: Ui, app: App) => void> = {
  title: drawTitle,
  menu: drawMenu,
  join: drawJoin,
  lobby: drawLobby,
  setup: drawSetup,
  office: drawOffice,
  world: drawWorld,
  region: drawRegion,
  market: drawMarket,
  contracts: drawContracts,
  agent: drawAgent,
  bank: drawBank,
  report: drawReport,
  gameover: drawGameOver,
};

const GAME_SCREENS: App['screen'][] = ['office', 'world', 'region', 'market', 'contracts', 'agent', 'bank', 'report'];

/** Moves between screens when the game itself changes: it starts, a month passes, or it ends. */
function followGame(): void {
  // An online game has started (or was resumed): go to the office.
  if (app.screen === 'lobby' && app.online.view) {
    app.game = app.online;
    app.seenMonth = app.online.view.month;
    app.screen = isFinished(app.online.view) ? 'gameover' : 'office';
    return;
  }
  const view = app.game?.view;
  if (!view || !GAME_SCREENS.includes(app.screen)) return;
  if (isFinished(view)) {
    app.screen = 'gameover';
  } else if (view.month !== app.seenMonth) {
    app.seenMonth = view.month;
    app.screen = 'report';
  }
}

function loop(): void {
  followGame();
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
