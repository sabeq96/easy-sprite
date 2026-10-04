import { bufferIndex, BYTES_PER_PIXEL, cropRegion } from "@/core/buffer";
import { rectClamp, type Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";
import type { Mask } from "./mask";

/** A whole cel's pixels and its size: what the region helpers read and write. */
export interface PixelGrid {
  pixels: PixelBuffer;
  width: number;
  height: number;
}

export interface FloatingSelection {
  rect: Rect;
  /** The shape the pixels came from; `pixels` outside it are transparent. */
  mask: Mask;
  pixels: PixelBuffer;
  /** Raster of `pixels`, for cheap overlay drawing while dragging. */
  canvas: OffscreenCanvas;
}

/** Clears only the masked pixels. */
export function clearMasked(buffer: PixelBuffer, width: number, mask: Mask): void {
  const { rect, bits } = mask;
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      if (!bits[y * rect.w + x]) continue;
      const start = bufferIndex(rect.x + x, rect.y + y, width);
      buffer.fill(0, start, start + BYTES_PER_PIXEL);
    }
  }
}

/** Writes the masked pixels of `region` (laid out over `mask.rect`), transparent ones included. */
export function pasteMasked(
  buffer: PixelBuffer,
  width: number,
  mask: Mask,
  region: PixelBuffer,
): void {
  const { rect, bits } = mask;
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      if (!bits[y * rect.w + x]) continue;
      const source = (y * rect.w + x) * BYTES_PER_PIXEL;
      buffer.set(region.subarray(source, source + BYTES_PER_PIXEL), bufferIndex(rect.x + x, rect.y + y, width));
    }
  }
}

/** Makes the pixels of a crop of the mask's box transparent wherever the mask is not set. */
export function eraseOutside(pixels: PixelBuffer, mask: Mask): PixelBuffer {
  mask.bits.forEach((bit, i) => {
    if (!bit) pixels.fill(0, i * BYTES_PER_PIXEL, (i + 1) * BYTES_PER_PIXEL);
  });
  return pixels;
}

/** Copies — and optionally clears — the masked pixels of the grid. */
export function liftRegion(grid: PixelGrid, mask: Mask, cut: boolean): FloatingSelection {
  const { rect } = mask;
  const pixels = eraseOutside(cropRegion(grid.pixels, grid.width, rect), mask);
  if (cut) clearMasked(grid.pixels, grid.width, mask);

  const canvas = new OffscreenCanvas(rect.w, rect.h);
  canvas.getContext("2d")?.putImageData(new ImageData(pixels, rect.w, rect.h), 0, 0);

  return { rect, mask, pixels, canvas };
}

/**
 * Stamps a floating selection back at `at`, skipping transparent pixels so it does not punch holes.
 * Returns the rect written, clamped to the grid; null when it falls entirely outside.
 */
export function stampRegion(
  grid: PixelGrid,
  region: FloatingSelection,
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
