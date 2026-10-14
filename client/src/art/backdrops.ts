import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@oil/shared';
import { amiga, cached, hash, type Pix } from './pix.js';

/** Full-screen backgrounds behind the sub-screens, painted once and cached. */
export type Backdrop = 'desk' | 'marble' | 'alley' | 'newsprint';

export function drawBackdrop(ctx: CanvasRenderingContext2D, kind: Backdrop): void {
  ctx.drawImage(cached(`backdrop:${kind}`, SCREEN_WIDTH, SCREEN_HEIGHT, PAINTERS[kind]), 0, 0);
}

const PAINTERS: Record<Backdrop, (p: Pix) => void> = {
  desk: paintDesk,
  marble: paintMarble,
  alley: paintAlley,
  newsprint: paintNewsprint,
};

/** Polished mahogany seen from above, with long grain lines. */
function paintDesk(p: Pix): void {
  const tones = [0x310, 0x421, 0x531, 0x642, 0x742].map(amiga);
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const grain = Math.sin(y / 3 + Math.sin(x / 40 + y / 25) * 2.2 + Math.sin(x / 9) * 0.3);
      const n = hash(x >> 2, y, 1) * 0.6;
      const t = Math.max(0, Math.min(4, Math.floor((grain + 1) * 1.6 + n)));
      p.px(x, y, tones[t]);
    }
  }
  // Leather blotter edge for a bit of depth.
  p.dither(0, 0, SCREEN_WIDTH, 16, tones[1], tones[0], 8);
}

/** Green marble banking hall with gilded trim. */
function paintMarble(p: Pix): void {
  const tones = [0x132, 0x243, 0x354, 0x465, 0x8a9].map(amiga);
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const vein = Math.abs(Math.sin(x / 17 + y / 23 + Math.sin(y / 11 + x / 29) * 2.5));
      const t = vein < 0.03 ? 3 : hash(x >> 1, y >> 1, 2) < 0.5 ? 2 : 1;
      p.px(x, y, tones[t]);
    }
  }
  for (const x of [0, SCREEN_WIDTH - 22]) {
    // Fluted columns.
    for (let i = 0; i < 22; i++) {
      const c = i % 5 === 0 ? amiga(0x998) : i % 5 === 4 ? amiga(0x665) : amiga(0xccb);
      p.vline(x + i, 0, SCREEN_HEIGHT, c);
    }
  }
  p.rect(0, 12, SCREEN_WIDTH, 3, amiga(0xdb5));
  p.hline(0, 15, SCREEN_WIDTH, amiga(0x973));
}

/** Bricks lit by a single bare bulb: where the agent does business. */
function paintAlley(p: Pix): void {
  const bulb = { x: 250, y: 30 };
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const row = Math.floor(y / 6);
      const mortar = y % 6 === 5 || (x + (row % 2) * 8) % 16 === 15;
      const light = Math.max(0, 1 - Math.hypot(x - bulb.x, (y - bulb.y) * 0.8) / 190);
      const level = Math.min(16, Math.round(light * 22 + hash(x >> 1, y, 5) * 3));
      const lit = mortar ? amiga(0x433) : amiga(0x822);
      const dark = mortar ? amiga(0x111) : amiga(0x311);
      p.px(x, y, ditherPick(x, y, level) ? lit : dark);
    }
  }
  // Flex and bulb.
  p.vline(bulb.x, 0, bulb.y - 3, amiga(0x111));
  p.ellipse(bulb.x, bulb.y, 3, 4, amiga(0xffd));
  p.rect(bulb.x - 2, bulb.y - 6, 5, 3, amiga(0x555));
  // Floor.
  p.gradient(0, 214, SCREEN_WIDTH, SCREEN_HEIGHT - 214, [0x211, 0x111, 0x000].map(amiga));
}

/** Off-white newsprint with faint fibres. */
function paintNewsprint(p: Pix): void {
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) p.px(x, y, hash(x, y, 8) < 0.06 ? amiga(0xddc) : amiga(0xeed));
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function ditherPick(x: number, y: number, level: number): boolean {
  return BAYER[(y & 3) * 4 + (x & 3)] < level;
}

/** The agent: a man in a trench coat and fedora, face in shadow. */
export function paintAgent(p: Pix, cx: number, base: number): void {
  const coat = amiga(0x974);
  const coatLight = amiga(0xb96);
  const coatDark = amiga(0x642);
  const outline = amiga(0x100);
  // Coat, widening to the hem.
  for (let j = 0; j < 96; j++) {
    const y = base - 96 + j;
    const half = j < 10 ? 13 + j / 2 : 18 + j / 10;
    p.hline(Math.round(cx - half) - 1, y, Math.round(half * 2) + 3, outline);
    for (let i = -Math.round(half); i <= Math.round(half); i++) {
      const c = i < -half + 4 ? coatLight : i > half - 5 ? coatDark : coat;
      p.px(cx + i, y, c);
    }
  }
  // Lapels, belt, buttons and pockets.
  p.line(cx, base - 92, cx - 8, base - 70, coatDark);
  p.line(cx, base - 92, cx + 8, base - 70, coatDark);
  p.vline(cx, base - 70, 70, coatDark);
  p.rect(cx - 24, base - 52, 49, 4, coatDark);
  p.rect(cx - 3, base - 53, 7, 6, amiga(0xa86));
  for (const by of [base - 64, base - 40, base - 22]) p.px(cx + 3, by, outline);
  p.rect(cx - 17, base - 36, 9, 2, coatDark);
  p.rect(cx + 9, base - 36, 9, 2, coatDark);
  // Arms down the sides, hands in shadow.
  p.rect(cx - 25, base - 86, 6, 42, coatLight);
  p.rect(cx + 20, base - 86, 6, 42, coatDark);
  p.rect(cx - 25, base - 44, 6, 5, amiga(0x753));
  p.rect(cx + 20, base - 44, 6, 5, amiga(0x531));
  // Head, collar up, under a fedora.
  p.rect(cx - 7, base - 112, 15, 18, amiga(0xa76));
  p.rect(cx - 7, base - 112, 15, 7, amiga(0x312));
  p.rect(cx - 5, base - 104, 4, 2, amiga(0x000));
  p.rect(cx + 2, base - 104, 4, 2, amiga(0x000));
  p.hline(cx - 3, base - 99, 7, amiga(0x642));
  p.rect(cx - 12, base - 98, 25, 6, coatDark);
  p.rect(cx - 17, base - 115, 35, 4, amiga(0x333));
  p.hline(cx - 17, base - 115, 35, amiga(0x555));
  p.rect(cx - 10, base - 127, 21, 12, amiga(0x444));
  p.hline(cx - 10, base - 127, 21, amiga(0x666));
  p.rect(cx - 10, base - 119, 21, 3, amiga(0x711));
  // Cigarette glow.
  p.hline(cx + 4, base - 99, 5, amiga(0xeee));
  p.px(cx + 9, base - 99, amiga(0xf60));
  // Shadow on the ground.
  p.dither(cx - 30, base, 60, 4, amiga(0x110), amiga(0x000), 10);
}
