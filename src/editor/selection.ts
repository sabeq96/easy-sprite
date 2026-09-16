import { clearRegion, cropRegion } from "@/editor/buffer";
import type { SpriteDocument } from "@/editor/document";
import { rectClamp, type Rect } from "@/lib/rect";
import type { PixelBuffer } from "@/types/pixels";

export interface Selection {
  rect: Rect;
  /** width*height bytes, 1 = selected. Rect-shaped today; shape tools can fill it later. */
  mask: Uint8Array;
}

export interface LiftedRegion {
  rect: Rect;
  pixels: PixelBuffer;
  /** Raster of `pixels`, for cheap overlay drawing while dragging. */
  canvas: OffscreenCanvas;
}

export function createRectSelection(width: number, height: number, rect: Rect): Selection | null {
  const clamped = rectClamp(rect, width, height);
  if (clamped.w <= 0 || clamped.h <= 0) return null;

  const mask = new Uint8Array(width * height);
  for (let y = clamped.y; y < clamped.y + clamped.h; y++) {
    const rowStart = y * width + clamped.x;
    mask.fill(1, rowStart, rowStart + clamped.w);
  }

  return { rect: clamped, mask };
}

export function selectAll(width: number, height: number): Selection {
  return {
    rect: { x: 0, y: 0, w: width, h: height },
    mask: new Uint8Array(width * height).fill(1),
  };
}

export function translateSelection(
  selection: Selection,
  dx: number,
  dy: number,
  width: number,
  height: number,
): Selection | null {
  return createRectSelection(width, height, {
    ...selection.rect,
    x: selection.rect.x + dx,
    y: selection.rect.y + dy,
  });
}

/** Copies — and optionally clears — the selected region of one cel. */
export function liftRegion(
  doc: SpriteDocument,
  layerId: string,
  frameId: string,
  selection: Selection,
  cut: boolean,
): LiftedRegion | null {
  const cel = doc.getCel(layerId, frameId);
  if (!cel) return null;

  const pixels = cropRegion(cel.pixels, doc.width, selection.rect);
  if (cut) {
    clearRegion(cel.pixels, doc.width, selection.rect);
    doc.markPixelsChanged(cel, selection.rect);
  }

  const canvas = new OffscreenCanvas(selection.rect.w, selection.rect.h);
  canvas
    .getContext("2d")
    ?.putImageData(new ImageData(pixels, selection.rect.w, selection.rect.h), 0, 0);

  return { rect: selection.rect, pixels, canvas };
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
