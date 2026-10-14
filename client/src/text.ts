/**
 * Text with hard pixel edges: rendered once on a scratch canvas, thresholded to
 * one colour and cached. Placeholder until we have a proper bitmap font.
 */
const cache = new Map<string, HTMLCanvasElement>();

function render(text: string, color: string, size: number): HTMLCanvasElement {
  const key = `${size}|${color}|${text}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const font = `bold ${size}px monospace`;
  ctx.font = font;
  canvas.width = Math.max(1, Math.ceil(ctx.measureText(text).width) + 2);
  canvas.height = size + 4;
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 1, 1);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < img.data.length; i += 4) {
    const on = img.data[i + 3] > 110;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  if (cache.size > 2000) cache.clear();
  cache.set(key, canvas);
  return canvas;
}

export function textWidth(text: string, size = 8): number {
  return render(text, '#ffffff', size).width;
}

export function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 8,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const img = render(text, color, size);
  const left = align === 'center' ? Math.round(x - img.width / 2) : align === 'right' ? x - img.width : x;
  ctx.drawImage(img, left, y);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
