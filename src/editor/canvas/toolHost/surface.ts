import { getPixel } from "@/core/buffer";
import type { SpriteDocument } from "@/core/document";
import type { StrokeRecorder } from "@/core/history";
import type { Surface } from "@/framework/host";
import { TRANSPARENT } from "@/lib/color";
import type { PixelBuffer } from "@/types/pixels";

/**
 * One layer on one frame as a tool's drawing surface, recording into `recorder`. The first
 * `buffer()` call creates the cel and snapshots it, so undo is exact and a locked or missing
 * target is never written (the caller only builds a surface for an editable one).
 */
export function createSurface(
  doc: SpriteDocument,
  layerId: string,
  frameId: string,
  recorder: StrokeRecorder,
): Surface {
  // Kept for `revert()`; the recorder holds its own copy for undo.
  let snapshot: PixelBuffer | null = null;

  return {
    get width() {
      return doc.width;
    },
    get height() {
      return doc.height;
    },

    read(x, y) {
      if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return TRANSPARENT;
      const cel = doc.getCel(layerId, frameId);
      return cel ? getPixel(cel.pixels, x, y, doc.width) : TRANSPARENT;
    },

    buffer() {
      if (!snapshot) {
        recorder.touch(layerId, frameId);
        snapshot = doc.snapshotCel(layerId, frameId);
      }
      return doc.ensureCel(layerId, frameId).pixels;
    },

    commit(dirty) {
      if (!dirty || dirty.w <= 0 || dirty.h <= 0) return;
      recorder.extend(layerId, frameId, dirty);
      doc.markPixelsChanged(doc.ensureCel(layerId, frameId), dirty);
    },

    revert() {
      if (!snapshot) return;
      const cel = doc.ensureCel(layerId, frameId);
      cel.pixels.set(snapshot);
      // The recorder now finds before == after, so the gesture records nothing.
      doc.markPixelsChanged(cel, { x: 0, y: 0, w: doc.width, h: doc.height });
    },
  };
}
