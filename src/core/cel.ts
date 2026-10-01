import { createBuffer } from "@/editor/buffer";
import type { PixelBuffer } from "@/types/pixels";

export interface Cel {
  readonly layerId: string;
  readonly frameId: string;
  readonly width: number;
  readonly height: number;
  /** The single source of truth for this cel's pixels. Tools write here. */
  readonly pixels: PixelBuffer;
  /** Wraps `pixels` — same memory, no copy. Only used to blit into `canvas`. */
  readonly imageData: ImageData;
  /** Raster cache for the compositor, refreshed lazily via syncCelRaster(). */
  readonly canvas: OffscreenCanvas;
  rasterDirty: boolean;
  storeDirty: boolean;
}

export function celKey(layerId: string, frameId: string): string {
  return `${layerId}:${frameId}`;
}

export function createCel(
  layerId: string,
  frameId: string,
  width: number,
  height: number,
  pixels?: PixelBuffer,
): Cel {
  const buffer = pixels ?? createBuffer(width, height);
  return {
    layerId,
    frameId,
    width,
    height,
    pixels: buffer,
    // ImageData shares the buffer, so writes to `pixels` need no copy before putImageData.
    imageData: new ImageData(buffer, width, height),
    canvas: new OffscreenCanvas(width, height),
    rasterDirty: true,
    storeDirty: false,
  };
}

/**
 * putImageData ignores globalAlpha and composite modes and writes straight-alpha values
 * verbatim — exactly what we want, since all blending happens later in the compositor.
 */
export function syncCelRaster(cel: Cel): void {
  if (!cel.rasterDirty) return;
  const ctx = cel.canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(cel.imageData, 0, 0);
  cel.rasterDirty = false;
}
