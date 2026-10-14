import { GLYPHS } from './art/font.js';

/**
 * Pixel text drawn from the bitmap font in art/font.ts. Strings are rendered
 * once per colour and scale onto a small canvas and cached. Light text gets a
 * one-pixel drop shadow so it stays readable on detailed backgrounds.
 */
const cache = new Map<string, HTMLCanvasElement>();

export interface TextStyle {
  /** Whole-number pixel scale: 1 for normal text, 2 or 3 for headings. */
  scale?: number;
  /** Shadow colour, or null for none. Defaults to black under light text. */
  shadow?: string | null;
  /** Optional second colour: rows fade from `color` at the top to this at the bottom. */
  fade?: string;
}

const SPACING = 1;

function glyph(ch: string): string[] {
  return GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS['?'];
}

/** Width in screen pixels of a string at scale 1. */
function rawWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += glyph(ch)[0].length + SPACING;
  return Math.max(0, w - SPACING);
}

function render(text: string, color: string, style: Required<TextStyle>): HTMLCanvasElement {
  const { scale, shadow, fade } = style;
  const key = `${scale}|${color}|${shadow}|${fade}|${text}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const off = shadow ? scale : 0;
  canvas.width = Math.max(1, rawWidth(text) * scale + off);
  canvas.height = 8 * scale + off;
  const ctx = canvas.getContext('2d')!;
  const rows = fade ? fadeColors(color, fade, 7) : null;

  const draw = (dx: number, dy: number, solid: string | null) => {
    let x = 0;
    for (const ch of text) {
      const g = glyph(ch);
      g.forEach((row, y) => {
        ctx.fillStyle = solid ?? rows?.[Math.min(y, 6)] ?? color;
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '#') ctx.fillRect(dx + (x + i) * scale, dy + y * scale, scale, scale);
        }
      });
      x += g[0].length + SPACING;
    }
  };
  if (shadow) draw(off, off, shadow);
  draw(0, 0, null);

  if (cache.size > 3000) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

function resolve(color: string, style: TextStyle): Required<TextStyle> {
  return {
    scale: style.scale ?? 1,
    shadow: style.shadow === undefined ? (isLight(color) ? '#000000' : null) : style.shadow,
    fade: style.fade ?? '',
  };
}

export function textWidth(text: string, scale = 1): number {
  return rawWidth(text) * scale;
}

export function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
  style: TextStyle = {},
): void {
  const resolved = resolve(color, style);
  const img = render(text, color, resolved);
  const w = textWidth(text, resolved.scale);
  const left = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
  // Glyphs sit one pixel below y, matching the layout the screens were built on.
  ctx.drawImage(img, left, y + resolved.scale);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 110;
}

/** Colours for each glyph row, stepping from one colour to another like an Amiga copper fade. */
function fadeColors(from: string, to: string, steps: number): string[] {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return '#' + a.map((c, k) => Math.round(c + (b[k] - c) * t).toString(16).padStart(2, '0')).join('');
  });
}
