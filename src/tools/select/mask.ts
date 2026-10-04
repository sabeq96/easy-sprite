import { rectClamp, rectIsEmpty, type Rect } from "@/lib/rect";
import type { ToolPoint } from "@/framework/tool";

/** A Selection: its bounding rectangle plus one flag per pixel inside it, row by row. */
export interface Mask {
  rect: Rect;
  bits: Uint8Array;
}

export function maskHas(mask: Mask, x: number, y: number): boolean {
  const { rect } = mask;
  if (x < rect.x || y < rect.y || x >= rect.x + rect.w || y >= rect.y + rect.h) return false;
  return mask.bits[(y - rect.y) * rect.w + (x - rect.x)] === 1;
}

/** The same shape somewhere else. */
export function maskMoved(mask: Mask, x: number, y: number): Mask {
  return { rect: { ...mask.rect, x, y }, bits: mask.bits };
}

/** The part of the mask on the canvas, trimmed; null when nothing is left. */
export function maskClamped(mask: Mask, width: number, height: number): Mask | null {
  const box = rectClamp(mask.rect, width, height);
  if (rectIsEmpty(box)) return null;
  const bits = new Uint8Array(box.w * box.h);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      bits[y * box.w + x] = maskHas(mask, box.x + x, box.y + y) ? 1 : 0;
    }
  }
  return trimmed({ rect: box, bits });
}

/** Clamped to the canvas; null when nothing is left. */
export function maskFromRect(rect: Rect, width: number, height: number): Mask | null {
  const clamped = rectClamp(rect, width, height);
  if (rectIsEmpty(clamped)) return null;
  return { rect: clamped, bits: new Uint8Array(clamped.w * clamped.h).fill(1) };
}

/**
 * Every pixel the path touches, joined by straight lines and closed back to its start, plus
 * everything inside it (even-odd). Clamped to the canvas and trimmed; null when nothing is left.
 */
export function maskFromPath(
  path: readonly ToolPoint[],
  width: number,
  height: number,
): Mask | null {
  if (path.length === 0) return null;

  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  const box = rectClamp(
    {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs) + 1,
      h: Math.max(...ys) - Math.min(...ys) + 1,
    },
    width,
    height,
  );
  if (rectIsEmpty(box)) return null;

  const bits = new Uint8Array(box.w * box.h);
  const set = (x: number, y: number) => {
    if (x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h) {
      bits[(y - box.y) * box.w + (x - box.x)] = 1;
    }
  };

  const edges = path.map((from, i) => [from, path[(i + 1) % path.length]] as const);
  for (const [from, to] of edges) traceLine(from, to, set);

  // Even-odd fill, sampling each pixel at its centre.
  for (let y = box.y; y < box.y + box.h; y++) {
    const crossings: number[] = [];
    for (const [from, to] of edges) {
      if (from.y === to.y || y < Math.min(from.y, to.y) || y >= Math.max(from.y, to.y)) continue;
      crossings.push(from.x + ((y - from.y) / (to.y - from.y)) * (to.x - from.x));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      for (let x = Math.ceil(crossings[i] - 1e-9); x < crossings[i + 1] - 1e-9; x++) set(x, y);
    }
  }

  return trimmed({ rect: box, bits });
}

/** Bresenham: every pixel from `from` to `to`, both included. */
function traceLine(from: ToolPoint, to: ToolPoint, visit: (x: number, y: number) => void): void {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;
  let { x, y } = from;
  for (;;) {
    visit(x, y);
    if (x === to.x && y === to.y) return;
    const doubled = 2 * error;
    if (doubled > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubled < dx) {
      error += dx;
      y += stepY;
    }
  }
}

function trimmed(mask: Mask): Mask | null {
  const { rect, bits } = mask;
  let minX = rect.w, minY = rect.h, maxX = -1, maxY = -1;
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      if (!bits[y * rect.w + x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    out.set(bits.subarray((minY + y) * rect.w + minX, (minY + y) * rect.w + minX + w), y * w);
  }
  return { rect: { x: rect.x + minX, y: rect.y + minY, w, h }, bits: out };
}
