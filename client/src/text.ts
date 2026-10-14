/**
 * Draws text with hard pixel edges by rendering it on a scratch canvas and
 * thresholding the alpha. Placeholder until we have a proper bitmap font.
 */
const scratch = document.createElement('canvas');
const sctx = scratch.getContext('2d', { willReadFrequently: true })!;

export function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 8,
  align: 'left' | 'center' = 'left',
): void {
  const font = `bold ${size}px monospace`;
  sctx.font = font;
  const w = Math.ceil(sctx.measureText(text).width) + 2;
  const h = size + 4;
  scratch.width = w;
  scratch.height = h;
  sctx.font = font;
  sctx.textBaseline = 'top';
  sctx.fillStyle = '#fff';
  sctx.fillText(text, 1, 1);

  const img = sctx.getImageData(0, 0, w, h);
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < img.data.length; i += 4) {
    const on = img.data[i + 3] > 110;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = on ? 255 : 0;
  }
  sctx.putImageData(img, 0, 0);
  const left = align === 'center' ? Math.round(x - w / 2) : x;
  ctx.drawImage(scratch, left, y);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
