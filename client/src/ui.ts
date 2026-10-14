import { PAL } from './palette.js';
import { pixelText, textWidth } from './text.js';

interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
}

/**
 * Immediate-mode UI: screens redraw every frame and register clickable areas
 * as they draw. A click runs the hotspot under the mouse from the last frame.
 */
export class Ui {
  mouseX = -1;
  mouseY = -1;
  private hotspots: Hotspot[] = [];
  private pending: Hotspot[] = [];

  constructor(readonly ctx: CanvasRenderingContext2D) {}

  beginFrame(): void {
    this.pending = [];
  }

  endFrame(): void {
    this.hotspots = this.pending;
  }

  click(x: number, y: number): void {
    // Topmost (last drawn) wins.
    for (let i = this.hotspots.length - 1; i >= 0; i--) {
      const h = this.hotspots[i];
      if (inside(h, x, y)) {
        h.onClick();
        return;
      }
    }
  }

  hovering(x: number, y: number, w: number, h: number): boolean {
    return inside({ x, y, w, h }, this.mouseX, this.mouseY);
  }

  /** Registers a clickable area without drawing anything. */
  hotspot(x: number, y: number, w: number, h: number, onClick: () => void): boolean {
    this.pending.push({ x, y, w, h, onClick });
    return this.hovering(x, y, w, h);
  }

  /** Amiga Workbench style bevelled button. Width defaults to fit the label. */
  button(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    opts: { w?: number; disabled?: boolean; color?: string } = {},
  ): number {
    const w = opts.w ?? textWidth(label) + 8;
    const h = 12;
    const hover = !opts.disabled && this.hovering(x, y, w, h);
    const { ctx } = this;
    ctx.fillStyle = opts.disabled ? PAL.greyDark : hover ? PAL.greyLight : PAL.grey;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
    pixelText(ctx, label, x + w / 2, y + 1, opts.disabled ? PAL.grey : (opts.color ?? PAL.black), 8, 'center');
    if (!opts.disabled) this.pending.push({ x, y, w, h, onClick });
    return w;
  }

  panel(x: number, y: number, w: number, h: number, fill: string = PAL.blueDark): void {
    const { ctx } = this;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.grey;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  text(text: string, x: number, y: number, color: string = PAL.white, align: 'left' | 'center' | 'right' = 'left'): void {
    pixelText(this.ctx, text, x, y, color, 8, align);
  }

  big(text: string, x: number, y: number, color: string = PAL.gold, align: 'left' | 'center' | 'right' = 'left'): void {
    pixelText(this.ctx, text, x, y, color, 16, align);
  }
}

function inside(h: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h;
}
