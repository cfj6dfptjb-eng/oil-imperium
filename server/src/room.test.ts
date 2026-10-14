import { describe, expect, it } from 'vitest';
import { Room } from './room.js';

const always = () => true;

function lobby() {
  const { room, token: host } = Room.create('ABCD', 'HOST');
  const guest = room.join('GUEST');
  if ('error' in guest) throw new Error(guest.error);
  return { room, host, guest: guest.token };
}

describe('Room lobby', () => {
  it('seats the host and the next player automatically', () => {
    const { room, host, guest } = lobby();
    expect(room.companyOf(host)).toBe('Interoil');
    expect(room.companyOf(guest)).toBe('All American');
    const info = room.info(guest, always);
    expect(info).toMatchObject({ code: 'ABCD', you: 'All American', host: false, started: false });
    expect(info.seats.map((s) => s.player)).toEqual(['HOST', 'GUEST', null, null]);
  });

  it('lets players swap to a free company but not a taken one', () => {
    const { room, host, guest } = lobby();
    expect(room.takeSeat(guest, 'Interoil')).toBe('Another player has that company');
    expect(room.takeSeat(guest, 'Transoil')).toBeNull();
    expect(room.companyOf(guest)).toBe('Transoil');
    expect(room.data.seats.find((s) => s.company === 'All American')!.token).toBeNull();
    expect(room.takeSeat(host, 'All American')).toBeNull();
  });

  it('recognises a returning player by token', () => {
    const { room, guest } = lobby();
    expect(room.join('WHOEVER', guest)).toEqual({ token: guest });
    expect(room.data.members).toHaveLength(2);
  });

  it('only lets the host change the goal and start', () => {
    const { room, host, guest } = lobby();
    expect(room.setGoal(guest, 'money')).toBe('Only the host can change the goal');
    expect(room.setGoal(host, 'money')).toBeNull();
    expect(room.start(guest)).toBe('Only the host can start the game');
    expect(room.start(host, 1)).toBeNull();
    expect(room.data.state!.config.goal).toBe('money');
    expect(room.join('LATE')).toEqual({ error: 'This game has already started' });
  });

  it('hands the host role on when the host leaves the lobby', () => {
    const { room, host, guest } = lobby();
    room.leave(host);
    expect(room.data.hostToken).toBe(guest);
    expect(room.companyOf(host)).toBeNull();
  });
});

describe('Room game', () => {
  it('lets computers play at once and waits for every human', () => {
    const { room, host, guest } = lobby();
    room.start(host, 1);
    expect(room.waitingFor()).toEqual(['Interoil', 'All American']);

    expect(room.act(host, { type: 'endTurn' })).toBeNull();
    expect(room.waitingFor()).toEqual(['All American']);
    expect(room.data.state!.month).toBe(0);

    expect(room.act(guest, { type: 'endTurn' })).toBeNull();
    expect(room.data.state!.month).toBe(1);
    expect(room.waitingFor()).toEqual(['Interoil', 'All American']);
  });

  it('reports rule errors and refuses outsiders', () => {
    const { room, host } = lobby();
    room.start(host, 1);
    expect(room.act(host, { type: 'sellOil', region: 'Europe', barrels: 1 })).toBe('Not enough oil in storage');
    expect(room.act('nobody', { type: 'endTurn' })).toBe('You are not playing in this game');
  });

  it('sends each player only their own view', () => {
    const { room, host, guest } = lobby();
    room.start(host, 1);
    const msg = room.gameMessage(guest);
    expect(msg).toMatchObject({ type: 'game', waitingFor: ['Interoil', 'All American'] });
    if (msg?.type !== 'game') throw new Error('expected a game message');
    expect(msg.view.you.company).toBe('All American');
    expect(msg.view.rivals.map((r) => r.company)).toEqual(['Interoil', 'Transoil', 'Explora Inc.']);
  });

  it('stops when every human is bankrupt instead of playing on forever', () => {
    const { room, host, guest } = lobby();
    room.start(host, 1);
    for (const p of room.data.state!.players.slice(0, 2)) {
      p.cash = 0;
      p.debt = 10_000_000;
    }
    room.act(host, { type: 'endTurn' });
    room.act(guest, { type: 'endTurn' });
    expect(room.data.state!.month).toBe(1);
    expect(room.waitingFor()).toEqual([]);
  });
});
