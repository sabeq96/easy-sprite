import { forEachLinePixel, type PixelWriter } from "@/core/pixels";
import type { ToolPoint } from "@/framework/tool";

export type ShapeKind = "rectangle" | "ellipse" | "line";

/** tan(22.5°): below this slope a line snaps flat, above its inverse it snaps upright. */
const SNAP_SLOPE = Math.tan(Math.PI / 8);

/**
 * The end point Shift makes of `to`: a square box (rectangle, ellipse) anchored at `from` and
 * sized by the larger drag extent, or a line snapped to the nearest of 8 directions.
 */
export function constrain(kind: ShapeKind, from: ToolPoint, to: ToolPoint): ToolPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));

  if (kind === "line") {
    if (Math.abs(dy) <= Math.abs(dx) * SNAP_SLOPE) return { x: to.x, y: from.y };
    if (Math.abs(dx) <= Math.abs(dy) * SNAP_SLOPE) return { x: from.x, y: to.y };
  }
  return { x: from.x + (Math.sign(dx) || 1) * size, y: from.y + (Math.sign(dy) || 1) * size };
}

/**
 * Every pixel of the shape between two inclusive corners (or a line's two ends), each once.
 * Rectangle and ellipse share one path: an "inside" test over the box, drawn whole when
 * `filled`, else only the inside pixels with a 4-neighbour outside. Lines ignore `filled`.
 */
export function forEachShapePixel(
  kind: ShapeKind,
  from: ToolPoint,
  to: ToolPoint,
  filled: boolean,
  write: PixelWriter,
): void {
  if (kind === "line") {
    forEachLinePixel(from.x, from.y, to.x, to.y, write);
    return;
  }

  const left = Math.min(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x) + 1;
  const h = Math.abs(to.y - from.y) + 1;
  const rx = w / 2;
  const ry = h / 2;

  // In box coordinates. The ellipse is tested at pixel centres; its middle row and column are
  // always inside, so very flat ellipses (8×2) still reach all four sides of the box.
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (kind === "rectangle") return true;
    const ox = x + 0.5 - rx;
    const oy = y + 0.5 - ry;
    return Math.abs(ox) <= 0.5 || Math.abs(oy) <= 0.5 || (ox / rx) ** 2 + (oy / ry) ** 2 <= 1;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (filled || edge) write(left + x, top + y);
    }
  }
}
