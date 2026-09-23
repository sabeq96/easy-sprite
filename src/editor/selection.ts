import { clearRegion, cropRegion } from "@/editor/buffer";
import type { SpriteDocument } from "@/editor/document";
import { rectClamp, type Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";

export interface LiftedRegion {
  rect: Rect;
  pixels: PixelBuffer;
  /** Raster of `pixels`, for cheap overlay drawing while dragging. */
  canvas: OffscreenCanvas;
}

/** Copies — and optionally clears — a region of one cel. */
export function liftRegion(
  doc: SpriteDocument,
  layerId: string,
  frameId: string,
  rect: Rect,
  cut: boolean,
): LiftedRegion {
  // ensureCel, not getCel: an empty layer still lifts (transparent) so the selection can move.
  const cel = doc.ensureCel(layerId, frameId);
  const pixels = cropRegion(cel.pixels, doc.width, rect);
  if (cut) {
    clearRegion(cel.pixels, doc.width, rect);
    doc.markPixelsChanged(cel, rect);
  }

  const canvas = new OffscreenCanvas(rect.w, rect.h);
  canvas.getContext("2d")?.putImageData(new ImageData(pixels, rect.w, rect.h), 0, 0);

  return { rect, pixels, canvas };
}

/** Stamps a lifted region back, skipping transparent pixels so it does not punch holes. */
export function stampRegion(
  doc: SpriteDocument,
  layerId: string,
  frameId: string,
  region: LiftedRegion,
  at: { x: number; y: number },
): Rect | null {
  const target = rectClamp({ ...region.rect, x: at.x, y: at.y }, doc.width, doc.height);
  if (target.w <= 0 || target.h <= 0) return null;

  const cel = doc.ensureCel(layerId, frameId);
  const offsetX = target.x - at.x;
  const offsetY = target.y - at.y;

  for (let y = 0; y < target.h; y++) {
    for (let x = 0; x < target.w; x++) {
      const source = ((y + offsetY) * region.rect.w + (x + offsetX)) * 4;
      if (region.pixels[source + 3] === 0) continue;
      const destination = ((target.y + y) * doc.width + (target.x + x)) * 4;
      cel.pixels.set(region.pixels.subarray(source, source + 4), destination);
    }
  }

  doc.markPixelsChanged(cel, target);
  return target;
}
