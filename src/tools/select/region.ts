import { clearRegion, cropRegion } from "@/core/buffer";
import { rectClamp, type Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";

/** A whole cel's pixels and its size: what the region helpers read and write. */
export interface PixelGrid {
  pixels: PixelBuffer;
  width: number;
  height: number;
}

export interface LiftedRegion {
  rect: Rect;
  pixels: PixelBuffer;
  /** Raster of `pixels`, for cheap overlay drawing while dragging. */
  canvas: OffscreenCanvas;
}

/** Copies — and optionally clears — a region of the grid. */
export function liftRegion(grid: PixelGrid, rect: Rect, cut: boolean): LiftedRegion {
  const pixels = cropRegion(grid.pixels, grid.width, rect);
  if (cut) clearRegion(grid.pixels, grid.width, rect);

  const canvas = new OffscreenCanvas(rect.w, rect.h);
  canvas.getContext("2d")?.putImageData(new ImageData(pixels, rect.w, rect.h), 0, 0);

  return { rect, pixels, canvas };
}

/**
 * Stamps a lifted region back at `at`, skipping transparent pixels so it does not punch holes.
 * Returns the rect written, clamped to the grid; null when it falls entirely outside.
 */
export function stampRegion(
  grid: PixelGrid,
  region: LiftedRegion,
  at: { x: number; y: number },
): Rect | null {
  const target = rectClamp({ ...region.rect, x: at.x, y: at.y }, grid.width, grid.height);
  if (target.w <= 0 || target.h <= 0) return null;

  const offsetX = target.x - at.x;
  const offsetY = target.y - at.y;

  for (let y = 0; y < target.h; y++) {
    for (let x = 0; x < target.w; x++) {
      const source = ((y + offsetY) * region.rect.w + (x + offsetX)) * 4;
      if (region.pixels[source + 3] === 0) continue;
      const destination = ((target.y + y) * grid.width + (target.x + x)) * 4;
      grid.pixels.set(region.pixels.subarray(source, source + 4), destination);
    }
  }

  return target;
}
