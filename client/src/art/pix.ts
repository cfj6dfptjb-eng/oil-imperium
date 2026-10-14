/**
 * A small pixel canvas for drawing static artwork pixel by pixel: dithered
 * gradients, textures and shading in the style of 1980s Amiga paint
 * programs. Draw once, then turn it into a canvas and cache it.
 */
export class Pix {
  readonly data: Uint32Array;
  private readonly image: ImageData;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.image = new ImageData(w, h);
    this.data = new Uint32Array(this.image.data.buffer);
  }

  px(x: number, y: number, color: string | number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = typeof color === 'number' ? color : rgba(color);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    const c = rgba(color);
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) this.data[j * this.w + i] = c;
    }
  }

  /** Two-colour ordered dither: level 0 is all `a`, 16 is all `b`. */
  dither(x: number, y: number, w: number, h: number, a: string, b: string, level: number): void {
    const ca = rgba(a);
    const cb = rgba(b);
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
        this.data[j * this.w + i] = BAYER[(j & 3) * 4 + (i & 3)] < level ? cb : ca;
      }
    }
  }

  /** Dithered gradient through a list of colours, top to bottom (or left to right). */
  gradient(x: number, y: number, w: number, h: number, colors: string[], horizontal = false): void {
    const cs = colors.map(rgba);
    const span = horizontal ? w : h;
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
        const t = ((horizontal ? i - x : j - y) / Math.max(1, span - 1)) * (cs.length - 1);
        const k = Math.floor(t);
        const frac = t - k;
        const pick = BAYER[(j & 3) * 4 + (i & 3)] / 16 < frac ? Math.min(k + 1, cs.length - 1) : k;
        this.data[j * this.w + i] = cs[pick];
      }
    }
  }

  hline(x: number, y: number, w: number, color: string): void {
    this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: string): void {
    this.rect(x, y, 1, h, color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    const c = rgba(color);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) {
      this.px(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), c);
    }
  }

  /** Raised (or sunken) frame: light top and left edges, dark bottom and right. */
  bevel(x: number, y: number, w: number, h: number, light: string, dark: string, size = 1): void {
    for (let s = 0; s < size; s++) {
      this.hline(x + s, y + s, w - s * 2, light);
      this.vline(x + s, y + s, h - s * 2, light);
      this.hline(x + s, y + h - 1 - s, w - s * 2, dark);
      this.vline(x + w - 1 - s, y + s, h - s * 2, dark);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let j = -ry; j <= ry; j++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry || 1))));
      this.hline(cx - half, cy + j, half * 2 + 1, color);
    }
  }

  /** Draws a sprite given as rows of palette keys; '.' is transparent. */
  sprite(x: number, y: number, rows: string[], palette: Record<string, string>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = palette[row[i]];
        if (c) this.px(x + i, y + j, c);
      }
    });
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.getContext('2d')!.putImageData(this.image, 0, 0);
    return canvas;
  }
}

/** 4x4 ordered dither thresholds, 0 to 15. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const colorCache = new Map<string, number>();

/** '#rrggbb' as a little-endian RGBA pixel value. */
export function rgba(hex: string): number {
  let c = colorCache.get(hex);
  if (c === undefined) {
    const n = parseInt(hex.slice(1), 16);
    c = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
    colorCache.set(hex, c);
  }
  return c;
}

/** Repeatable pseudo-random value in [0, 1) for a pixel, for textures. */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Amiga-style 12-bit colour (each channel 0-15) as CSS hex. */
export function amiga(rgb: number): string {
  return '#' + [(rgb >> 8) & 0xf, (rgb >> 4) & 0xf, rgb & 0xf].map((c) => (c * 17).toString(16).padStart(2, '0')).join('');
}

const layers = new Map<string, HTMLCanvasElement>();

/** Draws a static layer once and reuses it every frame after that. */
export function cached(key: string, w: number, h: number, paint: (p: Pix) => void): HTMLCanvasElement {
  let canvas = layers.get(key);
  if (!canvas) {
    const p = new Pix(w, h);
    paint(p);
    canvas = p.toCanvas();
    layers.set(key, canvas);
  }
  return canvas;
}
