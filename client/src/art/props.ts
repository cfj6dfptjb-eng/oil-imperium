import { amiga, type Pix } from './pix.js';

export const STEEL = { light: amiga(0xbbc), mid: amiga(0x889), dark: amiga(0x445), outline: amiga(0x112) };
export const SILHOUETTE = { light: amiga(0x213), mid: amiga(0x213), dark: amiga(0x213), outline: amiga(0x213) };
export type Metal = typeof STEEL;

/** A lattice drilling derrick standing on `base`, centred on `cx`. */
export function derrick(p: Pix, cx: number, base: number, height: number, m: Metal = STEEL): void {
  const half = Math.max(3, Math.round(height / 4.5));
  const top = base - height;
  const at = (y: number) => Math.round(2 + (half - 2) * ((y - top) / height));
  // Cross bracing between levels.
  const levels = Math.max(3, Math.round(height / 9));
  for (let l = 0; l < levels; l++) {
    const y0 = Math.round(top + (height * l) / levels);
    const y1 = Math.round(top + (height * (l + 1)) / levels);
    p.hline(cx - at(y0), y0, at(y0) * 2 + 1, m.mid);
    if (height >= 24) {
      p.line(cx - at(y0), y0, cx + at(y1), y1, m.dark);
      p.line(cx + at(y0), y0, cx - at(y1), y1, m.dark);
    }
  }
  // Legs: lit on the left, in shadow on the right.
  for (let y = top; y <= base; y++) {
    const w = at(y);
    p.px(cx - w, y, m.light);
    p.px(cx - w - 1, y, m.outline);
    p.px(cx + w, y, m.dark);
    p.px(cx + w + 1, y, m.outline);
  }
  // Crown block and drill floor.
  p.rect(cx - 3, top - 3, 7, 3, m.mid);
  p.hline(cx - 3, top - 3, 7, m.light);
  p.rect(cx - half - 3, base - 2, half * 2 + 7, 3, m.dark);
  p.hline(cx - half - 3, base - 2, half * 2 + 7, m.mid);
}

/** Oil storage tank: a cylinder with a lit side. */
export function tank(p: Pix, x: number, base: number, w: number, h: number): void {
  const light = amiga(0xddc);
  const mid = amiga(0xaa9);
  const dark = amiga(0x665);
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    const c = t < 0.3 ? light : t < 0.75 ? mid : dark;
    p.vline(x + i, base - h, h, c);
  }
  p.hline(x, base - h, w, amiga(0xeee));
  p.hline(x, base - h + Math.round(h / 3), w, dark);
  p.hline(x, base - 1, w, amiga(0x332));
}

/** A row of oil barrels. */
export function barrels(p: Pix, x: number, base: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const bx = x + i * 6;
    p.rect(bx, base - 8, 5, 8, amiga(0x237));
    p.vline(bx, base - 8, 8, amiga(0x48a));
    p.vline(bx + 4, base - 8, 8, amiga(0x124));
    p.hline(bx, base - 6, 5, amiga(0x124));
    p.hline(bx, base - 3, 5, amiga(0x124));
  }
}

/** Animated parts drawn straight onto the screen each frame. */
export function gusher(ctx: CanvasRenderingContext2D, cx: number, top: number, frame: number, size = 1): void {
  const black = amiga(0x000);
  const sheen = amiga(0x446);
  const height = Math.round(30 * size);
  const crown = top - height;
  ctx.fillStyle = black;
  ctx.fillRect(cx - 1, crown, 3, height);
  // Oil arcs out of the top of the column and rains back down.
  for (let i = 0; i < 70; i++) {
    const phase = ((frame * 0.7 + i * 13.7) % 40) / 40;
    const side = i % 2 ? 1 : -1;
    const speed = 0.25 + ((i * 7) % 10) / 12;
    const x = cx + side * speed * phase * 26 * size;
    const y = crown - 4 * size + (phase * phase * 70 - phase * 18) * size;
    if (y > top + 40 * size) continue;
    ctx.fillStyle = i % 6 === 0 ? sheen : black;
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
}

/**
 * A nodding pumpjack, drawn each frame so the beam rocks. `x` is the left of
 * its base, `base` the ground line; it is about 22 pixels wide and 14 tall.
 */
export function pumpjack(ctx: CanvasRenderingContext2D, x: number, base: number, frame: number, running = true, rusty = false): void {
  const body = rusty ? amiga(0x743) : amiga(0x222);
  const beamC = rusty ? amiga(0x965) : amiga(0x555);
  const head = rusty ? amiga(0x854) : amiga(0xd80);
  const angle = running ? Math.sin(frame / 14) * 0.35 : 0.2;
  // Base and A-frame.
  ctx.fillStyle = body;
  ctx.fillRect(x, base - 2, 22, 2);
  ctx.fillRect(x + 9, base - 10, 2, 8);
  ctx.fillRect(x + 12, base - 10, 2, 8);
  // Beam pivoting at (x+11, base-11).
  const px = x + 11;
  const py = base - 11;
  ctx.fillStyle = beamC;
  for (let i = -9; i <= 8; i++) {
    ctx.fillRect(Math.round(px + i * Math.cos(angle)), Math.round(py - i * Math.sin(angle)), 1, 2);
  }
  // Horse head on the left end, counterweight on the right.
  const hx = Math.round(px - 9 * Math.cos(angle));
  const hy = Math.round(py + 9 * Math.sin(angle));
  ctx.fillStyle = head;
  ctx.fillRect(hx - 2, hy - 1, 3, 5);
  ctx.fillStyle = body;
  ctx.fillRect(hx - 1, hy + 4, 1, base - hy - 5);
  const cx = Math.round(px + 7 * Math.cos(angle));
  const cy = Math.round(py - 7 * Math.sin(angle));
  ctx.fillRect(cx - 1, cy + 1, 3, 4);
  ctx.fillRect(x + 17, base - 6, 3, 4);
}

/** Flickering flames and smoke over a burning well. */
export function flames(ctx: CanvasRenderingContext2D, cx: number, base: number, frame: number, size = 1): void {
  const colors = [amiga(0xf20), amiga(0xf80), amiga(0xfd2), amiga(0xffe)];
  const smoke = [amiga(0x333), amiga(0x444), amiga(0x222)];
  for (let i = 0; i < 6; i++) {
    const y = base - 18 * size - ((i * 5 + frame / 3) % 14) * size;
    ctx.fillStyle = smoke[i % 3];
    const r = Math.round((2 + i) * size);
    ctx.fillRect(Math.round(cx - r + Math.sin(frame / 10 + i) * 3), Math.round(y - i * 3 * size), r * 2, r);
  }
  for (let i = 0; i < 9; i++) {
    const h = Math.round((6 + ((i * 7 + Math.floor(frame / 4)) % 6) * 2) * size);
    const x = Math.round(cx + (i - 4) * 1.5 * size);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = colors[k];
      const hh = Math.round(h * (1 - k * 0.25));
      ctx.fillRect(x, base - hh, Math.max(1, Math.round(1.5 * size)), hh);
    }
  }
}
