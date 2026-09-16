import { syncCelRaster } from "@/editor/cel";
import type { SpriteDocument } from "@/editor/document";

export interface CompositeOptions {
  /** Render a single layer only — used by layer thumbnails. */
  onlyLayerId?: string;
  /** Ignore visibility flags — used by export and thumbnails. */
  includeHidden?: boolean;
}

/**
 * Draws one frame's layers into a sprite-resolution canvas. Always sprite-resolution:
 * scaling happens once at present time, so cost is independent of zoom.
 */
export function compositeFrame(
  doc: SpriteDocument,
  frameId: string,
  target?: OffscreenCanvas,
  options: CompositeOptions = {},
): OffscreenCanvas {
  const canvas = ensureSize(
    target ?? new OffscreenCanvas(doc.width, doc.height),
    doc.width,
    doc.height,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const layer of doc.layers) {
    if (options.onlyLayerId && layer.id !== options.onlyLayerId) continue;
    if (!layer.visible && !options.includeHidden) continue;
    if (layer.opacity === 0) continue;

    const cel = doc.getCel(layer.id, frameId);
    if (!cel) continue; // unpainted cel — nothing to draw

    syncCelRaster(cel); // lazy putImageData, once per dirty cel per frame
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(cel.canvas, 0, 0);
  }

  ctx.globalAlpha = 1;
  return canvas;
}

function ensureSize(canvas: OffscreenCanvas, width: number, height: number): OffscreenCanvas {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return canvas;
}
