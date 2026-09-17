import type { ResizeOptions } from "@/editor/buffer";
import type { CelData, SpriteDocument } from "@/editor/document";
import type { Command } from "@/editor/history";

/**
 * Resizing touches every cel, and shrinking discards pixels outright, so undo carries a full
 * snapshot — nothing smaller is sufficient.
 */
export function resizeCanvasCommand(
  doc: SpriteDocument,
  width: number,
  height: number,
  options: ResizeOptions = {},
): Command | null {
  if (width === doc.width && height === doc.height) return null;

  const before = { width: doc.width, height: doc.height };
  const snapshots: CelData[] = [];

  for (const layer of doc.layers) {
    for (const frame of doc.frames) {
      const cel = doc.getCel(layer.id, frame.id);
      if (!cel) continue;
      snapshots.push({
        layerId: layer.id,
        frameId: frame.id,
        pixels: new Uint8ClampedArray(cel.pixels),
      });
    }
  }

  doc.resize(width, height, options);

  return {
    label: "Resize canvas",
    sizeBytes: snapshots.reduce((total, cel) => total + cel.pixels.length, 0),
    undo: () => {
      doc.resize(before.width, before.height, options);
      const fullRect = { x: 0, y: 0, w: before.width, h: before.height };
      for (const snapshot of snapshots) {
        const cel = doc.ensureCel(snapshot.layerId, snapshot.frameId);
        cel.pixels.set(snapshot.pixels);
        doc.markPixelsChanged(cel, fullRect);
      }
    },
    redo: () => {
      doc.resize(width, height, options);
    },
  };
}

/** True when the new size would discard pixels — the dialog warns before applying. */
export function resizeWillCrop(doc: SpriteDocument, width: number, height: number): boolean {
  return width < doc.width || height < doc.height;
}
