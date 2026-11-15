// Small helpers for drawing "pixel art" with the canvas: every shape is built from whole-pixel
// rectangles, so nothing is smoothed and the browser can scale the picture up with crisp squares.

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rad = (deg: number) => (deg * Math.PI) / 180;

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** A filled circle made of one-pixel-tall rows, so its edge is a staircase like a sprite. */
export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy) + 0.5));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

/** A filled polygon, rasterised row by row with whole pixels (no anti-aliasing). */
export function fillPoly(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], color: string, checker = false) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  ctx.fillStyle = color;
  const xs: number[] = [];
  for (let y = Math.round(minY); y <= Math.round(maxY); y++) {
    const at = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= at && b[1] > at) || (b[1] <= at && a[1] > at)) xs.push(a[0] + ((at - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.round(xs[k]);
      const x1 = Math.round(xs[k + 1]);
      if (x1 <= x0) continue;
      if (!checker) {
        ctx.fillRect(x0, y, x1 - x0, 1);
      } else {
        // Every other pixel, like a see-through screen in an old game.
        for (let x = x0 + ((x0 + y) & 1); x < x1; x += 2) ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

const shadeCache = new Map<string, string>();

/** A colour made darker (factor < 1) or lighter (> 1), as a flat tone. */
export function shade(hex: string, factor: number): string {
  const key = `${hex}:${factor}`;
  const cached = shadeCache.get(key);
  if (cached) return cached;
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.min(255, Math.max(0, Math.round(((value >> shift) & 255) * factor)));
  const result = `rgb(${channel(16)},${channel(8)},${channel(0)})`;
  shadeCache.set(key, result);
  return result;
}
