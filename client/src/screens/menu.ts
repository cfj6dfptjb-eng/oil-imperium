import { GAME_TITLE, GOALS, SCREEN_WIDTH, type VictoryGoal } from '@oil/shared';
import type { App } from '../app.js';
import { loadSavedRoom } from '../online.js';
import { COMPANY_COLORS, PAL } from '../palette.js';
import type { Ui } from '../ui.js';
import { FOOTER_Y } from './hud.js';
import { drawDesert } from './title.js';

const GOAL_LABELS: Record<VictoryGoal, string> = {
  timeLimit: '3 YEARS',
  survival: 'SURVIVAL',
  marketShare: '80% MARKET',
  money: '$60 MILLION',
};

/** The desert from the title screen, dimmed, with a heading. Shared with the setup screen. */
export function menuBackground(ui: Ui, frame: number, title: string): void {
  drawDesert(ui.ctx, frame);
  ui.ctx.fillStyle = 'rgba(0, 0, 16, 0.55)';
  ui.ctx.fillRect(0, 0, SCREEN_WIDTH, 256);
  ui.panel(8, 27, SCREEN_WIDTH - 16, 205, 'rgba(0, 17, 51, 0.85)');
  ui.ctx.fillStyle = PAL.black;
  ui.ctx.fillRect(0, FOOTER_Y, SCREEN_WIDTH, 256 - FOOTER_Y);
  ui.big(title, SCREEN_WIDTH / 2, 10, PAL.gold, 'center');
}

function serverLine(ui: Ui, app: App): void {
  const { conn } = app;
  const text = conn.state === 'online' ? 'SERVER ONLINE' : conn.state === 'connecting' ? 'CONNECTING...' : 'SERVER OFFLINE';
  ui.text(text, 4, FOOTER_Y + 2, conn.state === 'online' ? PAL.green : conn.state === 'offline' ? PAL.red : PAL.white);
}

function cursor(app: App): string {
  return Math.floor(app.frame / 20) % 2 ? '_' : ' ';
}

/** Main menu: your name, then single player or an online game. */
export function drawMenu(ui: Ui, app: App): void {
  menuBackground(ui, app.frame, GAME_TITLE.toUpperCase());
  const online = app.conn.state === 'online';

  ui.text('YOUR NAME (TYPE TO CHANGE)', SCREEN_WIDTH / 2, 44, PAL.greyLight, 'center');
  ui.panel(90, 56, 140, 14, PAL.black);
  ui.text(app.playerName + cursor(app), 96, 59, PAL.gold);

  const x = SCREEN_WIDTH / 2 - 75;
  ui.button(x, 90, 'SINGLE PLAYER', () => (app.screen = 'setup'), { w: 150 });
  ui.button(x, 110, 'HOST ONLINE GAME', () => {
    app.online.create();
    app.screen = 'lobby';
  }, { w: 150, disabled: !online });
  ui.button(x, 130, 'JOIN ONLINE GAME', () => (app.screen = 'join'), { w: 150, disabled: !online });

  const saved = loadSavedRoom();
  if (saved) {
    ui.button(x, 160, `RESUME GAME ${saved.code}`, () => {
      app.online.join(saved.code, saved.token);
      app.screen = 'lobby';
    }, { w: 150, disabled: !online });
  }
  serverLine(ui, app);
}

/** Typing in a friend's room code. */
export function drawJoin(ui: Ui, app: App): void {
  menuBackground(ui, app.frame, 'JOIN GAME');
  ui.text('TYPE THE 4-LETTER GAME CODE', SCREEN_WIDTH / 2, 60, PAL.white, 'center');
  ui.panel(SCREEN_WIDTH / 2 - 40, 76, 80, 24, PAL.black);
  ui.big(app.joinCode + (app.joinCode.length < 4 ? cursor(app) : ''), SCREEN_WIDTH / 2, 80, PAL.gold, 'center');
  ui.button(SCREEN_WIDTH / 2 - 50, 120, 'JOIN', () => {
    app.online.join(app.joinCode);
    app.screen = 'lobby';
  }, { w: 100, disabled: app.joinCode.length !== 4 || app.conn.state !== 'online' });
  ui.button(SCREEN_WIDTH / 2 - 50, 140, 'BACK', () => (app.screen = 'menu'), { w: 100 });
  serverLine(ui, app);
}

/** The lobby: pick companies, set the goal, and the host starts the game. */
export function drawLobby(ui: Ui, app: App): void {
  const { online } = app;
  const room = online.room;
  menuBackground(ui, app.frame, room ? `GAME ${room.code}` : 'ONLINE GAME');
  const leave = () => {
    online.leave();
    app.screen = 'menu';
  };

  if (!room) {
    ui.text(online.error ? online.error.toUpperCase() : 'CONNECTING...', SCREEN_WIDTH / 2, 70, online.error ? PAL.red : PAL.white, 'center');
    ui.button(SCREEN_WIDTH / 2 - 50, 100, 'BACK', leave, { w: 100 });
    serverLine(ui, app);
    return;
  }

  ui.text('GIVE FRIENDS THIS CODE OR LINK:', SCREEN_WIDTH / 2, 30, PAL.greyLight, 'center');
  ui.text(`${location.host}/?room=${room.code}`.toUpperCase(), SCREEN_WIDTH / 2, 40, PAL.white, 'center');

  ui.text('COMPANIES', 14, 58, PAL.gold);
  room.seats.forEach((seat, i) => {
    const y = 70 + i * 16;
    const mine = seat.company === room.you;
    ui.text(seat.company.toUpperCase(), 14, y + 2, COMPANY_COLORS[seat.company]);
    const who = seat.player ? seat.player + (mine ? ' (YOU)' : '') + (seat.connected ? '' : ' (AWAY)') : 'COMPUTER';
    ui.text(who, 130, y + 2, seat.player ? PAL.white : PAL.grey);
    if (!seat.player) ui.button(262, y, 'TAKE', () => online.takeSeat(seat.company), { w: 46 });
  });

  ui.text('GOAL', 14, 138, PAL.gold);
  if (room.host) {
    GOALS.forEach((goal, i) => {
      const selected = room.goal === goal;
      ui.button(14 + (i % 2) * 150, 150 + Math.floor(i / 2) * 15, (selected ? '> ' : '') + GOAL_LABELS[goal], () => online.setGoal(goal), {
        w: 140,
        color: selected ? PAL.redDark : PAL.black,
      });
    });
    ui.button(SCREEN_WIDTH / 2 - 60, 192, 'START GAME', () => online.start(), { w: 120, disabled: !room.you });
  } else {
    ui.text(GOAL_LABELS[room.goal], 60, 138, PAL.white);
    ui.text('WAITING FOR THE HOST TO START...', SCREEN_WIDTH / 2, 170, PAL.greyLight, 'center');
  }
  ui.button(SCREEN_WIDTH / 2 - 60, 212, 'LEAVE', leave, { w: 120 });

  if (online.error) ui.text(online.error.toUpperCase(), 4, FOOTER_Y + 2, PAL.red);
  else ui.text('EMPTY SEATS ARE PLAYED BY THE COMPUTER', 4, FOOTER_Y + 2, PAL.grey);
}

