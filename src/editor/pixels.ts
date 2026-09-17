import { getPixel, setPixel } from "@/editor/buffer";
import type { RGBA } from "@/lib/color";
import { rectUnion, type Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";

export interface PlotTarget {
  buffer: PixelBuffer;
  width: number;
  height: number;
}

/** Per-pixel write callback — lets brushes, lines and fills share one write path. */
export type PixelWriter = (x: number, y: number) => void;

/**
 * Square brush, top-left biased for even sizes (what Piskel and every other pixel editor do).
 * size 1 → [x]; size 2 → [x, x+1]; size 3 → [x-1, x+1]; size 4 → [x-1, x+2].
 */
export function brushBounds(x: number, y: number, size: number): Rect {
  const offset = Math.floor((size - 1) / 2);
  return { x: x - offset, y: y - offset, w: size, h: size };
}

export function forEachBrushPixel(
  x: number,
  y: number,
  size: number,
  write: PixelWriter,
): void {
  const bounds = brushBounds(x, y, size);
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) write(bounds.x + dx, bounds.y + dy);
  }
}

/** Bresenham — pointer events are sampled, so consecutive points must be joined. */
export function forEachLinePixel(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  write: PixelWriter,
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  for (;;) {
    write(x, y);
    if (x === x1 && y === y1) return;

    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

/** Max-channel distance. */
export function colorDistance(a: RGBA, b: RGBA): number {
  return Math.max(
    Math.abs(a.r - b.r),
    Math.abs(a.g - b.g),
    Math.abs(a.b - b.b),
    Math.abs(a.a - b.a),
  );
}

export interface FillOptions {
  /** false = replace the matching colour across the whole layer ("fill similar"). */
  contiguous?: boolean;
  /** Restricts the fill to a selection mask, when one exists. */
  mask?: Uint8Array | null;
}

/**
 * Scan-line flood fill. Iterative — a recursive fill on a 128×128 canvas blows the stack —
 * and backed by a visited bitmap so no pixel is colour-tested twice.
 */
export function floodFill(
  target: PlotTarget,
  startX: number,
  startY: number,
  color: RGBA,
  options: FillOptions = {},
): Rect | null {
  const { buffer, width, height } = target;
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null;
  if (options.mask && options.mask[startY * width + startX] === 0) return null;

  const contiguous = options.contiguous ?? true;
  const seed = getPixel(buffer, startX, startY, width);

  // Filling with the colour already there would record an empty undo step.
  if (colorDistance(seed, color) === 0) return null;

  const matches = (x: number, y: number) => {
    if (options.mask && options.mask[y * width + x] === 0) return false;
    return colorDistance(getPixel(buffer, x, y, width), seed) === 0;
  };

  let dirty: Rect | null = null;
  const paint = (x: number, y: number) => {
    setPixel(buffer, x, y, width, color);
    dirty = rectUnion(dirty, { x, y, w: 1, h: 1 });
  };

  if (!contiguous) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) if (matches(x, y)) paint(x, y);
    }
    return dirty;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];

  while (stack.length) {
    const y = stack.pop()!;
    const seedX = stack.pop()!;
    if (visited[y * width + seedX]) continue;

    // Walk out to both ends of this span.
    let left = seedX;
    while (left > 0 && !visited[y * width + left - 1] && matches(left - 1, y)) left--;
    let right = seedX;
    while (right < width - 1 && !visited[y * width + right + 1] && matches(right + 1, y)) right++;

    for (let x = left; x <= right; x++) {
      visited[y * width + x] = 1;
      paint(x, y);

      // Seed the rows above and below this span.
      for (const neighbourY of [y - 1, y + 1]) {
        if (neighbourY < 0 || neighbourY >= height) continue;
        if (visited[neighbourY * width + x]) continue;
        if (matches(x, neighbourY)) stack.push(x, neighbourY);
      }
    }
  }

  return dirty;
}

export function pickColor(target: PlotTarget, x: number, y: number): RGBA | null {
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return null;
  return getPixel(target.buffer, x, y, target.width);
}
